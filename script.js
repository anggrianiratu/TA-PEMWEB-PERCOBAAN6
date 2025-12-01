// API Configuration
const API_KEY = '50991ecb3615f9ea75994ba25fe1b30b';
const API_BASE = 'https://api.openweathermap.org/data/2.5';

// Global State
let currentUnit = 'metric'; // 'metric' for Celsius, 'imperial' for Fahrenheit
let currentCity = '';
let updateInterval = null;

// City list for auto-complete suggestions
const cities = [
    // Indonesia
    'Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar', 'Palembang',
    'Tangerang', 'Depok', 'Bekasi', 'Yogyakarta', 'Malang', 'Bogor', 'Batam',
    'Pekanbaru', 'Bandar Lampung', 'Padang', 'Denpasar', 'Manado', 'Balikpapan',
    'Pontianak', 'Samarinda', 'Jambi', 'Cimahi', 'Mataram', 'Banjarmasin',
    // International
    'London', 'Paris', 'Tokyo', 'New York', 'Singapore', 'Bangkok', 'Seoul',
    'Dubai', 'Sydney', 'Mumbai', 'Beijing', 'Los Angeles', 'Berlin', 'Rome',
    'Madrid', 'Amsterdam', 'Toronto', 'Vancouver', 'Chicago', 'San Francisco',
    'Hong Kong', 'Shanghai', 'Kuala Lumpur', 'Manila', 'Hanoi', 'Moscow',
    'Istanbul', 'Cairo', 'Riyadh', 'Melbourne', 'Barcelona', 'Vienna',
    'Copenhagen', 'Stockholm', 'Oslo', 'Helsinki', 'Athens', 'Dublin',
    'Lisbon', 'Prague', 'Budapest', 'Warsaw', 'Brussels', 'Zurich'
];

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const suggestionsDropdown = document.getElementById('suggestionsDropdown');
const refreshBtn = document.getElementById('refreshBtn');
const themeToggle = document.getElementById('themeToggle');
const unitCelsius = document.getElementById('unitCelsius');
const unitFahrenheit = document.getElementById('unitFahrenheit');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const saveFavoriteBtn = document.getElementById('saveFavoriteBtn');

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadFavorites();
});

function initializeApp() {
    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggle) themeToggle.textContent = '☀️';
    }

    // Load saved unit preference
    const savedUnit = localStorage.getItem('unit');
    if (savedUnit) {
        currentUnit = savedUnit;
    }

    // Update unit toggle UI if present
    updateUnitToggleUI();

    // Load last searched city
    const lastCity = localStorage.getItem('lastCity');
    if (lastCity) {
        searchCity(lastCity);
    }
}

// EVENT LISTENERS
function setupEventListeners() {
    // Search functionality
    if (searchBtn) searchBtn.addEventListener('click', handleSearch);
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
        
        // Auto-complete on input
        searchInput.addEventListener('input', handleAutoComplete);
    }

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (suggestionsDropdown && searchInput) {
            if (!searchInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) {
                suggestionsDropdown.style.display = 'none';
            }
        }
    });

    // Theme toggle
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    // Unit toggle 
    if (unitCelsius) unitCelsius.addEventListener('click', () => setUnit('metric'));
    if (unitFahrenheit) unitFahrenheit.addEventListener('click', () => setUnit('imperial'));

    // Refresh button
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
        if (currentCity) {
            searchCity(currentCity);
        } else {
            showError('Please search for a city first');
        }
    });

    // Save favorite
    if (saveFavoriteBtn) saveFavoriteBtn.addEventListener('click', saveFavorite);
}

// SEARCH FUNCTIONALITY
function handleSearch() {
    const city = (searchInput && searchInput.value) ? searchInput.value.trim() : '';
    if (city) {
        searchCity(city);
        if (suggestionsDropdown) suggestionsDropdown.style.display = 'none';
    } else {
        showError('Please enter a city name');
    }
}

// AUTO-COMPLETE FUNCTIONALITY
function handleAutoComplete() {
    if (!searchInput || !suggestionsDropdown) return;

    const searchTerm = searchInput.value.toLowerCase().trim();
    
    // Hide dropdown if search term is too short
    if (searchTerm.length < 2) {
        suggestionsDropdown.style.display = 'none';
        return;
    }

    // Filter cities that match the search term
    const matches = cities.filter(city => 
        city.toLowerCase().includes(searchTerm)
    );

    // Display suggestions if matches found
    if (matches.length > 0) {
        displaySuggestions(matches);
    } else {
        suggestionsDropdown.style.display = 'none';
    }
}

function displaySuggestions(matches) {
    if (!suggestionsDropdown) return;
    
    // Limit to 8 suggestions max
    const limitedMatches = matches.slice(0, 8);
    
    suggestionsDropdown.innerHTML = limitedMatches.map(city => 
        `<div class="suggestion-item" onclick="selectCity('${escapeHtml(city)}')">${escapeHtml(city)}</div>`
    ).join('');
    
    suggestionsDropdown.style.display = 'block';
}

function selectCity(city) {
    if (searchInput) searchInput.value = city;
    if (suggestionsDropdown) suggestionsDropdown.style.display = 'none';
    searchCity(city);
}

// Helper to escape HTML and prevent XSS
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// WEATHER DATA FETCHING
async function searchCity(city) {
    showLoading();
    hideMessages();
    currentCity = city;
    localStorage.setItem('lastCity', city);

    try {
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=5&appid=${API_KEY}`;
        
        console.log('🔍 Geocoding:', city);
        
        const geoResponse = await fetch(geoUrl);
        
        if (!geoResponse.ok) {
            throw new Error('Tidak dapat menemukan lokasi');
        }
        
        const geoData = await geoResponse.json();
        
        if (geoData.length === 0) {
            throw new Error(`Kota "${city}" tidak ditemukan. Coba periksa ejaan atau gunakan nama kota yang lebih besar.`);
        }
        
        const location = geoData[0];
        console.log('✅ Location found:', location);
        
        const weatherData = await fetchWeatherByCoords(location.lat, location.lon);
    
        currentCity = location.name;
        if (location.state) {
            weatherData.name = `${location.name}, ${location.state}`;
        } else {
            weatherData.name = location.name;
        }
        weatherData.sys.country = location.country;
        
        displayCurrentWeather(weatherData);

        // Fetch 5-day forecast menggunakan koordinat
        const forecastData = await fetchForecastByCoords(location.lat, location.lon);
        displayForecast(forecastData);

        // Start auto-update every 5 minutes
        startAutoUpdate();

    } catch (error) {
        console.error('❌ Search error:', error);
        showError(error.message || 'Gagal mengambil data cuaca.');
    } finally {
        hideLoading();
    }
}

async function fetchWeatherByCoords(lat, lon, units = currentUnit) {
    const url = `${API_BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}&lang=en`;
    console.log('🌤️ Fetching weather by coords:', lat, lon);
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error('Gagal mengambil data cuaca');
    }
    
    return await response.json();
}

async function fetchForecastByCoords(lat, lon, units = currentUnit) {
    const url = `${API_BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}&lang=en`;
    console.log('📅 Fetching forecast by coords:', lat, lon);
    
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error('Gagal mengambil data forecast');
    }
    
    return await response.json();
}

async function fetchWeatherData(city, units = currentUnit) {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
    const geoResponse = await fetch(geoUrl);
    
    if (!geoResponse.ok) {
        throw new Error('City not found');
    }
    
    const geoData = await geoResponse.json();
    
    if (geoData.length === 0) {
        throw new Error('City not found');
    }
    
    const location = geoData[0];
    return await fetchWeatherByCoords(location.lat, location.lon, units);
}

async function fetchForecastData(city, units = currentUnit) {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
    const geoResponse = await fetch(geoUrl);
    
    if (!geoResponse.ok) {
        throw new Error('City not found');
    }
    
    const geoData = await geoResponse.json();
    
    if (geoData.length === 0) {
        throw new Error('City not found');
    }
    
    const location = geoData[0];
    return await fetchForecastByCoords(location.lat, location.lon, units);
}

// DISPLAY WEATHER DATA
function displayCurrentWeather(data) {
    if (!data || !data.main) return;

    const temp = Math.round(data.main.temp);
    const feelsLike = Math.round(data.main.feels_like);
    const unit = currentUnit === 'metric' ? '°C' : '°F';
    const windSpeed = Math.round(data.wind.speed * (currentUnit === 'metric' ? 3.6 : 1));
    const iconUrl = `https://openweathermap.org/img/wn/${data.weather[0].icon}@4x.png`;

    // Update location
    const cityNameEl = document.getElementById('cityName');
    if (cityNameEl) cityNameEl.textContent = `${data.name}, ${data.sys.country}`;

    // Update current time
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    const currentTimeEl = document.getElementById('currentTime');
    if (currentTimeEl) currentTimeEl.textContent = timeString;

    // Update weather icon
    const weatherIcon = document.getElementById('weatherIcon');
    if (weatherIcon) {
        weatherIcon.src = iconUrl;
        weatherIcon.style.display = 'block';
    }

    // Update temperature
    const tempValueEl = document.getElementById('tempValue');
    const tempUnitEl = document.getElementById('tempUnit');
    if (tempValueEl) tempValueEl.textContent = temp;
    if (tempUnitEl) tempUnitEl.textContent = unit;

    const feelsLikeEl = document.getElementById('feelsLike');
    if (feelsLikeEl) feelsLikeEl.textContent = feelsLike;

    // Update weather description
    const descrEl = document.getElementById('weatherDescription');
    if (descrEl) descrEl.textContent = data.weather[0].description;

    // Update weather details
    const windEl = document.getElementById('windSpeed');
    const humEl = document.getElementById('humidity');
    const presEl = document.getElementById('pressure');
    const visEl = document.getElementById('visibility');

    if (windEl) windEl.textContent = windSpeed;
    if (humEl) humEl.textContent = data.main.humidity;
    if (presEl) presEl.textContent = data.main.pressure;
    if (visEl) visEl.textContent = (data.visibility / 1000).toFixed(1);

    // Update last update time
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function displayForecast(data) {
    const forecastContainer = document.getElementById('forecastContainer');
    if (!forecastContainer || !data || !data.list) return;
    
    // Get one forecast per day (around noon)
    const dailyForecasts = [];
    const processedDates = new Set();

    data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dateString = date.toLocaleDateString();
        const hour = date.getHours();

        if (hour >= 11 && hour <= 13 && !processedDates.has(dateString)) {
            dailyForecasts.push(item);
            processedDates.add(dateString);
        }
    });

    // Display only 5 days
    const forecastHTML = dailyForecasts.slice(0, 5).map(item => {
        const date = new Date(item.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const iconUrl = `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`;
        const temp = Math.round(item.main.temp);
        const tempMin = Math.round(item.main.temp_min);
        const tempMax = Math.round(item.main.temp_max);
        const unit = currentUnit === 'metric' ? '°C' : '°F';

        return `
            <div class="forecast-card">
                <div class="forecast-day">${dayName}</div>
                <div class="forecast-date">${dateStr}</div>
                <img src="${iconUrl}" alt="${escapeHtml(item.weather[0].description)}" class="forecast-icon">
                <div class="forecast-temp">${temp}${unit}</div>
                <div class="forecast-range">↑ ${tempMax}${unit} ↓ ${tempMin}${unit}</div>
                <div class="forecast-description">${escapeHtml(item.weather[0].description)}</div>
            </div>
        `;
    }).join('');

    forecastContainer.innerHTML = forecastHTML;
}


// AUTO-UPDATE FUNCTIONALITY
function startAutoUpdate() {
    // Clear existing interval
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    // Set new interval for 5 minutes
    updateInterval = setInterval(() => {
        if (currentCity) {
            console.log('Auto-updating weather for:', currentCity);
            searchCity(currentCity);
        }
    }, 5 * 60 * 1000); // 5 minutes in milliseconds
}

// THEME TOGGLE
function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    
    // Update button icon directly
    if (themeToggle) {
        themeToggle.textContent = isDark ? '☀️' : '🌙';
    }
    
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// UNIT TOGGLE 
function setUnit(unit) {
    currentUnit = unit;
    localStorage.setItem('unit', currentUnit);

    // Update active state buttons
    updateUnitToggleUI();

    // Re-fetch current city data
    if (currentCity) {
        searchCity(currentCity);
    }

    // Re-render favorites
    loadFavorites();
}

function updateUnitToggleUI() {
    if (!unitCelsius || !unitFahrenheit) return;
    
    if (currentUnit === 'metric') {
        unitCelsius.classList.add('active');
        unitFahrenheit.classList.remove('active');
    } else {
        unitCelsius.classList.remove('active');
        unitFahrenheit.classList.add('active');
    }
}

// FAVORITES MANAGEMENT
async function saveFavorite() {
    if (!currentCity) {
        showError('Please search for a city first before saving.');
        return;
    }

    const favorites = getFavorites();

    // Prevent duplicates (case-insensitive)
    if (favorites.find(f => f.city.toLowerCase() === currentCity.toLowerCase())) {
        showError('This city is already in your favorites!');
        return;
    }

    try {
        // Always fetch using metric to store fixed Celsius
        const data = await fetchWeatherData(currentCity, 'metric');

        const favorite = {
            city: currentCity, 

            // simpan country dari weather result
            country: data.sys && data.sys.country ? data.sys.country : '',

            // simpan suhu celcius real
            tempC: data.main.temp
        };

        favorites.push(favorite);
        localStorage.setItem('favorites', JSON.stringify(favorites));
        loadFavorites();
        showSuccess(`${favorite.city} has been added to your favorites!`);

    } catch (error) {
        console.error('Failed to add favorite:', error);
        showError('Failed to add to favorites: ' + (error.message || 'unknown error'));
    }
}

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem('favorites')) || [];
    } catch (e) {
        console.warn('Invalid favorites in localStorage, resetting.');
        localStorage.removeItem('favorites');
        return [];
    }
}

function loadFavorites() {
    const favorites = getFavorites();
    const favoritesContainer = document.getElementById('favoritesContainer');

    if (!favoritesContainer) return;

    if (favorites.length === 0) {
        favoritesContainer.innerHTML = '<div class="empty-state">No favorite cities yet. Save your favorite locations!</div>';
        return;
    }

    // Build HTML with temperature converted based on currentUnit
    const html = favorites.map((fav, index) => {
        // ensure tempC exists
        const tempC = typeof fav.tempC === 'number' ? fav.tempC : (fav.temp ? Number(fav.temp) : null);
        const displayTemp = tempC === null || isNaN(tempC)
            ? '--'
            : (currentUnit === 'metric'
                ? Math.round(tempC) + '°C'
                : Math.round((tempC * 9/5) + 32) + '°F');

        const safeCity = escapeHtml(fav.city || '');
        const safeCountry = escapeHtml(fav.country || '');

        return `
            <div class="favorite-card" onclick="window.selectFavoriteCity('${escapeJsArg(safeCity)}')">
                <div class="favorite-city">${safeCity}${safeCountry ? ', ' + safeCountry : ''}</div>
                <div class="favorite-temp">${displayTemp}</div>
                <button class="remove-favorite" onclick="event.stopPropagation(); window.removeFavoriteAt(${index})">×</button>
            </div>
        `;
    }).join('');

    favoritesContainer.innerHTML = html;
}

// helpers for safely injecting strings into onclick attributes
function escapeJsArg(str) {
    return String(str).replace(/'/g, "\\'");
}

// Global functions for onclick handlers
window.selectFavoriteCity = function(city) {
    if (!city) return;
    searchCity(city);
    if (searchInput) searchInput.value = city;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.removeFavoriteAt = function(index) {
    const favorites = getFavorites();
    if (index < 0 || index >= favorites.length) return;
    favorites.splice(index, 1);
    localStorage.setItem('favorites', JSON.stringify(favorites));
    loadFavorites();
    showSuccess('City removed from favorites');
};

// UI HELPER FUNCTIONS
function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = '❌ ' + message;
        errorMessage.style.display = 'flex';
        
        setTimeout(() => {
            if (errorMessage) errorMessage.style.display = 'none';
        }, 5000);
    } else {
        console.error(message);
    }
}

function showSuccess(message) {
    if (successMessage) {
        successMessage.textContent = '✅ ' + message;
        successMessage.style.display = 'flex';
        
        setTimeout(() => {
            if (successMessage) successMessage.style.display = 'none';
        }, 3000);
    } else {
        console.log(message);
    }
}

function hideMessages() {
    if (errorMessage) errorMessage.style.display = 'none';
    if (successMessage) successMessage.style.display = 'none';
}