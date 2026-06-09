// State
let is24Hour = false;
let currentTimezone = 'Pacific/Auckland'; // Default to NZST
let timeInterval;
let clockStartTimeoutId;
let tickIntervalId;
let tickStartTimeoutId;
let playTikNext = true;
let themeToggleCount = 0;
let themeToggleWindowStart = 0;
let screamLoopActive = false;
let isStopwatchMode = false;
let stopwatchElapsedMs = 0;
let stopwatchStartedAt = 0;
let stopwatchIntervalId;

const AMBIENCE_VOLUME_SCALE = 0.3;
const SCREAM_CHANCE = 1 / 500;
const THEME_TOGGLE_WINDOW_MS = 10_000;
const THEME_TOGGLE_EASTER_EGG_THRESHOLD = 15;
const TICK_AUDIO_LEAD_MS = 250;

// DOM Elements
const clockEl = document.getElementById('clock');
const locationEl = document.getElementById('location');
const modeBtn = document.getElementById('mode-toggle');
const formatBtn = document.getElementById('format-toggle');
const themeBtn = document.getElementById('theme-toggle');
const stopwatchControlsEl = document.getElementById('stopwatch-controls');
const stopwatchStartBtn = document.getElementById('stopwatch-start');
const stopwatchResetBtn = document.getElementById('stopwatch-reset');
const tikAudio = document.getElementById('tik-audio')
const tokAudio = document.getElementById('tok-audio')
const backgroundaudio = document.getElementById('background-audio')
const manaudio = document.getElementById('man-audio')

manaudio.loop = false;

// Initialize
function init() {
    backgroundaudio.volume = Math.max(0, Math.min(1, backgroundaudio.volume * AMBIENCE_VOLUME_SCALE));

    if (localStorage.getItem('is24hour') !== null) {
        is24Hour = localStorage.getItem('is24hour') === 'true'
    }
    if (localStorage.getItem('theme') !== null) {
        if (localStorage.getItem('theme') === 'Dark Mode') {
            document.body.setAttribute('data-theme', 'dark');
        }
    }
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
    startAccurateClockUpdates();
}

function updateClock() {
    if (isStopwatchMode) {
        return;
    }

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

    randomScreamingMan()
}

// Format Toggle Handler
formatBtn.addEventListener('click', () => {
    is24Hour = !is24Hour;
    formatBtn.textContent = is24Hour ? 'Switch to 12h' : 'Switch to 24h';
    localStorage.setItem('is24hour', is24Hour)
    updateClock();
});

modeBtn.addEventListener('click', () => {
    isStopwatchMode = !isStopwatchMode;

    if (isStopwatchMode) {
        modeBtn.textContent = 'Clock';
        locationEl.textContent = 'Stopwatch';
        formatBtn.classList.add('hidden');
        stopwatchControlsEl.classList.remove('hidden');
        updateStopwatchDisplay();
        return;
    }

    pauseStopwatch();
    modeBtn.textContent = 'Stopwatch';
    locationEl.textContent = currentTimezone.replace(/_/g, ' ');
    formatBtn.classList.remove('hidden');
    stopwatchControlsEl.classList.add('hidden');
    updateClock();
});

stopwatchStartBtn.addEventListener('click', () => {
    if (stopwatchIntervalId) {
        pauseStopwatch();
        return;
    }

    stopwatchStartedAt = Date.now() - stopwatchElapsedMs;
    stopwatchStartBtn.textContent = 'Pause';
    updateStopwatchDisplay();
    stopwatchIntervalId = setInterval(updateStopwatchDisplay, 100);
});

stopwatchResetBtn.addEventListener('click', () => {
    pauseStopwatch();
    stopwatchElapsedMs = 0;
    updateStopwatchDisplay();
});

// Theme Toggle Handler
themeBtn.addEventListener('click', () => {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
        body.removeAttribute('data-theme');
        themeBtn.textContent = 'Dark Mode';
        localStorage.setItem('theme', 'Light Mode')
    } else {
        body.setAttribute('data-theme', 'dark');
        themeBtn.textContent = 'Light Mode';
        localStorage.setItem('theme', 'Dark Mode')
    }

    registerThemeToggleForEasterEgg();
});

async function playTick() {
    if (backgroundaudio.paused) {
        backgroundaudio.play().catch(() => {})
    }

    startAccurateTicking();
}

function startAccurateClockUpdates() {
    if (timeInterval || clockStartTimeoutId) {
        return;
    }

    const now = new Date();
    const currentMilliseconds = now.getMilliseconds();
    const millisecondsUntilNextSecond = 1000 - currentMilliseconds;
    clockStartTimeoutId = setTimeout(() => {
        updateClock();
        timeInterval = setInterval(updateClock, 1000);
        clockStartTimeoutId = null;
    }, millisecondsUntilNextSecond)
}

function startAccurateTicking() {
    if (tickIntervalId || tickStartTimeoutId) {
        return;
    }

    const playSingleTick = () => {
        const currentTickAudio = playTikNext ? tikAudio : tokAudio;
        currentTickAudio.currentTime = 0;
        currentTickAudio.play().catch(() => {});
        playTikNext = !playTikNext;
    };

    const now = new Date();
    const currentMilliseconds = now.getMilliseconds();
    let millisecondsUntillNextSecond = (1000 - currentMilliseconds) - TICK_AUDIO_LEAD_MS;
    if (millisecondsUntillNextSecond <= 0) {
        millisecondsUntillNextSecond += 1000;
    }
    tickStartTimeoutId = setTimeout(() => {
        playSingleTick();
        tickIntervalId = setInterval(playSingleTick, 1000);
        tickStartTimeoutId = null;
    }, millisecondsUntillNextSecond)

}

function pauseStopwatch() {
    if (!stopwatchIntervalId) {
        stopwatchStartBtn.textContent = 'Start';
        return;
    }

    clearInterval(stopwatchIntervalId);
    stopwatchIntervalId = null;
    stopwatchElapsedMs = Date.now() - stopwatchStartedAt;
    stopwatchStartBtn.textContent = 'Start';
}

function updateStopwatchDisplay() {
    const elapsedMs = stopwatchIntervalId ? Date.now() - stopwatchStartedAt : stopwatchElapsedMs;
    const totalTenths = Math.floor(elapsedMs / 100);
    const tenths = totalTenths % 10;
    const totalSeconds = Math.floor(totalTenths / 10);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    clockEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

async function randomScreamingMan() {
    if (screamLoopActive) {
        return;
    }

    setTimeout(() => {
        const number = Math.random()
        if (number <= SCREAM_CHANCE) {
            manaudio.currentTime = 0;
            manaudio.play().catch(() => {})
        }
    }, 1000)
}

function registerThemeToggleForEasterEgg() {
    const now = Date.now();

    if (now - themeToggleWindowStart > THEME_TOGGLE_WINDOW_MS) {
        themeToggleWindowStart = now;
        themeToggleCount = 0;
    }

    themeToggleCount += 1;

    if (themeToggleCount >= THEME_TOGGLE_EASTER_EGG_THRESHOLD) {
        activateScreamLoopEasterEgg();
    }
}

function activateScreamLoopEasterEgg() {
    if (screamLoopActive) {
        return;
    }

    screamLoopActive = true;
    manaudio.loop = true;
    manaudio.volume = 1;
    manaudio.currentTime = 0;
    manaudio.play().catch(() => {});
}

// Start the app
init();
