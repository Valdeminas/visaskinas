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
    perDayMovies.flat().forEach(m => allKnownTitles.add(m.title));
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

// Mobile mode state and swipe handling
let mobileMode = 'browse'; // 'browse' | 'buy'
let touchStartX = null;
let touchStartY = null;
function setMobileMode(mode) {
  mobileMode = mode;
  renderMobileModeBar();
  if (currentMovies) renderTable(currentMovies);
}
function renderMobileModeBar() {
  const bar = document.getElementById('mobileModeBar');
  if (!bar) return;
  if (!isMobileView()) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'block';
  bar.innerHTML = '';

  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.justifyContent = 'space-between';
  container.style.alignItems = 'center';

  const left = document.createElement('div');
  const browseBtn = document.createElement('button');
  browseBtn.textContent = 'Browse';
  browseBtn.disabled = mobileMode === 'browse';
  const buyBtn = document.createElement('button');
  buyBtn.textContent = 'Buy';
  buyBtn.disabled = mobileMode === 'buy';
  browseBtn.addEventListener('click', () => setMobileMode('browse'));
  buyBtn.addEventListener('click', () => setMobileMode('buy'));
  left.appendChild(browseBtn);
  left.appendChild(document.createTextNode(' '));
  left.appendChild(buyBtn);

  const right = document.createElement('div');
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    selectedTitles = [];
    selectedCinemas = [];
    renderTable(currentMovies || []);
  });
  right.appendChild(clearBtn);

  container.appendChild(left);
  container.appendChild(right);
  bar.appendChild(container);

  // Swipe hint
  const hint = document.createElement('div');
  hint.style.fontSize = '12px';
  hint.style.color = '#666';
  hint.style.marginTop = '6px';
  hint.textContent = 'Swipe left/right to switch modes';
  bar.appendChild(hint);
}

function attachSwipeHandlers(root) {
  if (!root) return;
  root.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    touchStartX = null; touchStartY = null;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 30) {
      if (dx < 0 && mobileMode !== 'buy') setMobileMode('buy');
      else if (dx > 0 && mobileMode !== 'browse') setMobileMode('browse');
    }
  }, { passive: true });
}

// ---------- Render Table ----------
function renderTable(movies) {
  const tbody = document.getElementById("moviesTableBody");
  tbody.innerHTML = ""; // only clear rows, not header

  const selectedBox = document.getElementById("selectedContainer");
  if (selectedBox) selectedBox.innerHTML = "";

  renderMobileModeBar();
  attachSwipeHandlers(document.body);

  // --- FILTER MOVIES ---
  let filteredMovies = movies;
  if (!isMobileView()) {
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

  // Mobile: buy mode shows only selected; browse mode shows all with sticky selected table
  if (isMobileView()) {
    const selectedMovies = moviesToRender.filter(m => selectedTitles.includes(m.title) || selectedCinemas.includes(m.cinema));
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

    // browse mode: sticky table for selected, main table for unselected
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
function createCheckboxFilterDropdown({ items, getSelected, setSelected, getSearchText, setSearchText, placeholder, emptyText, onChange }) {
  const dropdown = document.createElement("div");
  dropdown.style.position = "absolute";
  dropdown.style.top = "100%";
  dropdown.style.left = "0";
  dropdown.style.background = "#fff";
  dropdown.style.border = "1px solid #ccc";
  dropdown.style.padding = "5px";
  dropdown.style.display = "none";
  dropdown.style.maxHeight = "200px";
  dropdown.style.overflowY = "auto";
  dropdown.style.zIndex = "1000";
  dropdown.style.minWidth = "180px";
  dropdown.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.justifyContent = "space-between";
  controls.style.marginBottom = "5px";

  const clearAllBtn = document.createElement("button");
  clearAllBtn.textContent = "Clear All";
  clearAllBtn.addEventListener("click", () => {
    setSearchText("");
    searchInput.value = "";
    setSelected([]);
    onChange();
    renderCheckboxes();
  });
  controls.appendChild(clearAllBtn);

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = placeholder;
  searchInput.style.width = "95%";
  searchInput.style.marginBottom = "5px";
  searchInput.value = getSearchText();

  dropdown.appendChild(controls);
  dropdown.appendChild(searchInput);

  function renderCheckboxes() {
    Array.from(dropdown.querySelectorAll("label, .empty-msg")).forEach(el => el.remove());

    const query = searchInput.value.toLowerCase();
    const allItems = items();
    const selected = getSelected();

    let itemsToRender = [...allItems];
    if (!query) {
      itemsToRender = itemsToRender.filter(v => selected.includes(v));
    } else {
      itemsToRender = itemsToRender.filter(
        v => v.toLowerCase().includes(query) || selected.includes(v)
      );
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
  searchInput.addEventListener("mousedown", () => { isDragging = true; });
  document.addEventListener("mouseup", () => { setTimeout(() => isDragging = false, 0); });

  searchInput.addEventListener("input", () => {
    setSearchText(searchInput.value);
    renderCheckboxes();
  });

  renderCheckboxes();

  return {
    container: dropdown,
    searchInput,
    render: renderCheckboxes,
    open: () => {
      setSearchText("");
      searchInput.value = "";
      renderCheckboxes();
      setTimeout(() => searchInput.focus(), 0);
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

  // Desktop-only: show icons and dropdowns
  if (!isMobileView()) {
    const titleIcon = document.createElement("span");
    titleIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>';
    titleIcon.style.marginLeft = "6px";
    titleIcon.style.verticalAlign = "middle";
    titleIcon.style.color = "#666";
    thTitle.appendChild(titleIcon);

    const cinemaIcon = document.createElement("span");
    cinemaIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>';
    cinemaIcon.style.marginLeft = "6px";
    cinemaIcon.style.verticalAlign = "middle";
    cinemaIcon.style.color = "#666";
    thCinema.appendChild(cinemaIcon);

    // Title dropdown
    const titleDropdown = createCheckboxFilterDropdown({
      items: () => Array.from(allKnownTitles),
      getSelected: () => selectedTitles,
      setSelected: (next) => { selectedTitles = next; },
      getSearchText: () => searchText,
      setSearchText: (v) => { searchText = v; },
      placeholder: "Search title...",
      emptyText: "No selected titles",
      onChange: () => renderTable(movies),
    });
    thTitle.appendChild(titleDropdown.container);

    thTitle.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = titleDropdown.container.style.display === "none";
      titleDropdown.container.style.display = willShow ? "block" : "none";
      if (willShow) {
        titleDropdown.open();
      }
    });
    titleDropdown.container.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", (e) => {
      if (titleDropdown.isDragging()) return;
      if (!titleDropdown.container.contains(e.target) && e.target !== thTitle) {
        titleDropdown.container.style.display = "none";
      }
    });

    // Cinema dropdown
    const cinemaDropdown = createCheckboxFilterDropdown({
      items: () => Array.from(allKnownCinemas),
      getSelected: () => selectedCinemas,
      setSelected: (next) => { selectedCinemas = next; },
      getSearchText: () => cinemaSearchText,
      setSearchText: (v) => { cinemaSearchText = v; },
      placeholder: "Search cinema...",
      emptyText: "No selected cinemas",
      onChange: () => renderTable(movies),
    });
    thCinema.appendChild(cinemaDropdown.container);

    thCinema.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = cinemaDropdown.container.style.display === "none";
      cinemaDropdown.container.style.display = willShow ? "block" : "none";
      if (willShow) {
        cinemaDropdown.open();
      }
    });
    cinemaDropdown.container.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", (e) => {
      if (cinemaDropdown.isDragging()) return;
      if (!cinemaDropdown.container.contains(e.target) && e.target !== thCinema) {
        cinemaDropdown.container.style.display = "none";
      }
    });
  }
}



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
