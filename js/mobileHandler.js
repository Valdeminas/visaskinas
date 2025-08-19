import utils from './utils.js';

// @todo npt sure ar bereikia sito
const mobileHandler = {
    // Remove swipe/top bar; use bottom toggle instead
    mode: 'browse', // 'browse' | 'buy'

    setMode: (mode) => {
        mobileHandler.mode = mode;
        mobileHandler.updateToggle();
        // Will be called from app.js to avoid circular dependency
        if (mobileHandler.onModeChange) {
            mobileHandler.onModeChange();
        }
    },

    updateToggle: () => {
        const btn = document.getElementById('mobileModeToggle');
        if (!btn) return;
        if (!utils.isMobileView()) {
            btn.style.display = 'none';
            return;
        }
        btn.style.display = 'inline-block';
        btn.textContent = mobileHandler.mode === 'browse' ? 'Go to Buy' : 'Go to Browse';
    },

    initToggle: () => {
        const btn = document.getElementById('mobileModeToggle');
        if (btn) {
            btn.addEventListener('click', () =>
                mobileHandler.setMode(mobileHandler.mode === 'browse' ? 'buy' : 'browse')
            );
        }
    },

    // Callback to be set by app.js
    onModeChange: null
};

export default mobileHandler;