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

// Mobile keyboard handling utilities
function isMobileDevice() {
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIPhone() {
	return /iPhone|iPod/i.test(navigator.userAgent);
}

function handleMobileKeyboard() {
	if (!isMobileDevice()) return;
	
	// Special handling for iPhone
	if (isIPhone()) {
		handleIPhoneKeyboard();
		return;
	}
	
	// Ensure search input stays visible on mobile
	const searchInput = document.getElementById('searchInput');
	const searchControls = document.getElementById('searchControls');
	
	if (searchInput && searchControls && !searchControls.classList.contains('hidden')) {
		// On mobile, ensure the search input is visible when keyboard appears
		setTimeout(() => {
			searchInput.scrollIntoView({ 
				behavior: 'smooth', 
				block: 'center',
				inline: 'nearest'
			});
		}, 100);
	}
}

function handleIPhoneKeyboard() {
	// iPhone-specific keyboard handling
	const searchInput = document.getElementById('searchInput');
	const searchControls = document.getElementById('searchControls');
	
	if (searchInput && searchControls && !searchControls.classList.contains('hidden')) {
		// On iPhone, we don't scroll the page, just ensure the input is accessible
		setTimeout(() => {
			// Ensure the search controls are visible without moving the page
			if (searchControls) {
				searchControls.style.position = 'relative';
				searchControls.style.zIndex = '1001';
			}
		}, 100);
	}
}

function ensureSearchVisibility() {
	if (!isMobileDevice()) return;
	
	// Special handling for iPhone
	if (isIPhone()) {
		ensureIPhoneSearchVisibility();
		return;
	}
	
	const searchInput = document.getElementById('searchInput');
	const searchControls = document.getElementById('searchControls');
	
	if (searchInput && searchControls && !searchControls.classList.contains('hidden')) {
		// Ensure search controls are visible and accessible
		searchControls.style.position = 'relative';
		searchControls.style.zIndex = '1001';
		
		// Scroll to keep search input visible
		setTimeout(() => {
			const stickyContainer = document.querySelector('.sticky-date-container');
			if (stickyContainer) {
				stickyContainer.scrollIntoView({ 
					behavior: 'smooth', 
					block: 'end',
					inline: 'nearest'
				});
			}
		}, 150);
	}
}

function ensureIPhoneSearchVisibility() {
	// iPhone-specific search visibility handling
	const searchInput = document.getElementById('searchInput');
	const searchControls = document.getElementById('searchControls');
	
	if (searchInput && searchControls && !searchControls.classList.contains('hidden')) {
		// On iPhone, ensure the search interface stays accessible without page movement
		searchControls.style.position = 'relative';
		searchControls.style.zIndex = '1001';
		
		// Don't scroll the page on iPhone - let the viewport handle it
		setTimeout(() => {
			// Ensure the search input is focused and visible
			if (searchInput) {
				searchInput.focus();
			}
		}, 100);
	}
}

// Loading state management
function showLoading() {
	const loadingOverlay = document.getElementById('loadingOverlay');
	if (loadingOverlay) {
		loadingOverlay.classList.remove('hidden');
	}
	
	// Disable all interactive elements
	disableInteractions();
}

function hideLoading() {
	const loadingOverlay = document.getElementById('loadingOverlay');
	if (loadingOverlay) {
		loadingOverlay.classList.add('hidden');
	}
	
	// Re-enable all interactive elements
	enableInteractions();
}

function disableInteractions() {
	// Disable date picker
	const dateInput = document.getElementById('datePicker');
	if (dateInput) {
		dateInput.disabled = true;
	}
	
	// Disable navigation buttons
	const prevDateBtn = document.getElementById('prevDateBtn');
	const nextDateBtn = document.getElementById('nextDateBtn');
	if (prevDateBtn) prevDateBtn.disabled = true;
	if (nextDateBtn) nextDateBtn.disabled = true;
	
	// Disable search toggle
	const searchToggleBtn = document.getElementById('searchToggleBtn');
	if (searchToggleBtn) {
		searchToggleBtn.disabled = true;
	}
	
	// Disable search input if visible
	const searchInput = document.getElementById('searchInput');
	if (searchInput) {
		searchInput.disabled = true;
	}
	
	// Disable clear search button if visible
	const clearSearchBtn = document.getElementById('clearSearchBtn');
	if (clearSearchBtn) {
		clearSearchBtn.disabled = true;
	}
}

function enableInteractions() {
	// Re-enable date picker
	const dateInput = document.getElementById('datePicker');
	if (dateInput) {
		dateInput.disabled = false;
	}
	
	// Re-enable navigation buttons
	const prevDateBtn = document.getElementById('prevDateBtn');
	const nextDateBtn = document.getElementById('nextDateBtn');
	if (prevDateBtn) prevDateBtn.disabled = false;
	if (nextDateBtn) nextDateBtn.disabled = false;
	
	// Re-enable search toggle
	const searchToggleBtn = document.getElementById('searchToggleBtn');
	if (searchToggleBtn) {
		searchToggleBtn.disabled = false;
	}
	
	// Re-enable search input if visible
	const searchInput = document.getElementById('searchInput');
	if (searchInput) {
		searchInput.disabled = false;
	}
	
	// Re-enable clear search button if visible
	const clearSearchBtn = document.getElementById('clearSearchBtn');
	if (clearSearchBtn) {
		clearSearchBtn.disabled = false;
	}
}

// ---------- Data sources ----------
async function parseForumLike(cinemaRoot,theatreId) {
	const url = `https://www.${cinemaRoot}.lt/xml/Schedule?area=${theatreId}&nrOfDays=31`;
	const response = await fetch(url);
	const text = await response.text();
	const data = JSON.parse(text);
	const now = new Date();
	const movies = data.Shows
			.map(show => ({
				title: show.Title || "",
				time: new Date(show.dttmShowStart),
				cinema: show.Theatre || "",
				url: show.ShowURL || "",
				originalTitle: show.OriginalTitle || ""
			}))
			.filter(show => show.time > now);
	return movies;
}

async function parsePasaka() {
	const url = `https://api.pasaka.lt/movies`;
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
					originalTitle: event.original_name
				}))
			)
			.filter(show => show.time > now);
	return movies;
}

async function parseSkalvija() {
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
			url: 'https://www.skalvija.lt'+event.link+`?show=${show._id}`,
			originalTitle: event.title_originalo_kalba
		};
	})
	.filter(show => show.time > now);
	return movies;
}

async function getAllMovies() {
	const results = await Promise.all([
		parseForumLike('forumcinemas',1011),
		parsePasaka(),
		parseSkalvija(),
		parseForumLike('apollokinas',1019),
		parseForumLike('apollokinas',1024),
	]);
	return results.flat();
}

function filterMoviesBySearch(movies, query) {
	if (!query || query.trim() === '') {
		return movies;
	}
	
	const searchTerm = query.toLowerCase().trim();
	return movies.filter(movie => {
		const title = movie.title.toLowerCase();
		const originalTitle = (movie.originalTitle || '').toLowerCase();
		return title.includes(searchTerm) || originalTitle.includes(searchTerm);
	});
}

function updateSearchResultsCount() {
	const searchResultsCount = document.getElementById('searchResultsCount');
	const searchNote = document.getElementById('searchNote');
	const dateFilterNote = document.getElementById('dateFilterNote');
	if (!searchResultsCount || !searchNote || !dateFilterNote) return;
	
	if (!searchQuery || searchQuery.trim() === '') {
		searchResultsCount.style.display = 'none';
		searchNote.style.display = 'none';
		dateFilterNote.style.display = 'none';
		return;
	}
	
	// When searching, show total results across all dates (date filtering is ignored)
	const allSearchResults = filterMoviesBySearch(currentMovies, searchQuery);
	const totalUniqueTitles = new Set(allSearchResults.map(movie => movie.title));
	
	searchResultsCount.style.display = 'block';
	searchNote.style.display = 'block';
	dateFilterNote.style.display = 'block';
	searchResultsCount.textContent = `${totalUniqueTitles.size} movie${totalUniqueTitles.size !== 1 ? 's' : ''} found`;
}

function highlightSearchTerm(text, searchTerm) {
	if (!searchTerm || !text) return text;
	
	const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
	return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// ---------- Simplified state and UI (mockup style) ----------
let currentMovies = [];
let hiddenTitles = new Set();
let searchQuery = '';


function groupByTitle(movies) {
	const map = new Map();
	const sorted = [...movies].sort((a,b) => a.time - b.time);
	for (const m of sorted) {
		if (!map.has(m.title)) map.set(m.title, []);
		map.get(m.title).push(m);
	}
	return map;
}

function renderList(movies, selectedDate = null) {
	const container = document.getElementById('moviesList');
	if (!container) return;
	container.innerHTML = '';
	
	let filteredMovies = movies;
	
	// Check if we're in search mode (search interface is open)
	const searchControls = document.getElementById('searchControls');
	const isInSearchMode = searchControls && !searchControls.classList.contains('hidden');
	
	if (isInSearchMode) {
		// In search mode: only show results if there's a search query, otherwise show nothing
		if (searchQuery && searchQuery.trim() !== '') {
			filteredMovies = filterMoviesBySearch(movies, searchQuery);
		} else {
			// Empty search or no search query in search mode - show nothing
			filteredMovies = [];
		}
	} else {
		// Not in search mode: apply normal date filtering
		if (selectedDate) {
			const startOfDay = new Date(selectedDate);
			startOfDay.setHours(0, 0, 0, 0);
			const endOfDay = new Date(selectedDate);
			endOfDay.setHours(23, 59, 59, 999);
			
			filteredMovies = movies.filter(movie => {
				return movie.time >= startOfDay && movie.time <= endOfDay;
			});
		}
	}
	
	const byTitle = groupByTitle(filteredMovies);
	const titles = Array.from(byTitle.keys());
	for (const title of titles) {
		if (hiddenTitles.has(title)) continue;
		let shows = byTitle.get(title);
		if (shows.length === 0) continue;
		const card = document.createElement('div');
		card.className = 'card';
		
		// Add search result styling when searching
		if (searchQuery && searchQuery.trim() !== '') {
			card.classList.add('search-result-card');
		}
		
		// Create card content wrapper
		const cardContent = document.createElement('div');
		cardContent.className = 'card-content';
		
		const header = document.createElement('div');
		header.className = 'card-header';
		const h = document.createElement('h2');
		h.className = 'card-title';
		h.innerHTML = highlightSearchTerm(title, searchQuery);
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
		
		// Add subtitle for search results showing total showings
		if (searchQuery && searchQuery.trim() !== '') {
			const subtitle = document.createElement('div');
			subtitle.className = 'search-result-subtitle';
			const totalShowings = shows.length;
			subtitle.textContent = `${totalShowings} showing${totalShowings !== 1 ? 's' : ''} across all dates`;
			cardContent.appendChild(subtitle);
		}
		
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
			
			// Show date and time for search results, just time for date-filtered results
			if (searchQuery && searchQuery.trim() !== '') {
				time.textContent = `${earliest.time.toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })} ${earliest.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })}`;
			} else {
				time.textContent = earliest.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
			}

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
					
					// Show date and time for search results, just time for date-filtered results
					if (searchQuery && searchQuery.trim() !== '') {
						t.textContent = `${s.time.toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })} ${s.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' })}`;
					} else {
						t.textContent = s.time.toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' });
					}
					
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
		if (searchQuery && searchQuery.trim() !== '') {
			// When searching, we show results across all dates, so if no results, they don't exist anywhere
			empty.innerHTML = `No movies found matching "<strong>${searchQuery}</strong>"`;
		} else {
			empty.textContent = 'No movies found';
		}
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
	// Show loading state immediately
	showLoading();
	
	const dateInput = document.getElementById('datePicker');
	const searchInput = document.getElementById('searchInput');
	const clearSearchBtn = document.getElementById('clearSearchBtn');
	const searchToggleBtn = document.getElementById('searchToggleBtn');
	const normalControls = document.getElementById('normalControls');
	const searchControls = document.getElementById('searchControls');

	const dateLabel = document.getElementById('dateLabel');
	if (!dateInput.value) dateInput.value = formatDateForInput(new Date());

	dateLabel.textContent = labelForDate(new Date(dateInput.value));
	const selectedDate = new Date(dateInput.value);
	hiddenTitles = new Set();
	
	try {
		// Fetch movies data
		currentMovies = await getAllMovies();
		
		// Render the initial list
		renderList(currentMovies, selectedDate);
		
		// Hide loading state after everything is ready
		hideLoading();
	} catch (error) {
		console.error('Error loading movies:', error);
		
		// Show error message in the movies list
		const container = document.getElementById('moviesList');
		if (container) {
			container.innerHTML = `
				<div class="muted">
					<strong>Error loading movies</strong>
					<small>Please check your internet connection and try refreshing the page.</small>
				</div>
			`;
		}
		
		// Hide loading state even on error
		hideLoading();
	}
	
	// Search toggle button functionality
	searchToggleBtn.addEventListener('click', () => {
		if (searchControls.classList.contains('hidden')) {
			// Show search controls, hide normal controls
			normalControls.classList.add('hidden');
			searchControls.classList.remove('hidden');
			searchToggleBtn.classList.add('active');
			
			// Clear the movie list immediately when entering search mode
			const container = document.getElementById('moviesList');
			if (container) {
				container.innerHTML = '';
			}
	
			// Focus search input after animation
			setTimeout(() => {
				searchInput.focus();
				// Mobile-specific handling
				if (isMobileDevice()) {
					handleMobileKeyboard();
				}
			}, 150);
		} else {
			// Show normal controls, hide search controls
			searchControls.classList.add('hidden');
			normalControls.classList.remove('hidden');
			searchToggleBtn.classList.remove('active');
			
			// Clear search
			searchInput.value = '';
			searchQuery = '';
			hiddenTitles = new Set();
			
			// Get current date from date picker and render movies for that date
			const currentDate = new Date(dateInput.value);
			renderList(currentMovies, currentDate);
			updateSearchResultsCount();
		}
	});
	
	// Search input event listener with debouncing
	let searchTimeout;
	searchInput.addEventListener('input', (e) => {
		searchQuery = e.target.value;
		hiddenTitles = new Set(); // Reset hidden titles when searching
		
		// Show/hide clear button
		clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
		
		// Clear previous timeout
		clearTimeout(searchTimeout);
		
		// Debounce the search to avoid excessive re-rendering
		searchTimeout = setTimeout(() => {
			renderList(currentMovies, null); // Pass null to ignore date filtering during search
			updateSearchResultsCount();
			
			// Mobile-specific handling to ensure search input stays visible
			if (isMobileDevice()) {
				ensureSearchVisibility();
			}
		}, 300); // Wait 300ms after user stops typing
	});
	
	// Search input keyboard shortcuts
	searchInput.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			// Show normal controls, hide search controls
			searchControls.classList.add('hidden');
			normalControls.classList.remove('hidden');
			searchToggleBtn.classList.remove('active');
			
			// Clear search
			searchInput.value = '';
			searchQuery = '';
			hiddenTitles = new Set();
			
			// Get current date from date picker and render movies for that date
			const currentDate = new Date(dateInput.value);
			renderList(currentMovies, currentDate);
			updateSearchResultsCount();
		}
	});
	
	// Mobile keyboard handling
	if (isMobileDevice()) {
		// Handle viewport changes when keyboard appears/disappears
		let initialViewportHeight = window.innerHeight;
		
		window.addEventListener('resize', () => {
			const currentViewportHeight = window.innerHeight;
			const heightDifference = initialViewportHeight - currentViewportHeight;
			
			// If viewport height decreased significantly, keyboard likely appeared
			if (heightDifference > 150) {
				if (isIPhone()) {
					// On iPhone, don't scroll the page, just ensure search is accessible
					ensureIPhoneSearchVisibility();
				} else {
					ensureSearchVisibility();
				}
			}
		});
		
		// Handle focus events for better mobile experience
		searchInput.addEventListener('focus', () => {
			setTimeout(() => {
				if (isIPhone()) {
					handleIPhoneKeyboard();
				} else {
					handleMobileKeyboard();
				}
			}, 100);
		});
		
		// Handle blur events
		searchInput.addEventListener('blur', () => {
			// Small delay to allow for keyboard dismissal
			setTimeout(() => {
				if (isMobileDevice()) {
					// Ensure the search interface is still accessible
					if (isIPhone()) {
						ensureIPhoneSearchVisibility();
					} else {
						ensureSearchVisibility();
					}
				}
			}, 300);
		});
		
		// Handle orientation changes
		window.addEventListener('orientationchange', () => {
			setTimeout(() => {
				initialViewportHeight = window.innerHeight;
				if (searchControls && !searchControls.classList.contains('hidden')) {
					if (isIPhone()) {
						ensureIPhoneSearchVisibility();
					} else {
						ensureSearchVisibility();
					}
				}
			}, 500);
		});
		
		// Handle visual viewport changes (better keyboard detection)
		if ('visualViewport' in window) {
			window.visualViewport.addEventListener('resize', () => {
				if (searchControls && !searchControls.classList.contains('hidden')) {
					if (isIPhone()) {
						ensureIPhoneSearchVisibility();
					} else {
						ensureSearchVisibility();
					}
				}
			});
		}
	}
	
	// Clear search button event listener
	clearSearchBtn.addEventListener('click', () => {
		// Show normal controls, hide search controls
		searchControls.classList.add('hidden');
		normalControls.classList.remove('hidden');
		searchToggleBtn.classList.remove('active');
		
		// Clear search
		searchInput.value = '';
		searchQuery = '';
		hiddenTitles = new Set();
		
		// Get current date from date picker and render movies for that date
		const currentDate = new Date(dateInput.value);
		renderList(currentMovies, currentDate);
		updateSearchResultsCount();
	});
	
	dateInput.onchange = () => {
		// Just change the date - no need to fetch new data
		const newDate = new Date(dateInput.value);
		
		// Fade out current content
		const moviesContainer = document.getElementById('moviesList');
		const dateLabelContainer = document.querySelector('.date-label-container');
		
		moviesContainer.classList.add('fade-out');
		dateLabelContainer.classList.add('fade-out');
		
		// Wait for fade out, then update content and fade back in
		setTimeout(() => {
			dateLabel.textContent = labelForDate(newDate);
			hiddenTitles = new Set();
			renderList(currentMovies, newDate);
			updateSearchResultsCount();
			
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
	let startY = 0;
	let currentX = 0;
	let currentY = 0;
	let isDragging = false;
	let startTime = 0;
	let isHorizontalSwipe = false;
	
	// Touch events
	card.addEventListener('touchstart', (e) => {
		// Don't start swipe if clicking on interactive elements
		if (e.target.closest('button, a, .more-btn')) return;
		
		startX = e.touches[0].clientX;
		startY = e.touches[0].clientY;
		currentX = e.touches[0].clientX; // Initialize currentX to startX to prevent false deltas
		currentY = e.touches[0].clientY; // Initialize currentY to startY to prevent false deltas
		startTime = Date.now();
		isDragging = true;
		isHorizontalSwipe = false;
		card.style.transition = 'none';
	});
	
	card.addEventListener('touchmove', (e) => {
		if (!isDragging) return;
		
		currentX = e.touches[0].clientX;
		currentY = e.touches[0].clientY;
		const deltaX = currentX - startX;
		const deltaY = currentY - startY;
		
		// Determine if this is a horizontal swipe (only after some movement)
		if (!isHorizontalSwipe && Math.abs(deltaX) > 10) {
			isHorizontalSwipe = true;
		}
		
		// Only prevent default and handle swipe if it's a horizontal movement
		if (isHorizontalSwipe && Math.abs(deltaX) > Math.abs(deltaY)) {
			e.preventDefault();
			
			if (deltaX < 0) { // Only allow left swipe
				const translateX = Math.max(deltaX, -80);
				card.querySelector('.card-content').style.transform = `translateX(${translateX}px)`;
				card.querySelector('.card-actions').style.transform = `translateX(${translateX + 80}px)`;
			}
		}
	});
	
	card.addEventListener('touchend', (e) => {
		if (!isDragging) return;
		isDragging = false;
		card.style.transition = '';
		
		const deltaX = currentX - startX;
		const deltaY = currentY - startY;
		const deltaTime = Date.now() - startTime;
		const velocity = Math.abs(deltaX) / deltaTime;
		
		// Only trigger swipe actions if this was a horizontal swipe with significant movement
		if (isHorizontalSwipe && Math.abs(deltaX) > Math.abs(deltaY)) {
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
			} else {
				// Not swiped enough, reset
				card.classList.remove('swiped');
			}
		}
		
		// Always reset transform styles after touch ends
		card.querySelector('.card-content').style.transform = '';
		card.querySelector('.card-actions').style.transform = '';
		
		// Reset horizontal swipe flag
		isHorizontalSwipe = false;
	});
	
	// Mouse events for desktop
	card.addEventListener('mousedown', (e) => {
		// Don't start swipe if clicking on interactive elements
		if (e.target.closest('button, a, .more-btn')) return;
		
		startX = e.clientX;
		startY = e.clientY;
		currentX = e.clientX; // Initialize currentX to startX to prevent false deltas
		currentY = e.clientY; // Initialize currentY to startY to prevent false deltas
		startTime = Date.now();
		isDragging = true;
		isHorizontalSwipe = false;
		card.style.transition = 'none';
		card.style.cursor = 'grabbing';
	});
	
	card.addEventListener('mousemove', (e) => {
		if (!isDragging) return;
		currentX = e.clientX;
		currentY = e.clientY;
		const deltaX = currentX - startX;
		const deltaY = currentY - startY;
		
		// Determine if this is a horizontal swipe (only after some movement)
		if (!isHorizontalSwipe && Math.abs(deltaX) > 10) {
			isHorizontalSwipe = true;
		}
		
		// Only handle swipe if it's a horizontal movement
		if (isHorizontalSwipe && Math.abs(deltaX) > Math.abs(deltaY)) {
			if (deltaX < 0) { // Only allow left swipe
				const translateX = Math.max(deltaX, -80);
				card.querySelector('.card-content').style.transform = `translateX(${translateX}px)`;
				card.querySelector('.card-actions').style.transform = `translateX(${translateX + 80}px)`;
			}
		}
	});
	
	card.addEventListener('mouseup', (e) => {
		if (!isDragging) return;
		isDragging = false;
		card.style.transition = '';
		card.style.cursor = '';
		
		const deltaX = currentX - startX;
		const deltaY = currentY - startY;
		const deltaTime = Date.now() - startTime;
		const velocity = Math.abs(deltaX) / deltaTime;
		
		// Only trigger swipe actions if this was a horizontal swipe with significant movement
		if (isHorizontalSwipe && Math.abs(deltaX) > Math.abs(deltaY)) {
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
		}
		
		// Always reset transform styles after mouse up
		card.querySelector('.card-content').style.transform = '';
		card.querySelector('.card-actions').style.transform = '';
		
		// Reset horizontal swipe flag
		isHorizontalSwipe = false;
	});
	
	// Remove the click outside handler that was closing cards
	// Now only X button and left swipe can close cards
}

window.addEventListener('DOMContentLoaded', init);
