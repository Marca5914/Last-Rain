const getLocationBtn = document.getElementById('getLocationBtn');
const resultDiv = document.getElementById('result');
const plantImage = document.getElementById('plantImage'); // Get the image element
const locationInputArea = document.getElementById('locationInputArea');
const toggleManualLocationLink = document.getElementById('toggleManualLocation');
const latitudeInput = document.getElementById('latitudeInput');
const longitudeInput = document.getElementById('longitudeInput');
const submitLocationBtn = document.getElementById('submitLocationBtn');

const PRECIPITATION_THRESHOLD = 0.1;
const IMAGE_PATH = 'images/'; // Define the path to your images

// --- Initial Plant Image ---
plantImage.src = IMAGE_PATH + 'plant_unknown.png';


getLocationBtn.addEventListener('click', () => {
    resultDiv.innerHTML = '<p>Fetching location...</p>';
    plantImage.src = IMAGE_PATH + 'plant_unknown.png'; // Reset image
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                fetchWeatherData(position.coords.latitude, position.coords.longitude);
            },
            showError
        );
    } else {
        resultDiv.innerHTML = '<p>Geolocation is not supported by this browser. Please enter location manually.</p>';
        plantImage.src = IMAGE_PATH + 'plant_very_dry.png'; // Default to dry if no geo
        showManualInput();
    }
});

submitLocationBtn.addEventListener('click', () => {
    const lat = parseFloat(latitudeInput.value);
    const lon = parseFloat(longitudeInput.value);
    plantImage.src = IMAGE_PATH + 'plant_unknown.png'; // Reset image

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        resultDiv.innerHTML = '<p>Invalid latitude or longitude. Latitude must be -90 to 90, Longitude -180 to 180.</p>';
        plantImage.src = IMAGE_PATH + 'plant_very_dry.png';
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
    plantImage.src = IMAGE_PATH + 'plant_very_dry.png'; // Set to dry on error
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

function updatePlantImage(daysSinceRain) {
    if (daysSinceRain === null) { // No data or error
        plantImage.src = IMAGE_PATH + 'plant_very_dry.png';
    } else if (daysSinceRain < 1) {
        plantImage.src = IMAGE_PATH + 'plant_healthy.png';
    } else if (daysSinceRain < 3) { // 1-2 days
        plantImage.src = IMAGE_PATH + 'plant_slightly_dry.png';
    } else if (daysSinceRain < 7) { // 3-6 days
        plantImage.src = IMAGE_PATH + 'plant_moderately_dry.png';
    } else { // 7+ days
        plantImage.src = IMAGE_PATH + 'plant_very_dry.png';
    }
}

async function fetchWeatherData(lat, lon) {
    resultDiv.innerHTML = `<p>Fetching weather data for Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}...</p>`;
    plantImage.src = IMAGE_PATH + 'plant_unknown.png'; // Loading state

    const daysToLookBack = 90;
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];

    const startDate = new Date();
    startDate.setDate(today.getDate() - daysToLookBack);
    const startDateStr = startDate.toISOString().split('T')[0];

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
                    updatePlantImage(0); // Raining now or very recent
                    return;
                }

                const diffSeconds = Math.floor(diffMillis / 1000);
                const diffMinutes = Math.floor(diffSeconds / 60);
                const diffHoursTotal = Math.floor(diffMinutes / 60);
                const diffDays = Math.floor(diffHoursTotal / 24);
                const remainingHours = diffHoursTotal % 24;

                updatePlantImage(diffDays); // Update plant image based on days

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
                updatePlantImage(daysToLookBack); // Max dryness if no rain in lookback period
            }
        } else {
            resultDiv.innerHTML = '<p>Could not retrieve valid precipitation data. The API response might have changed or lacks data for this location/period.</p>';
            updatePlantImage(null); // Error state for plant
            console.error("API Data Structure Error:", data);
        }

    } catch (error) {
        console.error("Error fetching or processing weather data:", error);
        resultDiv.innerHTML = `<p>Error fetching weather data: ${error.message}. Check console for more details.</p>`;
        updatePlantImage(null); // Error state for plant
    }
}
