
import utils from './utils.js';
import stateManager from './stateManager.js';
import components from './components.js';
import tableRenderer from './tableRenderer.js';

const headerDropdown = {
    init: (movies) => {
        const thead = document.getElementById("moviesTableHeader");
        thead.innerHTML = ""; // just header

        const header = document.createElement("tr");

        const thTitle = document.createElement("th");
        thTitle.textContent = "Title";
        thTitle.style.cursor = "pointer";
        thTitle.style.position = "relative";

        const thTime = document.createElement("th");
        thTime.textContent = "Time";

        const thCinema = document.createElement("th");
        thCinema.textContent = "Cinema";
        thCinema.style.cursor = "pointer";
        thCinema.style.position = "relative";

        header.appendChild(thTitle);
        header.appendChild(thTime);
        header.appendChild(thCinema);
        thead.appendChild(header);

        // Always allow Cinema dropdown (mobile + desktop)
        const cinemaIcon = document.createElement("span");
        cinemaIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>';
        cinemaIcon.style.marginLeft = "6px";
        cinemaIcon.style.verticalAlign = "middle";
        cinemaIcon.style.color = "rgba(255,255,255,0.8)";
        thCinema.appendChild(cinemaIcon);

        const cinemaDropdown = components.createCheckboxFilterDropdown({
            items: () => Array.from(stateManager.allKnownCinemas),
            getSelected: () => stateManager.selectedCinemas,
            setSelected: (next) => { stateManager.selectedCinemas = next; },
            getSearchText: () => stateManager.cinemaSearchText,
            setSearchText: (v) => { stateManager.cinemaSearchText = v; },
            placeholder: "Search cinema...",
            emptyText: "No cinemas",
            onChange: () => tableRenderer.render(movies),
            showSearch: false,
            listMode: 'allWithSelectedFirst',
        });
        thCinema.appendChild(cinemaDropdown.container);
        thCinema.addEventListener("click", (e) => {
            e.stopPropagation();
            const willShow = cinemaDropdown.container.style.display === "none" || cinemaDropdown.container.style.display === "";
            cinemaDropdown.container.style.display = willShow ? "block" : "none";
            if (willShow) cinemaDropdown.open();
        });
        cinemaDropdown.container.addEventListener("click", (e) => e.stopPropagation());
        document.addEventListener("click", (e) => {
            if (cinemaDropdown.isDragging()) return;
            if (!cinemaDropdown.container.contains(e.target) && e.target !== thCinema && !thCinema.contains(e.target)) {
                cinemaDropdown.container.style.display = "none";
            }
        });
        stateManager.cinemaDropdownInstance = cinemaDropdown;

        // Desktop-only: Title dropdown remains
        if (!utils.isMobileView()) {
            const titleIcon = document.createElement("span");
            titleIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>';
            titleIcon.style.marginLeft = "6px";
            titleIcon.style.verticalAlign = "middle";
            titleIcon.style.color = "rgba(255,255,255,0.8)";
            thTitle.appendChild(titleIcon);

            const titleDropdown = components.createCheckboxFilterDropdown({
                items: () => Array.from(stateManager.allKnownTitles),
                getSelected: () => stateManager.selectedTitles,
                setSelected: (next) => { stateManager.selectedTitles = next; },
                getSearchText: () => stateManager.searchText,
                setSearchText: (v) => { stateManager.searchText = v; },
                placeholder: "Search title...",
                emptyText: "No selected titles",
                onChange: () => tableRenderer.render(movies),
                showSearch: true,
                listMode: 'selectedOnlyDefault',
            });
            thTitle.appendChild(titleDropdown.container);
            thTitle.addEventListener("click", (e) => {
                e.stopPropagation();
                const willShow = titleDropdown.container.style.display === "none" || titleDropdown.container.style.display === "";
                titleDropdown.container.style.display = willShow ? "block" : "none";
                if (willShow) titleDropdown.open();
            });
            titleDropdown.container.addEventListener("click", (e) => e.stopPropagation());
            document.addEventListener("click", (e) => {
                if (titleDropdown.isDragging()) return;
                if (!titleDropdown.container.contains(e.target) && e.target !== thTitle && !thTitle.contains(e.target)) {
                    titleDropdown.container.style.display = "none";
                }
            });
            stateManager.titleDropdownInstance = titleDropdown;
        }
    }
};

export default headerDropdown;