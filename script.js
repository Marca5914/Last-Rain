// DOM Elements
const getLocationBtn = document.getElementById('getLocationBtn');
const resultDiv = document.getElementById('result');
const plantImage = document.getElementById('plantImage');
const locationInputArea = document.getElementById('locationInputArea');
const toggleManualLocationLink = document.getElementById('toggleManualLocation');
const latitudeInput = document.getElementById('latitudeInput');
const longitudeInput = document.getElementById('longitudeInput');
const submitLocationBtn = document.getElementById('submitLocationBtn');
const createBookmarkBtn = document.getElementById('createBookmarkBtn');
const bookmarkLinkContainer = document.getElementById('bookmarkLinkContainer');
const bookmarkUrlInput = document.getElementById('bookmarkUrl');
const mapElement = document.getElementById('map');

// Constants
const PRECIPITATION_THRESHOLD = 0.1;
const IMAGE_PATH = 'images/';
const DEFAULT_LAT = 55.9486; // Approx. Milngavie, Scotland as a fallback
const DEFAULT_LON = -4.3290;
const DEFAULT_ZOOM = 7;
const LOCATION_ZOOM = 13;

// Leaflet Map Variables
let map;
let marker;

// State Variables
let currentLatitude = null;
let currentLongitude = null;

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    initializeMap(DEFAULT_LAT, DEFAULT_LON, DEFAULT_ZOOM);
    plantImage.src = IMAGE_PATH + 'plant_unknown.png';
    handleUrlParameters(); // Check for lat/lon in URL on page load
});

// --- Map Initialization ---
function initializeMap(lat, lon, zoom) {
    if (map) { // If map already exists, just set view
        map.setView([lat, lon], zoom);
        return;
    }
    map = L.map(mapElement).setView([lat, lon], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Handle map clicks
    map.on('click', function(e) {
        const clickedLat = e.latlng.lat;
        const clickedLng = e.latlng.lng;
        updateLocationAndFetchWeather(clickedLat, clickedLng, "Map click");
    });
}

function updateMapMarker(lat, lon) {
    if (marker) {
        marker.setLatLng([lat, lon]);
    } else {
        marker = L.marker([lat, lon]).addTo(map);
    }
    map.setView([lat, lon], LOCATION_ZOOM);
}

// --- Event Listeners ---
getLocationBtn.addEventListener('click', () => {
    resultDiv.innerHTML = '<p>Fetching location...</p>';
    plantImage.src = IMAGE_PATH + 'plant_unknown.png';
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                updateLocationAndFetchWeather(position.coords.latitude, position.coords.longitude, "Geolocation");
            },
            handleGeolocationError
        );
    } else {
        resultDiv.innerHTML = '<p>Geolocation is not supported. Click map or enter manually.</p>';
        plantImage.src = IMAGE_PATH + 'plant_very_dry.png';
    }
});

submitLocationBtn.addEventListener('click', () => {
    const lat = parseFloat(latitudeInput.value);
    const lon = parseFloat(longitudeInput.value);
    plantImage.src = IMAGE_PATH + 'plant_unknown.png';

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        resultDiv.innerHTML = '<p>Invalid latitude or longitude. Latitude: -90 to 90, Longitude: -180 to 180.</p>';
        plantImage.src = IMAGE_PATH + 'plant_very_dry.png';
        return;
    }
    updateLocationAndFetchWeather(lat, lon, "Manual input");
});

toggleManualLocationLink.addEventListener('click', (e) => {
    e.preventDefault();
    locationInputArea.style.display = locationInputArea.style.display === 'none' ? 'block' : 'none';
    toggleManualLocationLink.textContent = locationInputArea.style.display === 'none' ? 'Enter Lat/Lon Manually' : 'Hide Manual Input';
});

createBookmarkBtn.addEventListener('click', () => {
    if (currentLatitude !== null && currentLongitude !== null) {
        const url = `${window.location.origin}${window.location.pathname}?lat=${currentLatitude.toFixed(6)}&lon=${currentLongitude.toFixed(6)}`;
        bookmarkUrlInput.value = url;
        bookmarkLinkContainer.style.display = 'block';
        bookmarkUrlInput.select(); // Select the text for easy copying
        try {
            // Attempt to copy to clipboard
            if(document.execCommand('copy')) {
                 // Briefly show a "Copied!" message or similar visual feedback
                const originalText = createBookmarkBtn.textContent;
                createBookmarkBtn.textContent = "Link Copied!";
                setTimeout(() => { createBookmarkBtn.textContent = originalText; }, 2000);
            }
        } catch (err) {
            console.warn('Could not copy to clipboard automatically.');
        }
    } else {
        alert("Please select a location first to create a bookmark link.");
    }
});


// --- Core Logic ---
function updateLocationAndFetchWeather(lat, lon, sourceType) {
    currentLatitude = lat;
    currentLongitude = lon;

    // Update input fields (optional, but good feedback)
    latitudeInput.value = lat.toFixed(6);
    longitudeInput.value = lon.toFixed(6);

    updateMapMarker(lat, lon);
    fetchWeatherData(lat, lon, sourceType);

    // Show bookmark button after a location is set
    createBookmarkBtn.style.display = 'inline-block';
    bookmarkLinkContainer.style.display = 'none'; // Hide old link if any
}


function handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const latParam = params.get('lat');
    const lonParam = params.get('lon');

    if (latParam && lonParam) {
        const lat = parseFloat(latParam);
        const lon = parseFloat(lonParam);
        if (!isNaN(lat) && !isNaN(lon)) {
            // Set map view before fetching data to avoid default view flash
            initializeMap(lat, lon, LOCATION_ZOOM);
            updateLocationAndFetchWeather(lat, lon, "Bookmark/URL");
            // Ensure manual input fields are populated if shown
            latitudeInput.value = lat.toFixed(6);
            longitudeInput.value = lon.toFixed(6);
        }
    }
}

// --- Geolocation Error Handling ---
function handleGeolocationError(error) {
    let message = "An unknown error occurred while getting location.";
    plantImage.src = IMAGE_PATH + 'plant_very_dry.png';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "User denied Geolocation. Click map or enter location manually.";
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable. Click map or enter manually.";
            break;
        case error.TIMEOUT:
            message = "Geolocation request timed out. Click map or enter manually.";
            break;
    }
    resultDiv.innerHTML = `<p>${message}</p>`;
}

// --- Plant Image Update ---
function updatePlantImage(daysSinceRain) {
    if (daysSinceRain === null) {
        plantImage.src = IMAGE_PATH + 'plant_very_dry.png';
    } else if (daysSinceRain < 1) {
        plantImage.src = IMAGE_PATH + 'plant_healthy.png';
    } else if (daysSinceRain < 3) {
        plantImage.src = IMAGE_PATH + 'plant_slightly_dry.png';
    } else if (daysSinceRain < 7) {
        plantImage.src = IMAGE_PATH + 'plant_moderately_dry.png';
    } else {
        plantImage.src = IMAGE_PATH + 'plant_very_dry.png';
    }
}

// --- Fetch Weather Data (Main API Call) ---
async function fetchWeatherData(lat, lon, sourceType = "Unknown") {
    resultDiv.innerHTML = `<p>Fetching weather for ${sourceType} (Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)})...</p>`;
    plantImage.src = IMAGE_PATH + 'plant_unknown.png';

    const daysToLookBack = 90;
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(today.getDate() - daysToLookBack);
    const startDateStr = startDate.toISOString().split('T')[0];

    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(6)}&longitude=${lon.toFixed(6)}&hourly=precipitation&start_date=${startDateStr}&end_date=${endDate}&timezone=auto`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const reason = errorData && errorData.reason ? errorData.reason : `API request failed: ${response.status}`;
            throw new Error(reason);
        }
        const data = await response.json();

        if (data.hourly && data.hourly.time && data.hourly.precipitation) {
            const times = data.hourly.time;
            const precipitationData = data.hourly.precipitation;
            let lastRainDateTime = null;

            for (let i = times.length - 1; i >= 0; i--) {
                if (precipitationData[i] > PRECIPITATION_THRESHOLD) {
                    lastRainDateTime = new Date(times[i]);
                    break;
                }
            }

            if (lastRainDateTime) {
                const now = new Date();
                const diffMillis = now - lastRainDateTime;

                if (diffMillis < 0) {
                    resultDiv.innerHTML = `<p>Precipitation is forecasted or occurring now (${lastRainDateTime.toLocaleString()}).</p>`;
                    updatePlantImage(0);
                    return;
                }

                const diffSeconds = Math.floor(diffMillis / 1000);
                const diffMinutes = Math.floor(diffSeconds / 60);
                const diffHoursTotal = Math.floor(diffMinutes / 60);
                const diffDays = Math.floor(diffHoursTotal / 24);
                const remainingHours = diffHoursTotal % 24;

                updatePlantImage(diffDays);

                let resultString = `It last rained on ${lastRainDateTime.toLocaleDateString()} at ${lastRainDateTime.toLocaleTimeString()}. `;
                if (diffDays > 0) {
                    resultString += `That was approx. <strong>${diffDays} day(s)</strong> and <strong>${remainingHours} hour(s)</strong> ago.`;
                } else if (diffHoursTotal > 0) {
                    resultString += `That was approx. <strong>${diffHoursTotal} hour(s)</strong> ago.`;
                } else if (diffMinutes > 0) {
                    resultString += `That was approx. <strong>${diffMinutes} minute(s)</strong> ago.`;
                } else {
                    resultString += `That was less than a minute ago, or is raining now.`;
                }
                resultDiv.innerHTML = `<p>${resultString}</p>`;

            } else {
                resultDiv.innerHTML = `<p>No significant rain (>${PRECIPITATION_THRESHOLD}mm/hr) recorded in the last ${daysToLookBack} days for this location.</p>`;
                updatePlantImage(daysToLookBack);
            }
        } else {
            resultDiv.innerHTML = '<p>Could not retrieve valid precipitation data. API response might be malformed or lack data.</p>';
            updatePlantImage(null);
            console.error("API Data Structure Error:", data);
        }

    } catch (error) {
        console.error("Error fetching/processing weather data:", error);
        resultDiv.innerHTML = `<p>Error: ${error.message}. Check console.</p>`;
        updatePlantImage(null);
    }
}
