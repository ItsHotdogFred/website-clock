// State
let is24Hour = false;
let currentTimezone = 'Pacific/Auckland'; // Default to NZST
let timeInterval;

// DOM Elements
const clockEl = document.getElementById('clock');
const locationEl = document.getElementById('location');
const formatBtn = document.getElementById('format-toggle');
const themeBtn = document.getElementById('theme-toggle');

// Initialize
function init() {
    // Attempt to detect user's actual timezone
    try {
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (userTimezone) {
            currentTimezone = userTimezone;
        }
    } catch (e) {
        console.log("Timezone detection failed, using default NZST");
    }

    // Update location text display to show clean timezone name
    // Replacing underscores with spaces for better readability
    locationEl.textContent = currentTimezone.replace(/_/g, ' ');

    updateClock(); // Initial call
    timeInterval = setInterval(updateClock, 1000); // Update every second
}

function updateClock() {
    const now = new Date();
    
    // Options for the Intl.DateTimeFormat
    const options = {
        timeZone: currentTimezone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: !is24Hour
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    clockEl.textContent = formatter.format(now);
}

// Format Toggle Handler
formatBtn.addEventListener('click', () => {
    is24Hour = !is24Hour;
    formatBtn.textContent = is24Hour ? 'Switch to 12h' : 'Switch to 24h';
    updateClock();
});

// Theme Toggle Handler
themeBtn.addEventListener('click', () => {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
        body.removeAttribute('data-theme');
        themeBtn.textContent = 'Dark Mode';
    } else {
        body.setAttribute('data-theme', 'dark');
        themeBtn.textContent = 'Light Mode';
    }
});

// Start the app
init();