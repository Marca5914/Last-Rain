const getLocationBtn = document.getElementById('getLocationBtn');
const resultDiv = document.getElementById('result');
const locationInputArea = document.getElementById('locationInputArea');
const toggleManualLocationLink = document.getElementById('toggleManualLocation');
const latitudeInput = document.getElementById('latitudeInput');
const longitudeInput = document.getElementById('longitudeInput');
const submitLocationBtn = document.getElementById('submitLocationBtn');

const PRECIPITATION_THRESHOLD = 0.1; // Minimum mm of rain to count as "rained" (e.g., 0.1mm)
                                     // Set to 0 to count any trace of precipitation.

getLocationBtn.addEventListener('click', () => {
    resultDiv.innerHTML = '<p>Fetching location...</p>';
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                fetchWeatherData(position.coords.latitude, position.coords.longitude);
            },
            showError
        );
    } else {
        resultDiv.innerHTML = '<p>Geolocation is not supported by this browser. Please enter location manually.</p>';
        showManualInput();
    }
});

submitLocationBtn.addEventListener('click', () => {
    const lat = parseFloat(latitudeInput.value);
    const lon = parseFloat(longitudeInput.value);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        resultDiv.innerHTML = '<p>Invalid latitude or longitude. Latitude must be -90 to 90, Longitude -180 to 180.</p>';
        return;
    }
    fetchWeatherData(lat, lon);
});

toggleManualLocationLink.addEventListener('click', (e) => {
    e.preventDefault();
    showManualInput();
});

function showManualInput() {
    locationInputArea.style.display = 'block';
    toggleManualLocationLink.style.display = 'none';
}

function showError(error) {
    let message = "An unknown error occurred while getting location.";
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = "User denied the request for Geolocation. Please enter location manually or enable permissions.";
            showManualInput();
            break;
        case error.POSITION_UNAVAILABLE:
            message = "Location information is unavailable. Please enter location manually.";
            showManualInput();
            break;
        case error.TIMEOUT:
            message = "The request to get user location timed out. Please try again or enter manually.";
            break;
    }
    resultDiv.innerHTML = `<p>${message}</p>`;
}

async function fetchWeatherData(lat, lon) {
    resultDiv.innerHTML = `<p>Fetching weather data for Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}...</p>`;

    const daysToLookBack = 90; // How many days of hourly data to check
    const today = new Date();
    const endDate = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const startDate = new Date();
    startDate.setDate(today.getDate() - daysToLookBack);
    const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // Open-Meteo API URL for hourly precipitation
    // Fetches precipitation and apparent_temperature (just as an example of another variable)
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation&start_date=${startDateStr}&end_date=${endDate}&timezone=auto`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const reason = errorData && errorData.reason ? errorData.reason : `API request failed with status: ${response.status}`;
            throw new Error(reason);
        }
        const data = await response.json();

        if (data.hourly && data.hourly.time && data.hourly.precipitation) {
            const times = data.hourly.time;
            const precipitationData = data.hourly.precipitation;
            let lastRainDateTime = null;

            // Iterate backwards through the hourly data
            for (let i = times.length - 1; i >= 0; i--) {
                if (precipitationData[i] > PRECIPITATION_THRESHOLD) {
                    lastRainDateTime = new Date(times[i]);
                    break; // Found the most recent rain event
                }
            }

            if (lastRainDateTime) {
                const now = new Date();
                const diffMillis = now - lastRainDateTime;

                // Handle cases where last rain is in the future (data oddity or very recent)
                if (diffMillis < 0) {
                    resultDiv.innerHTML = `<p>Precipitation is forecasted or occurring now (${lastRainDateTime.toLocaleString()}).</p>`;
                    return;
                }

                const diffSeconds = Math.floor(diffMillis / 1000);
                const diffMinutes = Math.floor(diffSeconds / 60);
                const diffHoursTotal = Math.floor(diffMinutes / 60);
                const diffDays = Math.floor(diffHoursTotal / 24);
                const remainingHours = diffHoursTotal % 24;

                let resultString = `It last rained on ${lastRainDateTime.toLocaleDateString()} at ${lastRainDateTime.toLocaleTimeString()}. `;
                if (diffDays > 0) {
                    resultString += `That was approximately <strong>${diffDays} day(s)</strong> and <strong>${remainingHours} hour(s)</strong> ago.`;
                } else if (diffHoursTotal > 0) {
                    resultString += `That was approximately <strong>${diffHoursTotal} hour(s)</strong> ago.`;
                } else if (diffMinutes > 0) {
                    resultString += `That was approximately <strong>${diffMinutes} minute(s)</strong> ago.`;
                } else {
                    resultString += `That was less than a minute ago, or is raining now.`;
                }
                resultDiv.innerHTML = `<p>${resultString}</p>`;

            } else {
                resultDiv.innerHTML = `<p>No significant rain (>${PRECIPITATION_THRESHOLD}mm/hr) recorded in the last ${daysToLookBack} days for this location.</p>`;
            }
        } else {
            resultDiv.innerHTML = '<p>Could not retrieve valid precipitation data. The API response might have changed or lacks data for this location/period.</p>';
            console.error("API Data Structure Error:", data);
        }

    } catch (error) {
        console.error("Error fetching or processing weather data:", error);
        resultDiv.innerHTML = `<p>Error fetching weather data: ${error.message}. Check console for more details.</p>`;
    }
}
