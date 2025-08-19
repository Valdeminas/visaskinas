import utils from './utils.js';
import cinemaService from './cinemaService.js';
import stateManager from './stateManager.js';
import mobileHandler from './mobileHandler.js';
import tableRenderer from './tableRenderer.js';
import headerDropdown from './headerDropdown.js';
import viewSwitcher from './viewSwitcher.js';

const app = {
    init: async () => {
        // Rodyti loader iškart, kad matytųsi ir perkrovus puslapį
        viewSwitcher.showLoading('table');

        try {
            const dateInput = document.getElementById("datePicker");
            if (!dateInput.value) {
                dateInput.value = utils.formatDateForInput(new Date());
            }
            const selectedDate = new Date(dateInput.value);

            await stateManager.ensureTitlesPrefetched();
            const movies = await cinemaService.getAllMovies(selectedDate);

            movies.forEach(m => {
                stateManager.allKnownTitles.add(m.title);
                stateManager.allKnownCinemas.add(m.cinema);
            });

            stateManager.currentMovies = movies;
            headerDropdown.init(movies);
            tableRenderer.render(movies);
        } finally {
            // Paslėpti loader tik po to, kai viskas paruošta
            viewSwitcher.hideLoading();
        }
    },

    setupEventListeners: () => {
        window.addEventListener('DOMContentLoaded', () => {
            mobileHandler.initToggle();

            mobileHandler.onModeChange = () => {
                if (stateManager.currentMovies) {
                    tableRenderer.render(stateManager.currentMovies);
                }
            };

            // Inicijuojame viewSwitcher (mygtukų būsenų atstatymui)
            viewSwitcher.init();

            // Grid View mygtukas: rodom loader ir naviguojam
            const gridBtn = document.getElementById('viewGridBtn');
            if (gridBtn) {
                gridBtn.addEventListener('click', () => {
                    viewSwitcher.navigateToView('grid', 'viewGridBtn');
                });
            }
        });

        window.addEventListener('resize', utils.debounce(() => {
            if (stateManager.currentMovies && stateManager.currentMovies.length >= 0) {
                headerDropdown.init(stateManager.currentMovies);
            }
        }, 150));

        document.getElementById("datePicker").addEventListener("change", app.init);

        window.addEventListener("DOMContentLoaded", app.init);
    }
};

app.setupEventListeners();