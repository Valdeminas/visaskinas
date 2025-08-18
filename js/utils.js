const utils = {
    isFuture: (showDate, showTime) => {
        const showDateTime = new Date(showDate + " " + showTime);
        return showDateTime > new Date();
    },

    formatDate: (date) => {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    },

    formatDateForInput: (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    isMobileView: () => {
        return window.matchMedia('(max-width: 768px)').matches;
    },

    debounce: (fn, wait) => {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), wait);
        };
    },

    parseTime: (timeString) => {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }
};

export default utils;