// ---------- Utils ----------
function isFuture(showDate, showTime) {
  const showDateTime = new Date(showDate + " " + showTime);
  return showDateTime > new Date();
}

function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
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

// ---------- Render Table ----------
function renderTable(movies) {
  const tbody = document.getElementById("moviesTableBody");
  tbody.innerHTML = ""; // only clear rows, not header

  // --- FILTER MOVIES ---
  let filteredMovies = selectedTitles.length > 0 
    ? movies.filter(m => selectedTitles.includes(m.title)) 
    : movies;

  if (filteredMovies.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" style="text-align:center; font-weight:bold; color:#555;">
                        No movies found 😢
                    </td>`;
    tbody.appendChild(tr);
    return;
  }

  filteredMovies
    .sort((a, b) => a.time - b.time)
    .forEach(movie => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${movie.title}</td>
          <td>${movie.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${movie.cinema}</td>
      `;
      tr.addEventListener("click", () => {
          window.open(movie.url, "_blank");
      });
      tbody.appendChild(tr);
  });
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

  header.appendChild(thTitle);
  header.appendChild(thTime);
  header.appendChild(thCinema);
  thead.appendChild(header);

  const dropdown = document.createElement("div");
  dropdown.id = "titleDropdown";
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

  // --- Controls (Clear All + Show Selected) ---
  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.justifyContent = "space-between";
  controls.style.marginBottom = "5px";

  const clearAllBtn = document.createElement("button");
  clearAllBtn.textContent = "Clear All";
  clearAllBtn.addEventListener("click", () => {
    searchText = "";
    searchInput.value = "";
    selectedTitles = [];
    renderTable(movies);
    renderCheckboxes();
  });

  controls.appendChild(clearAllBtn);

  // --- Search input ---
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search title...";
  searchInput.style.width = "95%";
  searchInput.style.marginBottom = "5px";
  searchInput.value = searchText;

  dropdown.appendChild(controls);
  dropdown.appendChild(searchInput);

  const uniqueTitles = [...new Set(movies.map(m => m.title))];
  let showSelectedOnly = false;

  function renderCheckboxes() {
    // remove old checkboxes
    Array.from(dropdown.querySelectorAll("label")).forEach(el => el.remove());

    const query = searchInput.value.toLowerCase();

    let titlesToRender = [...uniqueTitles];
      titlesToRender = titlesToRender.filter(
        t => t.toLowerCase().includes(query) || selectedTitles.includes(t)
      );

    titlesToRender.forEach(title => {
      const label = document.createElement("label");
      label.style.display = "block";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = title;
      checkbox.checked = selectedTitles.includes(title);

      checkbox.addEventListener("change", () => {
        if (checkbox.checked && !selectedTitles.includes(title)) {
          selectedTitles.push(title);
        } else {
          selectedTitles = selectedTitles.filter(t => t !== title);
        }
        renderTable(movies);
        renderCheckboxes(); // refresh checkboxes
      });

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + title));
      dropdown.appendChild(label);
    });
  }

  renderCheckboxes();

  // --- Keep dropdown open when dragging/selecting ---
  let isDragging = false;
  searchInput.addEventListener("mousedown", () => { isDragging = true; });
  document.addEventListener("mouseup", () => { setTimeout(() => isDragging = false, 0); });

  searchInput.addEventListener("input", () => {
    searchText = searchInput.value;
    renderCheckboxes();
  });

  thTitle.appendChild(dropdown);

  // Toggle dropdown on header click
  thTitle.addEventListener("click", (e) => {
    e.stopPropagation();
    const willShow = dropdown.style.display === "none";
    dropdown.style.display = willShow ? "block" : "none";
    if (willShow) {
      setTimeout(() => searchInput.focus(), 0);
    }
  });

  dropdown.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", (e) => {
    if (isDragging) return;
    if (!dropdown.contains(e.target) && e.target !== thTitle) {
      dropdown.style.display = "none";
    }
  });
}



// ---------- Initialize ----------
async function init() {
  const dateInput = document.getElementById("datePicker");
  const selectedDate = dateInput.value ? new Date(dateInput.value) : new Date();
  const movies = await getAllMovies(selectedDate);
  initHeaderDropdown(movies);
  renderTable(movies);
}

// ---------- Event Listener ----------
document.getElementById("datePicker").addEventListener("change", init);

// ---------- Run on load ----------
window.addEventListener("DOMContentLoaded", init);
