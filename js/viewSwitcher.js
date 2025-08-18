const viewSwitcher = {
    init: () => {
        // Atstatom mygtukų būsenas, bet nesislepiam loader automatiškai,
        // nes jo valdymą darome app.init metu.
        window.addEventListener('pageshow', () => {
            const gridBtn = document.getElementById('viewGridBtn');
            if (gridBtn) {
                gridBtn.disabled = false;
                gridBtn.textContent = 'Grid View';
            }
            const tableBtn = document.getElementById('viewTableBtn');
            if (tableBtn) {
                tableBtn.disabled = false;
                tableBtn.textContent = 'Table View';
            }
        });
    },

    showLoading: (targetView) => {
        const overlay = document.getElementById('loadingIndicator');
        if (!overlay) return;

        const titleEl = overlay.querySelector('.loading-title');
        const subtitleEl = overlay.querySelector('.loading-subtitle');

        if (titleEl) {
            titleEl.textContent = `Loading ${targetView === 'grid' ? 'Grid' : 'Table'} View...`;
        }
        if (subtitleEl) {
            subtitleEl.textContent = 'Please wait';
        }

        overlay.style.display = 'flex';
    },

    hideLoading: () => {
        const overlay = document.getElementById('loadingIndicator');
        if (overlay) overlay.style.display = 'none';
    },

    navigateToView: (targetView, buttonId) => {
        const btn = document.getElementById(buttonId);
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Loading...';
        }
        viewSwitcher.showLoading(targetView);
        window.location.href = targetView === 'grid' ? 'grid.html' : 'index.html';
    }
};

export default viewSwitcher;