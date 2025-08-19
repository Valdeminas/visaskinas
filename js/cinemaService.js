
import utils from './utils.js';

const cinemaService = {
    parseForumLike: async (cinemaRoot, date, theatreId) => {
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
        const url = `https://www.${cinemaRoot}.lt/xml/Schedule?dt=${formattedDate}&area=${theatreId}`;
        const response = await fetch(url);
        const text = await response.text();

        const data = JSON.parse(text);
        const now = new Date();

        const movies = data.Shows
            .map(show => {
                // Try to get poster image from Forum Cinemas API
                let posterImage = null;
                if (show.Images) {
                    // Prefer medium image, fallback to small
                    posterImage = show.Images.EventMediumImagePortrait ||
                        show.Images.EventSmallImagePortrait ||
                        null;
                }

                return {
                    title: show.Title || "",
                    time: new Date(show.dttmShowStart),
                    cinema: show.Theatre || "",
                    url: show.ShowURL || "",
                    poster: posterImage
                };
            })
            .filter(show => show.time > now); // only future shows

        return movies;
    },

    parseMultikino: async (selectedDate) => {
        const url = "https://multikino.lt/data/films/";
        const res = await fetch(url);
        const data = await res.json();
        const movies = data.map(film => ({
            title: film.title,
            times: film.showtimes.filter(st => new Date(st.date + " " + st.time) >= new Date(selectedDate)),
            cinema: "Multikino",
            url: film.url,
            poster: null // Multikino doesn't provide images in this endpoint
        }));
        return movies;
    },

    parsePasaka: async (date) => {
        const url = `https://api.pasaka.lt/movies?include=mpaaRating,genres,collections&filter[date]=${date}&filter[project_identifier]=pasaka`;
        const res = await fetch(url);
        const data = await res.json();
        const now = new Date();
        const movies = data.data
            .flatMap(movie =>
                movie.events.map(event => ({
                    title: movie.name,
                    time: new Date(event.starts_at.full),
                    cinema: event.theater.name,
                    url: event.markus_link,
                    poster: null // Pasaka API structure might have images but not specified
                }))
            )
            .filter(show => show.time > now); // only future shows
        return movies;
    },

    parseSkalvija: async (selectedDate) => {
        const selectedYear = selectedDate.getFullYear();
        const selectedMonth = selectedDate.getMonth(); // 0-based!
        const selectedDay = selectedDate.getDate();
        const url = "https://skalvija.lt/wp-json/data/v1/get_shows/";
        const res = await fetch(url);
        const json = await res.json();
        if (!json) return [];

        const { shows, events } = json;
        const eventMap = {};
        events.forEach(event => {
            eventMap[event._id] = event;
        });

        const now = new Date();

        const movies = shows.map(show => {
            const event = eventMap[show.eventid];
            return {
                title: event.title,
                time: new Date(show.start_date*1000),
                cinema: 'Skalvija',
                url: 'https://www.skalvija.lt'+event.link+`?show=${show._id}`,
                poster: null // Skalvija might have images but not specified in current structure
            };
        })
            .filter(show => show.time.getFullYear() == selectedYear && show.time.getMonth() == selectedMonth && show.time.getDate() == selectedDay)
            .filter(show => show.time > now); // only future shows

        return movies;
    },

    getAllMovies: async (selectedDate) => {
        const results = await Promise.all([
            cinemaService.parseForumLike('forumcinemas', selectedDate, 1011),
            cinemaService.parsePasaka(utils.formatDate(selectedDate)),
            cinemaService.parseSkalvija(selectedDate),
            cinemaService.parseForumLike('apollokinas', selectedDate, 1019),
            cinemaService.parseForumLike('apollokinas', selectedDate, 1024),
        ]);
        return results.flat();
    }
};

export default cinemaService;