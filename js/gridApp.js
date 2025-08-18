import utils from './utils.js';
import cinemaService from './cinemaService.js';
import stateManager from './stateManager.js';
import mobileHandler from './mobileHandler.js';
import viewSwitcher from './viewSwitcher.js';

const gridRenderer = {
    render: (movies) => {
        const gridContainer = document.getElementById('moviesGrid');
        gridContainer.innerHTML = '';

        // Group movies by title
        const movieGroups = {};
        movies.forEach(movie => {
            if (!movieGroups[movie.title]) {
                movieGroups[movie.title] = {
                    title: movie.title,
                    poster: movie.poster || null,
                    showtimes: []
                };
            }
            // If this movie group doesn't have a poster yet, try to use current movie's poster
            if (!movieGroups[movie.title].poster) {
                if (movie.poster) {
                    movieGroups[movie.title].poster = movie.poster;
                }
            }

            movieGroups[movie.title].showtimes.push({
                time: movie.time,
                cinema: movie.cinema,
                url: movie.url // Include URL for links
            });
        });

        // Sort showtimes by time
        Object.values(movieGroups).forEach(group => {
            group.showtimes.sort((a, b) => {
                // Since movie.time is a Date object, compare directly
                if (a.time instanceof Date && b.time instanceof Date) {
                    return a.time - b.time;
                }
                // Fallback if times are strings
                return String(a.time).localeCompare(String(b.time));
            });
        });

        // Create grid cards
        Object.values(movieGroups).forEach(movieGroup => {
            const card = document.createElement('div');
            card.className = 'movie-card';

            const showtimesList = movieGroup.showtimes
                .map(showtime => {
                    // Format time properly - check if it's a Date object
                    const timeString = showtime.time instanceof Date
                        ? showtime.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })
                        : showtime.time;

                    // Create link with URL if available
                    const timeLink = showtime.url
                        ? `<a href="${showtime.url}" target="_blank" rel="noopener noreferrer" class="time-link">${timeString}</a>`
                        : `<span class="time-text">${timeString}</span>`;

                    return `<div class="showtime">${timeLink} - ${showtime.cinema}</div>`;
                })
                .join('');

            // Create poster HTML - use CSS placeholder if no image
            const posterHTML = movieGroup.poster
                ? `<img src="${movieGroup.poster}" alt="${movieGroup.title}" loading="lazy">`
                : `<div class="poster-placeholder">🎬</div>`;

            card.innerHTML = `
                <div class="movie-poster">
                    ${posterHTML}
                </div>
                <div class="movie-info">
                    <h3 class="movie-title">${movieGroup.title}</h3>
                    <div class="showtimes">
                        ${showtimesList}
                    </div>
                </div>
            `;

            gridContainer.appendChild(card);
        });
    }
};

const gridApp = {
    init: async () => {
        // Rodyti loader iškart, kad matytųsi ir perkrovus puslapį
        viewSwitcher.showLoading('grid');

        try {
            const dateInput = document.getElementById("datePicker");
            if (!dateInput.value) {
                dateInput.value = utils.formatDateForInput(new Date());
            }
            const selectedDate = new Date(dateInput.value);
            await stateManager.ensureTitlesPrefetched();
            const movies = await cinemaService.getAllMovies(selectedDate);

            // update known options across dates
            movies.forEach(m => {
                stateManager.allKnownTitles.add(m.title);
                stateManager.allKnownCinemas.add(m.cinema);
            });

            stateManager.currentMovies = movies;
            // Don't initialize headerDropdown for grid view - it expects table elements
            gridRenderer.render(movies);
        } finally {
            // Paslėpti loader tik po to, kai viskas paruošta
            viewSwitcher.hideLoading();
        }
    },

    setupEventListeners: () => {
        // Hook up bottom mode toggle
        window.addEventListener('DOMContentLoaded', () => {
            mobileHandler.initToggle();

            // Set callback for mobile mode changes
            mobileHandler.onModeChange = () => {
                if (stateManager.currentMovies) {
                    gridRenderer.render(stateManager.currentMovies);
                }
            };

            // Inicijuojame viewSwitcher (mygtukų būsenų atstatymui)
            viewSwitcher.init();

            // Table View mygtukas: rodom loader ir naviguojam
            const tableBtn = document.getElementById('viewTableBtn');
            if (tableBtn) {
                tableBtn.addEventListener('click', () => {
                    viewSwitcher.navigateToView('table', 'viewTableBtn');
                });
            }
        });

        // Event listener for date picker
        document.getElementById("datePicker").addEventListener("change", gridApp.init);

        // Run on load
        window.addEventListener("DOMContentLoaded", gridApp.init);
    }
};

// Initialize app
gridApp.setupEventListeners();