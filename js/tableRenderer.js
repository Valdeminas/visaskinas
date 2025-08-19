import utils from './utils.js';
import stateManager from './stateManager.js';
import mobileHandler from './mobileHandler.js';

const tableRenderer = {
    render: (movies) => {
        const tbody = document.getElementById("moviesTableBody");
        tbody.innerHTML = ""; // only clear rows, not header

        const selectedBox = document.getElementById("selectedContainer");
        if (selectedBox) selectedBox.innerHTML = "";

        mobileHandler.updateToggle();

        // --- FILTER MOVIES ---
        let filteredMovies = movies;
        if (utils.isMobileView()) {
            // On mobile, cinemas narrow the list; titles are shown as sticky picks but do not filter browse list
            if (stateManager.selectedCinemas.length > 0) {
                filteredMovies = filteredMovies.filter(m => stateManager.selectedCinemas.includes(m.cinema));
            }
        } else {
            // Desktop: both filters apply to the table
            if (stateManager.selectedTitles.length > 0) {
                filteredMovies = filteredMovies.filter(m => stateManager.selectedTitles.includes(m.title));
            }
            if (stateManager.selectedCinemas.length > 0) {
                filteredMovies = filteredMovies.filter(m => stateManager.selectedCinemas.includes(m.cinema));
            }
        }

        // Desktop empty state
        if (!utils.isMobileView() && filteredMovies.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td colspan="3" style="text-align:center; font-weight:bold; color:#555;">
                                No movies found 😢
                            </td>`;
            tbody.appendChild(tr);
            return;
        }

        // Prepare list for mobile versus desktop
        let moviesToRender = filteredMovies
            .sort((a, b) => a.time - b.time);

        if (utils.isMobileView()) {
            const selectedMovies = moviesToRender.filter(m => stateManager.selectedTitles.includes(m.title));
            const unselectedMovies = moviesToRender.filter(m => !selectedMovies.includes(m));

            if (mobileHandler.mode === 'buy') {
                if (selectedBox) {
                    selectedBox.style.display = 'none';
                }
                const list = selectedMovies;
                if (list.length === 0) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `<td colspan="3" style="text-align:center; font-weight:bold; color:#555;">No selections yet</td>`;
                    tbody.appendChild(tr);
                } else {
                    list.forEach(movie => tbody.appendChild(tableRenderer.buildMovieRow(movies, movie)));
                }
                return;
            }

            // browse mode: sticky selected table above, list below
            if (selectedBox) {
                selectedBox.style.display = selectedMovies.length > 0 ? 'block' : 'none';
                if (selectedMovies.length > 0) {
                    const tbl = document.createElement('table');
                    tbl.style.width = '100%';
                    tbl.style.borderCollapse = 'collapse';
                    const thead = document.createElement('thead');
                    const trh = document.createElement('tr');
                    ['Title','Time','Cinema'].forEach(h => {
                        const th = document.createElement('th');
                        th.textContent = h;
                        th.style.background = '#fff8dd';
                        th.style.borderBottom = '1px solid #f3e3b0';
                        th.style.textAlign = 'left';
                        th.style.padding = '6px';
                        trh.appendChild(th);
                    });
                    thead.appendChild(trh);
                    const tb = document.createElement('tbody');
                    selectedMovies.forEach(movie => tb.appendChild(tableRenderer.buildMovieRow(movies, movie)));
                    tbl.appendChild(thead);
                    tbl.appendChild(tb);
                    tbl.style.border = '1px solid #f3e3b0';
                    tbl.style.borderRadius = '6px';
                    selectedBox.appendChild(tbl);
                }
            }

            unselectedMovies.forEach(movie => tbody.appendChild(tableRenderer.buildMovieRow(movies, movie)));
            return;
        }

        // Render main table body (desktop)
        moviesToRender.forEach(movie => {
            const tr = tableRenderer.buildMovieRow(movies, movie);
            tbody.appendChild(tr);
        });
    },

    buildMovieRow: (movies, movie) => {
        const tr = document.createElement("tr");

        const titleTd = document.createElement("td");
        const titleCheckbox = document.createElement("input");
        titleCheckbox.type = "checkbox";
        titleCheckbox.checked = stateManager.selectedTitles.includes(movie.title);
        titleCheckbox.addEventListener("click", (e) => { e.stopPropagation(); });
        titleCheckbox.addEventListener("change", () => {
            if (titleCheckbox.checked && !stateManager.selectedTitles.includes(movie.title)) {
                stateManager.selectedTitles.push(movie.title);
            } else if (!titleCheckbox.checked) {
                stateManager.selectedTitles = stateManager.selectedTitles.filter(t => t !== movie.title);
            }
            tableRenderer.render(movies);
        });
        titleTd.appendChild(titleCheckbox);
        titleTd.appendChild(document.createTextNode(" " + movie.title));
        titleTd.style.cursor = "pointer";
        titleTd.addEventListener("click", () => {
            titleCheckbox.checked = !titleCheckbox.checked;
            titleCheckbox.dispatchEvent(new Event("change"));
        });

        const timeTd = document.createElement("td");
        const timeLink = document.createElement("a");
        timeLink.href = movie.url;
        timeLink.target = "_blank";
        timeLink.rel = "noopener noreferrer";
        timeLink.textContent = movie.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
        timeTd.appendChild(timeLink);

        const cinemaTd = document.createElement("td");
        const cinemaCheckbox = document.createElement("input");
        cinemaCheckbox.type = "checkbox";
        cinemaCheckbox.checked = stateManager.selectedCinemas.includes(movie.cinema);
        cinemaCheckbox.addEventListener("click", (e) => { e.stopPropagation(); });
        cinemaCheckbox.addEventListener("change", () => {
            if (cinemaCheckbox.checked && !stateManager.selectedCinemas.includes(movie.cinema)) {
                stateManager.selectedCinemas.push(movie.cinema);
            } else if (!cinemaCheckbox.checked) {
                stateManager.selectedCinemas = stateManager.selectedCinemas.filter(c => c !== movie.cinema);
            }
            tableRenderer.render(movies);
            if (stateManager.cinemaDropdownInstance && stateManager.cinemaDropdownInstance.render) {
                stateManager.cinemaDropdownInstance.render();
            }
        });
        cinemaTd.appendChild(cinemaCheckbox);
        cinemaTd.appendChild(document.createTextNode(" " + movie.cinema));
        cinemaTd.style.cursor = "pointer";
        cinemaTd.addEventListener("click", () => {
            cinemaCheckbox.checked = !cinemaCheckbox.checked;
            cinemaCheckbox.dispatchEvent(new Event("change"));
        });

        tr.appendChild(titleTd);
        tr.appendChild(timeTd);
        tr.appendChild(cinemaTd);

        return tr;
    }
};

export default tableRenderer;