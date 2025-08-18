// ---------- Utils ----------
function isFuture(showDate, showTime) {
  const showDateTime = new Date(showDate + " " + showTime);
  return showDateTime > new Date();
}

function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

// Add local YYYY-MM-DD formatter for <input type="date">
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Mobile breakpoint helper and debounce
function isMobileView() {
  return window.matchMedia('(max-width: 768px)').matches;
}
function debounce(fn, wait) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), wait);
  };
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

let selectedTitles = []; // global state to preserve across renders
let searchText = "";     // global search text
let selectedCinemas = []; // cinemas filter state
let cinemaSearchText = ""; // cinema search text
// Track all known options across loads/dates
let allKnownTitles = new Set();
let allKnownCinemas = new Set();
let currentMovies = []; // keep latest movies for header reinit on resize
// Keep references to dropdown instances to refresh their UI on external changes
let titleDropdownInstance = null;
let cinemaDropdownInstance = null;

// One-time titles prefetch across upcoming days
let titlesPrefetchDone = false;
let titlesPrefetchPromise = null;
function getUpcomingDates(days) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}
async function prefetchKnownTitles(days = 7) {
  try {
    const dates = getUpcomingDates(days);
    const perDayMovies = await Promise.all(
      dates.map(d => getAllMovies(d).catch(() => []))
    );
    perDayMovies.flat().forEach(m => { 
      allKnownTitles.add(m.title);
      allKnownCinemas.add(m.cinema);
    });
  } catch (e) {
    // swallow prefetch errors; UI will still work with partial options
  }
}
async function ensureTitlesPrefetched() {
  if (titlesPrefetchDone) return;
  if (!titlesPrefetchPromise) {
    titlesPrefetchPromise = prefetchKnownTitles(7).finally(() => {
      titlesPrefetchDone = true;
    });
  }
  await titlesPrefetchPromise;
}

// Remove swipe/top bar; use bottom toggle instead
let mobileMode = 'browse'; // 'browse' | 'buy'
function setMobileMode(mode) {
  mobileMode = mode;
  updateMobileModeToggle();
  if (currentMovies) renderTable(currentMovies);
}
function updateMobileModeToggle() {
  const btn = document.getElementById('mobileModeToggle');
  if (!btn) return;
  if (!isMobileView()) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'inline-block';
  btn.textContent = mobileMode === 'browse' ? 'Go to Buy' : 'Go to Browse';
}

// ---------- Render Table ----------
function renderTable(movies) {
  const tbody = document.getElementById("moviesTableBody");
  tbody.innerHTML = ""; // only clear rows, not header

  const selectedBox = document.getElementById("selectedContainer");
  if (selectedBox) selectedBox.innerHTML = "";

  updateMobileModeToggle();

  // --- FILTER MOVIES ---
  let filteredMovies = movies;
  if (isMobileView()) {
    // On mobile, cinemas narrow the list; titles are shown as sticky picks but do not filter browse list
    if (selectedCinemas.length > 0) {
      filteredMovies = filteredMovies.filter(m => selectedCinemas.includes(m.cinema));
    }
  } else {
    // Desktop: both filters apply to the table
    if (selectedTitles.length > 0) {
      filteredMovies = filteredMovies.filter(m => selectedTitles.includes(m.title));
    }
    if (selectedCinemas.length > 0) {
      filteredMovies = filteredMovies.filter(m => selectedCinemas.includes(m.cinema));
    }
  }

  // Desktop empty state
  if (!isMobileView() && filteredMovies.length === 0) {
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

  if (isMobileView()) {
    const selectedMovies = moviesToRender.filter(m => selectedTitles.includes(m.title));
    const unselectedMovies = moviesToRender.filter(m => !selectedMovies.includes(m));

    if (mobileMode === 'buy') {
      if (selectedBox) {
        selectedBox.style.display = 'none';
      }
      const list = selectedMovies;
      if (list.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="3" style="text-align:center; font-weight:bold; color:#555;">No selections yet</td>`;
        tbody.appendChild(tr);
      } else {
        list.forEach(movie => tbody.appendChild(buildMovieRow(movies, movie)));
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
        selectedMovies.forEach(movie => tb.appendChild(buildMovieRow(movies, movie)));
        tbl.appendChild(thead);
        tbl.appendChild(tb);
        tbl.style.border = '1px solid #f3e3b0';
        tbl.style.borderRadius = '6px';
        selectedBox.appendChild(tbl);
      }
    }

    unselectedMovies.forEach(movie => tbody.appendChild(buildMovieRow(movies, movie)));
    return;
  }

  // Render main table body (desktop)
  moviesToRender.forEach(movie => {
    const tr = buildMovieRow(movies, movie);
    tbody.appendChild(tr);
  });
}

function buildMovieRow(movies, movie) {
  const tr = document.createElement("tr");

  const titleTd = document.createElement("td");
  const titleCheckbox = document.createElement("input");
  titleCheckbox.type = "checkbox";
  titleCheckbox.checked = selectedTitles.includes(movie.title);
  titleCheckbox.addEventListener("click", (e) => { e.stopPropagation(); });
  titleCheckbox.addEventListener("change", () => {
    if (titleCheckbox.checked && !selectedTitles.includes(movie.title)) {
      selectedTitles.push(movie.title);
    } else if (!titleCheckbox.checked) {
      selectedTitles = selectedTitles.filter(t => t !== movie.title);
    }
    renderTable(movies);
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
  cinemaCheckbox.checked = selectedCinemas.includes(movie.cinema);
  cinemaCheckbox.addEventListener("click", (e) => { e.stopPropagation(); });
  cinemaCheckbox.addEventListener("change", () => {
    if (cinemaCheckbox.checked && !selectedCinemas.includes(movie.cinema)) {
      selectedCinemas.push(movie.cinema);
    } else if (!cinemaCheckbox.checked) {
      selectedCinemas = selectedCinemas.filter(c => c !== movie.cinema);
    }
    renderTable(movies);
    if (cinemaDropdownInstance && cinemaDropdownInstance.render) {
      cinemaDropdownInstance.render();
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

// Reusable checkbox filter dropdown
function createCheckboxFilterDropdown({ items, getSelected, setSelected, getSearchText, setSearchText, placeholder, emptyText, onChange, showSearch = true, listMode = 'selectedOnlyDefault' }) {
  const dropdown = document.createElement("div");
  dropdown.style.position = "absolute";
  dropdown.style.top = "100%";
  dropdown.style.left = "0";
  dropdown.style.background = "#fff";
  dropdown.style.border = "1px solid #ccc";
  dropdown.style.padding = "5px";
  dropdown.style.display = "none";
  dropdown.style.maxHeight = "240px";
  dropdown.style.overflowY = "auto";
  dropdown.style.zIndex = "1000";
  dropdown.style.minWidth = "200px";
  dropdown.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.justifyContent = "space-between";
  controls.style.marginBottom = "5px";

  const clearAllBtn = document.createElement("button");
  clearAllBtn.textContent = "Clear All";
  clearAllBtn.addEventListener("click", () => {
    if (showSearch) {
      setSearchText("");
      searchInput.value = "";
    }
    setSelected([]);
    onChange();
    renderCheckboxes();
  });
  controls.appendChild(clearAllBtn);

  let searchInput = null;
  if (showSearch) {
    searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = placeholder;
    searchInput.style.width = "95%";
    searchInput.style.marginBottom = "5px";
    searchInput.value = getSearchText();
  }

  dropdown.appendChild(controls);
  if (showSearch && searchInput) dropdown.appendChild(searchInput);

  function renderCheckboxes() {
    Array.from(dropdown.querySelectorAll("label, .empty-msg")).forEach(el => el.remove());

    const query = (showSearch && searchInput) ? searchInput.value.toLowerCase() : "";
    const allItems = items();
    const selected = getSelected();

    let itemsToRender;
    if (listMode === 'allWithSelectedFirst') {
      itemsToRender = [...allItems]
        .sort((a, b) => {
          const aSel = selected.includes(a);
          const bSel = selected.includes(b);
          if (aSel && !bSel) return -1;
          if (!aSel && bSel) return 1;
          return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
        });
    } else {
      // selectedOnlyDefault
      itemsToRender = [...allItems];
      if (!query) {
        itemsToRender = itemsToRender.filter(v => selected.includes(v));
      } else {
        itemsToRender = itemsToRender.filter(
          v => String(v).toLowerCase().includes(query) || selected.includes(v)
        );
      }
    }

    if (itemsToRender.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-msg";
      empty.textContent = emptyText;
      empty.style.padding = "6px";
      empty.style.color = "#666";
      dropdown.appendChild(empty);
      return;
    }

    itemsToRender.forEach(value => {
      const label = document.createElement("label");
      label.style.display = "block";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      checkbox.checked = selected.includes(value);

      checkbox.addEventListener("change", () => {
        let next = getSelected();
        if (checkbox.checked && !next.includes(value)) {
          next = [...next, value];
        } else {
          next = next.filter(v => v !== value);
        }
        setSelected(next);
        onChange();
        renderCheckboxes();
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + value));
      dropdown.appendChild(label);
    });
  }

  let isDragging = false;
  if (showSearch && searchInput) {
    searchInput.addEventListener("mousedown", () => { isDragging = true; });
    document.addEventListener("mouseup", () => { setTimeout(() => isDragging = false, 0); });
    searchInput.addEventListener("input", () => {
      setSearchText(searchInput.value);
      renderCheckboxes();
    });
  }

  renderCheckboxes();

  return {
    container: dropdown,
    searchInput,
    render: renderCheckboxes,
    open: () => {
      if (showSearch && searchInput) {
        setSearchText("");
        searchInput.value = "";
        renderCheckboxes();
        setTimeout(() => searchInput.focus(), 0);
      }
    },
    isDragging: () => isDragging,
  };
}

// ---------- Initialize Header Dropdown ----------
function initHeaderDropdown(movies) {
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
  cinemaIcon.style.color = "#666";
  thCinema.appendChild(cinemaIcon);

  const cinemaDropdown = createCheckboxFilterDropdown({
    items: () => Array.from(allKnownCinemas),
    getSelected: () => selectedCinemas,
    setSelected: (next) => { selectedCinemas = next; },
    getSearchText: () => cinemaSearchText,
    setSearchText: (v) => { cinemaSearchText = v; },
    placeholder: "Search cinema...",
    emptyText: "No cinemas",
    onChange: () => renderTable(movies),
    showSearch: false,
    listMode: 'allWithSelectedFirst',
  });
  thCinema.appendChild(cinemaDropdown.container);
  thCinema.addEventListener("click", (e) => {
    e.stopPropagation();
    const willShow = cinemaDropdown.container.style.display === "none";
    cinemaDropdown.container.style.display = willShow ? "block" : "none";
    if (willShow) cinemaDropdown.open();
  });
  cinemaDropdown.container.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", (e) => {
    if (cinemaDropdown.isDragging()) return;
    if (!cinemaDropdown.container.contains(e.target) && e.target !== thCinema) {
      cinemaDropdown.container.style.display = "none";
    }
  });
  cinemaDropdownInstance = cinemaDropdown; // Assign instance

  // Desktop-only: Title dropdown remains
  if (!isMobileView()) {
    const titleIcon = document.createElement("span");
    titleIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>';
    titleIcon.style.marginLeft = "6px";
    titleIcon.style.verticalAlign = "middle";
    titleIcon.style.color = "#666";
    thTitle.appendChild(titleIcon);

    const titleDropdown = createCheckboxFilterDropdown({
      items: () => Array.from(allKnownTitles),
      getSelected: () => selectedTitles,
      setSelected: (next) => { selectedTitles = next; },
      getSearchText: () => searchText,
      setSearchText: (v) => { searchText = v; },
      placeholder: "Search title...",
      emptyText: "No selected titles",
      onChange: () => renderTable(movies),
      showSearch: true,
      listMode: 'selectedOnlyDefault',
    });
    thTitle.appendChild(titleDropdown.container);
    thTitle.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = titleDropdown.container.style.display === "none";
      titleDropdown.container.style.display = willShow ? "block" : "none";
      if (willShow) titleDropdown.open();
    });
    titleDropdown.container.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", (e) => {
      if (titleDropdown.isDragging()) return;
      if (!titleDropdown.container.contains(e.target) && e.target !== thTitle) {
        titleDropdown.container.style.display = "none";
      }
    });
    titleDropdownInstance = titleDropdown; // Assign instance
  }
}

// Hook up bottom mode toggle
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('mobileModeToggle');
  if (btn) {
    btn.addEventListener('click', () => setMobileMode(mobileMode === 'browse' ? 'buy' : 'browse'));
  }
});


// ---------- Initialize ----------
async function init() {
  const dateInput = document.getElementById("datePicker");
  if (!dateInput.value) {
    dateInput.value = formatDateForInput(new Date());
  }
  const selectedDate = new Date(dateInput.value);
  await ensureTitlesPrefetched(); // Prefetch titles for the current date
  const movies = await getAllMovies(selectedDate);
  // update known options across dates
  movies.forEach(m => { allKnownTitles.add(m.title); allKnownCinemas.add(m.cinema); });
  currentMovies = movies;
  initHeaderDropdown(movies);
  renderTable(movies);
}

// Re-init header on viewport changes (debounced)
window.addEventListener('resize', debounce(() => {
  if (currentMovies && currentMovies.length >= 0) {
    initHeaderDropdown(currentMovies);
  }
}, 150));

// ---------- Event Listener ----------
document.getElementById("datePicker").addEventListener("change", init);

// ---------- Run on load ----------
window.addEventListener("DOMContentLoaded", init);
