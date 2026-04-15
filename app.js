const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');

const mainContent = document.getElementById('main-content');
const loader = document.getElementById('loader');

// Elements to update
const elCityName = document.getElementById('city-name');
const elCurrentDate = document.getElementById('current-date');
const elCurrentTemp = document.getElementById('current-temp');
const elCurrentIcon = document.getElementById('current-icon');
const elCurrentDesc = document.getElementById('current-desc');
const elFeelsLike = document.getElementById('feels-like');
const elHumidity = document.getElementById('humidity');
const elWind = document.getElementById('wind');
const elUvIndex = document.getElementById('uv-index');

const elHourlyContainer = document.getElementById('hourly-container');
const elDailyContainer = document.getElementById('daily-container');

const elSunriseTime = document.getElementById('sunrise-time');
const elSunsetTime = document.getElementById('sunset-time');

let debounceTimeout;

document.addEventListener('DOMContentLoaded', () => {
    // Automatically fetch location on load cleanly via IP without triggering aggressive mobile permission popups
    getFallbackLocation();

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        const query = e.target.value.trim();
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }
        debounceTimeout = setTimeout(() => {
            searchCities(query);
        }, 300);
    });

    searchBtn.addEventListener('click', () => {
        if (searchInput.value.trim()) {
            searchCities(searchInput.value.trim());
        }
    });

    const locationBtn = document.getElementById('location-btn');
    locationBtn.addEventListener('click', () => {
        locationBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        // Some mobile browsers block geolocation outright if not connected via HTTPS.
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    locationBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
                    searchInput.value = '';
                    fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, "Your Location");
                },
                err => {
                    getFallbackLocation(locationBtn);
                },
                { timeout: 6000, maximumAge: 10000 }
            );
        } else {
            getFallbackLocation(locationBtn);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            searchResults.style.display = 'none';
        }
    });
});

async function getFallbackLocation(btn = null) {
    try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await res.json();
        if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
        if (data && data.latitude && data.longitude) {
            if (searchInput) searchInput.value = '';
            let locName = `${data.city || 'Your Location'}`;
            if (data.country) locName += `, ${data.country}`;
            fetchWeatherByCoords(data.latitude, data.longitude, locName);
        } else {
            throw new Error("Invalid format");
        }
    } catch (e) {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
        console.error("IP fallback failed:", e);
        // Ultimate fallback if absolutely everything fails
        fetchWeatherByCoords(51.5085, -0.1257, "London, UK");
    }
}

async function searchCities(query) {
    try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        const data = await res.json();
        
        searchResults.innerHTML = '';
        if (data.results && data.results.length > 0) {
            data.results.forEach(city => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `<i class="fa-solid fa-location-dot"></i> <span>${city.name}, ${city.admin1 ? city.admin1 + ', ' : ''}${city.country}</span>`;
                div.addEventListener('click', () => {
                    searchInput.value = '';
                    searchResults.style.display = 'none';
                    fetchWeatherByCoords(city.latitude, city.longitude, `${city.name}, ${city.country}`);
                });
                searchResults.appendChild(div);
            });
            searchResults.style.display = 'block';
        } else {
            searchResults.innerHTML = '<div class="search-result-item">No cities found.</div>';
            searchResults.style.display = 'block';
        }
    } catch (e) {
        console.error("Geocoding failed", e);
    }
}

async function fetchWeatherByCoords(lat, lon, locationName) {
    mainContent.classList.add('hidden');
    loader.classList.remove('hidden');

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        
        updateUI(data, locationName);
    } catch (e) {
        mainContent.innerHTML = "<h2>⚠️ Failed to load weather</h2>";
    } finally {
        loader.classList.add('hidden');
        mainContent.classList.remove('hidden');
    }
}

function updateUI(data, locationName) {
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;

    elCityName.textContent = locationName;
    
    // Parse current date
    const dateObj = new Date(current.time);
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    elCurrentDate.textContent = 'Today, ' + dateObj.toLocaleDateString(navigator.language, options);

    elCurrentTemp.textContent = Math.round(current.temperature_2m) + '°';
    
    const isDay = current.is_day === 1;
    const weatherInfo = getWeatherIconAndDesc(current.weather_code, isDay);
    elCurrentDesc.textContent = weatherInfo.desc;
    
    elCurrentIcon.className = `fa-solid ${weatherInfo.icon} we-icon large`;
    elCurrentIcon.style.color = weatherInfo.color;

    elFeelsLike.textContent = Math.round(current.apparent_temperature) + '°';
    elHumidity.textContent = current.relative_humidity_2m + '%';
    elWind.textContent = current.wind_speed_10m + ' km/h';
    elUvIndex.textContent = daily.uv_index_max[0] ? daily.uv_index_max[0].toFixed(1) : '--';

    // Sunrise & Sunset
    const sr = new Date(daily.sunrise[0]);
    const ss = new Date(daily.sunset[0]);
    elSunriseTime.textContent = formatTime(sr);
    elSunsetTime.textContent = formatTime(ss);

    // Hourly
    elHourlyContainer.innerHTML = '';
    // take next 24 hours
    // Better way: find the index in hourly.time that is closest to now, take next 24.
    const currentIndex = parseInt(current.time.split('T')[1].split(':')[0]); // approx
    let startIndex = hourly.time.findIndex(t => new Date(t) >= new Date(current.time));
    if (startIndex === -1) {
    console.error("Time sync failed");
    startIndex = 0;
}

    for (let i = startIndex; i < startIndex + 24; i += 2) {
        if(i >= hourly.time.length) break;
        const hTime = new Date(hourly.time[i]);
        const hcode = hourly.weather_code[i];
        const htemp = Math.round(hourly.temperature_2m[i]);
        const isDayTime = hTime.getHours() >= 6 && hTime.getHours() < 18;
const hInfo = getWeatherIconAndDesc(hcode, isDayTime);
        const div = document.createElement('div');
        div.className = 'hourly-item';
        div.innerHTML = `
            <span class="time">${i === startIndex ? 'Now' : formatTimeShort(hTime)}</span>
            <i class="fa-solid ${hInfo.icon}" style="color: ${hInfo.color}"></i>
            <span class="temp">${htemp}°</span>
        `;
        elHourlyContainer.appendChild(div);
    }

    // Daily
    elDailyContainer.innerHTML = '';
    for(let i=0; i<7; i++) {
        const dTime = new Date(daily.time[i]);
        const dCode = daily.weather_code[i];
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const dInfo = getWeatherIconAndDesc(dCode, true);

        let dayName = i === 0 ? 'Today' : dTime.toLocaleDateString('en-US', {weekday: 'short'});

        const div = document.createElement('div');
        div.className = 'daily-item';
        div.innerHTML = `
            <span class="daily-day">${dayName}</span>
            <div class="daily-icon-desc">
                <i class="fa-solid ${dInfo.icon}" style="color: ${dInfo.color}"></i>
                <span>${dInfo.desc}</span>
            </div>
            <div class="daily-temps">
                <span class="max">${maxTemp}°</span>
                <span class="min">${minTemp}°</span>
            </div>
        `;
        elDailyContainer.appendChild(div);
    }
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatTimeShort(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

// Weather Code mapping
function getWeatherIconAndDesc(code, isDay = true) {
    const map = {
        0: { desc: 'Clear sky', icon: isDay ? 'fa-sun' : 'fa-moon', color: isDay ? '#facc15' : '#e2e8f0' },
        1: { desc: 'Mainly clear', icon: isDay ? 'fa-cloud-sun' : 'fa-cloud-moon', color: isDay ? '#facc15' : '#94a3b8' },
        2: { desc: 'Partly cloudy', icon: 'fa-cloud', color: '#94a3b8' },
        3: { desc: 'Overcast', icon: 'fa-cloud', color: '#64748b' },
        45: { desc: 'Fog', icon: 'fa-smog', color: '#94a3b8' },
        48: { desc: 'Depositing rime fog', icon: 'fa-smog', color: '#94a3b8' },
        51: { desc: 'Light drizzle', icon: 'fa-cloud-rain', color: '#60a5fa' },
        53: { desc: 'Moderate drizzle', icon: 'fa-cloud-rain', color: '#60a5fa' },
        55: { desc: 'Dense drizzle', icon: 'fa-water', color: '#60a5fa' },
        56: { desc: 'Light freezing drizzle', icon: 'fa-cloud-meatball', color: '#93c5fd' },
        57: { desc: 'Dense freezing drizzle', icon: 'fa-cloud-meatball', color: '#93c5fd' },
        61: { desc: 'Slight rain', icon: 'fa-cloud-showers-heavy', color: '#3b82f6' },
        63: { desc: 'Moderate rain', icon: 'fa-cloud-showers-heavy', color: '#2563eb' },
        65: { desc: 'Heavy rain', icon: 'fa-cloud-showers-water', color: '#1d4ed8' },
        66: { desc: 'Light freezing rain', icon: 'fa-cloud-rain', color: '#93c5fd' },
        67: { desc: 'Heavy freezing rain', icon: 'fa-cloud-rain', color: '#93c5fd' },
        71: { desc: 'Slight snow', icon: 'fa-snowflake', color: '#bfdbfe' },
        73: { desc: 'Moderate snow', icon: 'fa-snowflake', color: '#bfdbfe' },
        75: { desc: 'Heavy snow', icon: 'fa-snowflake', color: '#bfdbfe' },
        77: { desc: 'Snow grains', icon: 'fa-snowflake', color: '#bfdbfe' },
        80: { desc: 'Slight rain showers', icon: 'fa-cloud-showers-heavy', color: '#3b82f6' },
        81: { desc: 'Moderate rain showers', icon: 'fa-cloud-showers-heavy', color: '#2563eb' },
        82: { desc: 'Violent rain showers', icon: 'fa-cloud-showers-water', color: '#1d4ed8' },
        85: { desc: 'Slight snow showers', icon: 'fa-snowflake', color: '#bfdbfe' },
        86: { desc: 'Heavy snow showers', icon: 'fa-snowflake', color: '#bfdbfe' },
        95: { desc: 'Thunderstorm', icon: 'fa-bolt', color: '#fbbf24' },
        96: { desc: 'Thunderstorm with hail', icon: 'fa-bolt', color: '#fbbf24' },
        99: { desc: 'Heavy thunderstorm', icon: 'fa-bolt', color: '#fbbf24' },
    };
    return map[code] || { desc: 'Unknown', icon: 'fa-cloud', color: '#94a3b8' };
}
