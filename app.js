// ---------- Utils ----------
function formatDate(date) {
	const d = new Date(date);
	return d.toISOString().split('T')[0];
}

function formatDateForInput(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function labelForDate(date) {
	const today = new Date();
	today.setHours(0,0,0,0);
	const cmp = new Date(date);
	cmp.setHours(0,0,0,0);
	const diff = Math.round((cmp - today) / (1000*60*60*24));
	if (diff === 0) return 'Today';
	if (diff === 1) return 'Tomorrow';
	return cmp.toLocaleDateString('en-GB', { weekday: 'long' });
}

// ---------- Data sources ----------
async function parseForumLike(cinemaRoot,date,theatreId) {
	const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
	const url = `https://www.${cinemaRoot}.lt/xml/Schedule?dt=${formattedDate}&area=${theatreId}`;
	const response = await fetch(url);
	const text = await response.text();
	const data = JSON.parse(text);
	const now = new Date();
	const movies = data.Shows
			.map(show => ({
				title: show.Title || "",
				time: new Date(show.dttmShowStart),
				cinema: show.Theatre || "",
				url: show.ShowURL || ""
			}))
			.filter(show => show.time > now);
	return movies;
}

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
			.filter(show => show.time > now);
	return movies;
}

async function parseSkalvija(selectedDate) {
	const selectedYear = selectedDate.getFullYear();
	const selectedMonth = selectedDate.getMonth();
	const selectedDay = selectedDate.getDate();
	const url = "https://skalvija.lt/wp-json/data/v1/get_shows/";
	const res = await fetch(url);
	const json = await res.json();
	if (!json) return [];
	const { shows, events } = json;
	const eventMap = {};
	events.forEach(event => { eventMap[event._id] = event; });
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
	.filter(show => show.time > now);
	return movies;
}

async function getAllMovies(selectedDate) {
	const results = await Promise.all([
		parseForumLike('forumcinemas',selectedDate,1011),
		parsePasaka(formatDate(selectedDate)),
		parseSkalvija(selectedDate),
		parseForumLike('apollokinas',selectedDate,1019),
		parseForumLike('apollokinas',selectedDate,1024),
	]);
	return results.flat();
}

// ---------- Simplified state and UI (mockup style) ----------
let currentMovies = [];
let hiddenTitles = new Set();



function groupByTitle(movies) {
	const map = new Map();
	const sorted = [...movies].sort((a,b) => a.time - b.time);
	for (const m of sorted) {
		if (!map.has(m.title)) map.set(m.title, []);
		map.get(m.title).push(m);
	}
	return map;
}

function renderList(movies) {
	const container = document.getElementById('moviesList');
	if (!container) return;
	container.innerHTML = '';
	const byTitle = groupByTitle(movies);
	const titles = Array.from(byTitle.keys());
	for (const title of titles) {
		if (hiddenTitles.has(title)) continue;
		let shows = byTitle.get(title);
		if (shows.length === 0) continue;
		const card = document.createElement('div');
		card.className = 'card';
		
		// Create card content wrapper
		const cardContent = document.createElement('div');
		cardContent.className = 'card-content';
		
		const header = document.createElement('div');
		header.className = 'card-header';
		const h = document.createElement('h2');
		h.className = 'card-title';
		h.textContent = title;
		const close = document.createElement('button');
		close.className = 'close-btn';
		close.textContent = '×';
		close.addEventListener('click', (e) => { 
			// Prevent event bubbling to avoid triggering other card events
			e.preventDefault();
			e.stopPropagation();
			
			// Add collapsing class for animation
			card.classList.add('collapsing');
			
			// Wait for animation to complete, then remove from DOM and add to hidden titles
			setTimeout(() => {
				hiddenTitles.add(title);
				card.remove(); // Remove from DOM without redrawing the whole list
			}, 300); // Match the CSS transition duration (0.3 seconds)
		});
		header.appendChild(h);
		header.appendChild(close);
		cardContent.appendChild(header);
		// Group by cinema: show earliest time and a +N expander for the rest
		const byCinema = new Map();
		for (const s of shows) {
			if (!byCinema.has(s.cinema)) byCinema.set(s.cinema, []);
			byCinema.get(s.cinema).push(s);
		}
		for (const list of byCinema.values()) list.sort((a,b) => a.time - b.time);
		const cinemas = Array.from(byCinema.keys()).sort((a,b) => byCinema.get(a)[0].time - byCinema.get(b)[0].time);
		cinemas.forEach(cinemaName => {
			const list = byCinema.get(cinemaName);
			const row = document.createElement('div');
			row.className = 'time-row';

			const earliest = list[0];
			const time = document.createElement('a');
			time.className = 'time';
			time.href = earliest.url;
			time.target = '_blank';
			time.rel = 'noopener noreferrer';
			time.textContent = earliest.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });

			const cinemaWrap = document.createElement('span');
			cinemaWrap.className = 'cinema';
			const cinemaText = document.createElement('span');
			cinemaText.textContent = cinemaName;



			const extraCount = Math.max(0, list.length - 1);
			let expanded = false;
			let extraContainer = null;
			let moreBtn = null;
			if (extraCount > 0) {
				moreBtn = document.createElement('button');
				moreBtn.className = 'more-btn';
				moreBtn.textContent = `+${extraCount}`;
				moreBtn.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					expanded = !expanded;
					if (!extraContainer) return;
					
					if (expanded) {
						extraContainer.classList.add('expanded');
						moreBtn.textContent = '−';
					} else {
						extraContainer.classList.remove('expanded');
						moreBtn.textContent = `+${extraCount}`;
					}
				});
			}

			row.appendChild(time);
			cinemaWrap.appendChild(cinemaText);
			row.appendChild(cinemaWrap);
			if (moreBtn) row.appendChild(moreBtn);
			cardContent.appendChild(row);

			if (extraCount > 0) {
				extraContainer = document.createElement('div');
				extraContainer.className = 'times';
				list.slice(1).forEach(s => {
					const t = document.createElement('a');
					t.href = s.url;
					t.target = '_blank';
					t.rel = 'noopener noreferrer';
					t.textContent = s.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
					t.style.border = '1px solid #eee';
					t.style.borderRadius = '10px';
					t.style.padding = '2px 6px';
					t.style.fontSize = '12px';
					t.style.textDecoration = 'none';
					t.style.color = '#111';
					extraContainer.appendChild(t);
				});
				cardContent.appendChild(extraContainer);
			}
		});
		
		// Add card content to card
		card.appendChild(cardContent);
		
		// Create swipe actions (delete indicator)
		const cardActions = document.createElement('div');
		cardActions.className = 'card-actions';
		const deleteIndicator = document.createElement('div');
		deleteIndicator.className = 'delete-indicator';
		deleteIndicator.textContent = 'Delete';
		cardActions.appendChild(deleteIndicator);
		card.appendChild(cardActions);
		
		container.appendChild(card);
		
		// Add swipe functionality
		addSwipeHandlers(card);
	}
	if (!container.children.length) {
		const empty = document.createElement('div');
		empty.className = 'muted';
		empty.textContent = 'No movies found';
		container.appendChild(empty);
	} else {
		// Add a spacer div at the end to prevent sticky date picker from overlapping content
		const spacer = document.createElement('div');
		spacer.style.height = '80px';
		spacer.style.width = '100%';
		container.appendChild(spacer);
	}
}

async function init() {
	const dateInput = document.getElementById('datePicker');

	const dateLabel = document.getElementById('dateLabel');
	if (!dateInput.value) dateInput.value = formatDateForInput(new Date());

	dateLabel.textContent = labelForDate(new Date(dateInput.value));
	const selectedDate = new Date(dateInput.value);
	hiddenTitles = new Set();
	currentMovies = await getAllMovies(selectedDate);
	renderList(currentMovies);
	dateInput.onchange = async () => {
		// First, fetch new data while current content is still visible
		const newDate = new Date(dateInput.value);
		const newMovies = await getAllMovies(newDate);
		
		// Now fade out current content
		const moviesContainer = document.getElementById('moviesList');
		const dateLabelContainer = document.querySelector('.date-label-container');
		
		moviesContainer.classList.add('fade-out');
		dateLabelContainer.classList.add('fade-out');
		
		// Wait for fade out, then update content and fade back in
		setTimeout(async () => {
			dateLabel.textContent = labelForDate(newDate);
			hiddenTitles = new Set();
			currentMovies = newMovies;
			renderList(currentMovies);
			
			// Fade back in
			moviesContainer.classList.remove('fade-out');
			dateLabelContainer.classList.remove('fade-out');
		}, 300); // Match the CSS transition duration
	};

	// Date navigation buttons
	const prevDateBtn = document.getElementById('prevDateBtn');
	const nextDateBtn = document.getElementById('nextDateBtn');

	prevDateBtn.addEventListener('click', async () => {
		const currentDate = new Date(dateInput.value);
		currentDate.setDate(currentDate.getDate() - 1);
		dateInput.value = formatDateForInput(currentDate);
		dateInput.dispatchEvent(new Event('change'));
	});

	nextDateBtn.addEventListener('click', async () => {
		const currentDate = new Date(dateInput.value);
		currentDate.setDate(currentDate.getDate() + 1);
		dateInput.value = formatDateForInput(currentDate);
		dateInput.dispatchEvent(new Event('change'));
	});



}

// Swipe functionality for cards
function addSwipeHandlers(card) {
	let startX = 0;
	let currentX = 0;
	let isDragging = false;
	let startTime = 0;
	
	// Touch events
	card.addEventListener('touchstart', (e) => {
		// Don't start swipe if clicking on interactive elements
		if (e.target.closest('button, a, .more-btn')) return;
		
		startX = e.touches[0].clientX;
		currentX = e.touches[0].clientX; // Initialize currentX to startX to prevent false deltas
		startTime = Date.now();
		isDragging = true;
		card.style.transition = 'none';
	});
	
	card.addEventListener('touchmove', (e) => {
		if (!isDragging) return;
		e.preventDefault();
		currentX = e.touches[0].clientX;
		const deltaX = currentX - startX;
		
		if (deltaX < 0) { // Only allow left swipe
			const translateX = Math.max(deltaX, -80);
			card.querySelector('.card-content').style.transform = `translateX(${translateX}px)`;
			card.querySelector('.card-actions').style.transform = `translateX(${translateX + 80}px)`;
		}
	});
	
	card.addEventListener('touchend', (e) => {
		if (!isDragging) return;
		isDragging = false;
		card.style.transition = '';
		
		const deltaX = currentX - startX;
		const deltaTime = Date.now() - startTime;
		const velocity = Math.abs(deltaX) / deltaTime;
		
		// Only trigger swipe actions if there was significant movement and time
		// This prevents accidental triggers from simple taps
		if (Math.abs(deltaX) < 20 || deltaTime < 150 || deltaX === 0) {
			// Very small movement, too quick, or no movement - treat as a tap, not a swipe
			card.classList.remove('swiped');
		} else if (deltaX < -80) {
			// Swiped far enough to delete - don't reset transforms
			card.classList.add('swiped');

			card.classList.add('collapsing');
			setTimeout(() => {
				const title = card.querySelector('.card-title').textContent;
				hiddenTitles.add(title);
				card.remove();
			}, 300);
		}  else {
			// Not swiped enough, reset
			card.classList.remove('swiped');
		}
		
		// Always reset transform styles after touch ends
		card.querySelector('.card-content').style.transform = '';
		card.querySelector('.card-actions').style.transform = '';
	});
	
	// Mouse events for desktop
	card.addEventListener('mousedown', (e) => {
		// Don't start swipe if clicking on interactive elements
		if (e.target.closest('button, a, .more-btn')) return;
		
		startX = e.clientX;
		currentX = e.clientX; // Initialize currentX to startX to prevent false deltas
		startTime = Date.now();
		isDragging = true;
		card.style.transition = 'none';
		card.style.cursor = 'grabbing';
	});
	
	card.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
		currentX = e.clientX;
		const deltaX = currentX - startX;
		
		if (deltaX < 0) { // Only allow left swipe
			const translateX = Math.max(deltaX, -80);
			card.querySelector('.card-content').style.transform = `translateX(${translateX}px)`;
			card.querySelector('.card-actions').style.transform = `translateX(${translateX + 80}px)`;
		}
	});
	
	card.addEventListener('mouseup', (e) => {
		if (!isDragging) return;
		isDragging = false;
		card.style.transition = '';
		card.style.cursor = '';
		
		const deltaX = currentX - startX;
		const deltaTime = Date.now() - startTime;
		const velocity = Math.abs(deltaX) / deltaTime;
		
		// Only trigger swipe actions if there was significant movement and time
		// This prevents accidental triggers from simple clicks
		if (Math.abs(deltaX) < 20 || deltaTime < 150 || deltaX === 0) {
			// Very small movement, too quick, or no movement - treat as a click, not a swipe
			card.classList.remove('swiped');
		} else if (deltaX < -80) {
			// Swiped far enough to delete - don't reset transforms
			card.classList.add('collapsing');
			setTimeout(() => {
				const title = card.querySelector('.card-title').textContent;
				hiddenTitles.add(title);
				card.remove();
			}, 300);
		} else if (deltaX < -40 || (deltaX < -20 && velocity > 0.3)) {
			// Swiped enough to show delete indicator
			card.classList.add('swiped');
		} else {
			// Not swiped enough, reset
			card.classList.remove('swiped');
		}
		
		// Always reset transform styles after mouse up
		card.querySelector('.card-content').style.transform = '';
		card.querySelector('.card-actions').style.transform = '';
	});
	
	// Remove the click outside handler that was closing cards
	// Now only X button and left swipe can close cards
}

window.addEventListener('DOMContentLoaded', init);
