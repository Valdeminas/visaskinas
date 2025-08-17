// ---------- Utils ----------
function isFuture(showDate, showTime) {
  const showDateTime = new Date(showDate + " " + showTime);
  return showDateTime > new Date();
}

function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// ---------- Forum CInemas (XML) ----------
async function parseForumLike(cinemaRoot,date,theatreId) {
  const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
  const url = `https://www.${cinemaRoot}.lt/xml/Schedule?dt=${formattedDate}&area=${theatreId}`;
  const response = await fetch(url);
  const text = await response.text();
  
  const data = JSON.parse(text);
  
  const now = new Date();

  const movies = data.Shows
      .map(show => {
        return {
          title: show.Title || "",
          time: new Date(show.dttmShowStart),
          cinema: show.Theatre || "",
          url: show.ShowURL || ""
      };
      })
      .filter(show => show.time > now); // only future shows

  return movies;
}


// ---------- Multikino ----------
async function parseMultikino(selectedDate) {
  const url = "https://multikino.lt/data/films/";
  const res = await fetch(url);
  const data = await res.json();
  const movies = data.map(film => ({
      title: film.title,
      times: film.showtimes.filter(st => new Date(st.date + " " + st.time) >= new Date(selectedDate)),
      cinema: "Multikino",
      url: film.url
  }));
  return movies;
}

// ---------- Pasaka ----------
async function parsePasaka(date) {
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
        }))
    )
    .filter(show => show.time > now); // only future shows
  return movies;
}

// ---------- Skalvija ----------
async function parseSkalvija(selectedDate) {
  const selectedYear = selectedDate.getFullYear();
const selectedMonth = selectedDate.getMonth(); // 0-based!
const selectedDay = selectedDate.getDate();
  const url = "https://skalvija.lt/wp-json/data/v1/get_shows/";
  const res = await fetch(url);
  const json = await res.json();
  if (!json) return [];

  // Assuming `data` is the JSON object you have
  const { shows, events } = json;

  // Create a lookup map for events by their _id for fast access
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
      url: 'https://www.skalvija.lt'+event.link+`?show=${show._id}`
  };
  })
  .filter(show => show.time.getFullYear() == selectedYear && show.time.getMonth() == selectedMonth && show.time.getDate() == selectedDay)
  .filter(show => show.time > now); // only future shows

  return movies;
}

// ---------- Merge all cinemas ----------
async function getAllMovies(selectedDate) {
  const results = await Promise.all([
      parseForumLike('forumcinemas',selectedDate,1011),
      // parseMultikino(selectedDate),
      parsePasaka(formatDate(selectedDate)),
      parseSkalvija(selectedDate),
      parseForumLike('apollokinas',selectedDate, 1019 ),
      parseForumLike('apollokinas', selectedDate, 1024),
  ]);
  return results.flat();
}

// ---------- Render Table ----------
function renderTable(movies) {
  const table = document.getElementById("moviesTable");
  table.innerHTML = `
      <tr>
          <th>Title</th>
          <th>Time</th>
          <th>Cinema</th>
      </tr>
  `;

  if (movies.length === 0) {
    // If no movies, display a single row spanning all columns
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" style="text-align:center; font-weight:bold; color:#555;">
                        No movies found 😢
                    </td>`;
    table.appendChild(tr);
    return;
  }

  movies
  .sort((a, b) => a.time - b.time)
  .forEach(movie => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
              <td>${movie.title}</td>
              <td>${movie.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>${movie.cinema}</td>
          `;
          tr.addEventListener("click", () => {
              window.open(movie.url, "_blank");
          });
          table.appendChild(tr);
      });
}

// ---------- Initialize ----------
async function init() {
  const dateInput = document.getElementById("datePicker");
  const selectedDate = dateInput.value ? new Date(dateInput.value) : new Date();
  const movies = await getAllMovies(selectedDate);
  renderTable(movies);
}

// ---------- Event Listener ----------
document.getElementById("datePicker").addEventListener("change", init);

// ---------- Run on load ----------
window.addEventListener("DOMContentLoaded", init);
