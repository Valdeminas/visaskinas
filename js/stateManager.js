const stateManager = {
    // Global state variables
    selectedTitles: [],
    searchText: "",
    selectedCinemas: [],
    cinemaSearchText: "",
    allKnownTitles: new Set(),
    allKnownCinemas: new Set(),
    currentMovies: [],
    titleDropdownInstance: null,
    cinemaDropdownInstance: null,

    // One-time titles prefetch across upcoming days
    titlesPrefetchDone: false,
    titlesPrefetchPromise: null,

    getUpcomingDates: (days) => {
        const dates = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 0; i < days; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            dates.push(d);
        }
        return dates;
    },

    prefetchKnownTitles: async (days = 7) => {
        // Will be injected by app.js to avoid circular dependency
        const { getAllMovies } = await import('./cinemaService.js').then(m => m.default);

        try {
            const dates = stateManager.getUpcomingDates(days);
            const perDayMovies = await Promise.all(
                dates.map(d => getAllMovies(d).catch(() => []))
            );
            perDayMovies.flat().forEach(m => {
                stateManager.allKnownTitles.add(m.title);
                stateManager.allKnownCinemas.add(m.cinema);
            });
        } catch (e) {
            // swallow prefetch errors; UI will still work with partial options
        }
    },

    ensureTitlesPrefetched: async () => {
        if (stateManager.titlesPrefetchDone) return;
        if (!stateManager.titlesPrefetchPromise) {
            stateManager.titlesPrefetchPromise = stateManager.prefetchKnownTitles(7).finally(() => {
                stateManager.titlesPrefetchDone = true;
            });
        }
        await stateManager.titlesPrefetchPromise;
    }
};

export default stateManager;