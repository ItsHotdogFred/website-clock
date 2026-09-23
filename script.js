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
let currentMode = 'clock';
let stopwatchElapsedMs = 0;
let stopwatchStartedAt = 0;
let stopwatchIntervalId;
let lapCount = 0;
let timerDurationMs = 60_000;
let timerRemainingMs = 60_000;
let timerEndsAt = 0;
let timerIntervalId;
let timerFinished = false;
let flipThemeActive = false;

const AMBIENCE_VOLUME_SCALE = 0.3;
const SCREAM_CHANCE = 1 / 500;
const THEME_TOGGLE_WINDOW_MS = 10_000;
const THEME_TOGGLE_EASTER_EGG_THRESHOLD = 15;
const TICK_AUDIO_LEAD_MS = 250;

// DOM Elements
const clockEl = document.getElementById('clock');
const clockSecondsEl = document.getElementById('clock-seconds');
const clockAmpmEl = document.getElementById('clock-ampm');
const locationEl = document.getElementById('location');
const clockModeBtn = document.getElementById('clock-mode');
const stopwatchModeBtn = document.getElementById('stopwatch-mode');
const timerModeBtn = document.getElementById('timer-mode');
const formatBtn = document.getElementById('format-toggle');
const themeBtn = document.getElementById('theme-toggle');
const stopwatchControlsEl = document.getElementById('stopwatch-controls');
const stopwatchStartBtn = document.getElementById('stopwatch-start');
const stopwatchLapBtn = document.getElementById('stopwatch-lap');
const stopwatchResetBtn = document.getElementById('stopwatch-reset');
const timerControlsEl = document.getElementById('timer-controls');
const timerMinutesInput = document.getElementById('timer-minutes');
const timerStartBtn = document.getElementById('timer-start');
const timerResetBtn = document.getElementById('timer-reset');
const lapListEl = document.getElementById('lap-list');
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
    if (localStorage.getItem('flipTheme') === 'true') {
        flipThemeActive = true;
        document.body.setAttribute('data-theme', 'flip');
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

    updateLocationDisplay();
    updateClock(); // Initial call
    startAccurateClockUpdates();
}

function updateClock() {
    if (currentMode !== 'clock') {
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

    if (flipThemeActive) {
        const parts = formatter.formatToParts(now);
        const partValue = (type) => parts.find((part) => part.type === type)?.value ?? '';

        clockEl.textContent = `${partValue('hour')}:${partValue('minute')}`;
        clockSecondsEl.textContent = partValue('second');
        clockAmpmEl.textContent = is24Hour ? '' : partValue('dayPeriod').toLowerCase().replace(/^([ap])m$/, '$1.m.');
        clockAmpmEl.classList.toggle('hidden', is24Hour);
        updateDateDisplay();
    } else {
        clockEl.textContent = formatter.format(now);
    }

    randomScreamingMan()
}

// Shows the timezone (original look) or today's date (split-flap theme)
function updateLocationDisplay() {
    if (flipThemeActive) {
        updateDateDisplay();
    } else {
        locationEl.textContent = currentTimezone.replace(/_/g, ' ');
    }
}

function updateDateDisplay() {
    const options = {
        timeZone: currentTimezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };

    const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(new Date());
    const partValue = (type) => parts.find((part) => part.type === type)?.value ?? '';

    locationEl.textContent = `${partValue('weekday')}, ${partValue('day')} ${partValue('month')} ${partValue('year')}`;
}

// Format Toggle Handler
formatBtn.addEventListener('click', () => {
    is24Hour = !is24Hour;
    formatBtn.textContent = is24Hour ? 'Switch to 12h' : 'Switch to 24h';
    localStorage.setItem('is24hour', is24Hour)
    updateClock();
});

clockModeBtn.addEventListener('click', () => switchMode('clock'));
stopwatchModeBtn.addEventListener('click', () => switchMode('stopwatch'));
timerModeBtn.addEventListener('click', () => switchMode('timer'));

stopwatchStartBtn.addEventListener('click', () => {
    if (stopwatchIntervalId) {
        pauseStopwatch();
        return;
    }

    stopwatchStartedAt = Date.now() - stopwatchElapsedMs;
    stopwatchStartBtn.textContent = 'Pause';
    updateStopwatchDisplay();
    stopwatchIntervalId = setInterval(() => {
        if (currentMode === 'stopwatch') {
            updateStopwatchDisplay();
        }
    }, 100);
});

stopwatchLapBtn.addEventListener('click', () => {
    const elapsedMs = getStopwatchElapsedMs();

    if (elapsedMs <= 0) {
        return;
    }

    lapCount += 1;
    const lapItem = document.createElement('li');
    lapItem.textContent = `Lap ${lapCount}: ${formatElapsedTime(elapsedMs)}`;
    lapListEl.prepend(lapItem);
    lapListEl.classList.remove('hidden');
});

stopwatchResetBtn.addEventListener('click', () => {
    pauseStopwatch();
    stopwatchElapsedMs = 0;
    lapCount = 0;
    lapListEl.innerHTML = '';
    lapListEl.classList.add('hidden');
    updateStopwatchDisplay();
});

timerMinutesInput.addEventListener('input', () => {
    if (timerIntervalId) {
        return;
    }

    syncTimerDurationFromInput();
    timerRemainingMs = timerDurationMs;
    timerFinished = false;
    updateTimerDisplay();
});

timerStartBtn.addEventListener('click', () => {
    if (timerIntervalId) {
        pauseTimer();
        return;
    }

    if (timerFinished || timerRemainingMs <= 0) {
        syncTimerDurationFromInput();
        timerRemainingMs = timerDurationMs;
        timerFinished = false;
    }

    timerEndsAt = Date.now() + timerRemainingMs;
    timerStartBtn.textContent = 'Pause';
    updateTimerDisplay();
    timerIntervalId = setInterval(updateTimerDisplay, 100);
});

timerResetBtn.addEventListener('click', () => {
    pauseTimer();
    syncTimerDurationFromInput();
    timerRemainingMs = timerDurationMs;
    timerFinished = false;
    updateTimerDisplay();
});

// Theme Toggle Handler
themeBtn.addEventListener('click', () => {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';

    flipThemeActive = false;
    localStorage.setItem('flipTheme', 'false');

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

// Typing "new" anywhere on the page toggles the split-flap gold theme
const THEME_EASTER_EGG_WORD = 'new';
let typedThemeBuffer = '';

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }

    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
    }

    if (event.key.length !== 1) {
        return;
    }

    typedThemeBuffer = (typedThemeBuffer + event.key.toLowerCase()).slice(-THEME_EASTER_EGG_WORD.length);

    if (typedThemeBuffer === THEME_EASTER_EGG_WORD) {
        typedThemeBuffer = '';
        toggleFlipTheme();
    }
});

function toggleFlipTheme() {
    flipThemeActive = !flipThemeActive;
    localStorage.setItem('flipTheme', flipThemeActive);

    if (flipThemeActive) {
        document.body.setAttribute('data-theme', 'flip');
    } else if (localStorage.getItem('theme') === 'Dark Mode') {
        document.body.setAttribute('data-theme', 'dark');
    } else {
        document.body.removeAttribute('data-theme');
    }

    if (currentMode === 'clock') {
        updateLocationDisplay();
        updateClock();
    }

    playThemeTransition();
}

function playThemeTransition() {
    const overlay = document.getElementById('theme-flash-overlay');
    const body = document.body;

    overlay.classList.remove('active');
    body.classList.remove('theme-transition');
    void overlay.offsetWidth;

    overlay.classList.add('active');
    body.classList.add('theme-transition');

    setTimeout(() => {
        overlay.classList.remove('active');
        body.classList.remove('theme-transition');
    }, 900);
}

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

function switchMode(mode) {
    currentMode = mode;

    clockModeBtn.classList.toggle('hidden', mode === 'clock');
    stopwatchModeBtn.classList.toggle('hidden', mode === 'stopwatch');
    timerModeBtn.classList.toggle('hidden', mode === 'timer');
    formatBtn.classList.toggle('hidden', mode !== 'clock');
    stopwatchControlsEl.classList.toggle('hidden', mode !== 'stopwatch');
    timerControlsEl.classList.toggle('hidden', mode !== 'timer');
    lapListEl.classList.toggle('hidden', mode !== 'stopwatch' || lapCount === 0);

    document.getElementById('clock-suffix').classList.toggle('hidden', mode !== 'clock');

    if (mode === 'clock') {
        updateLocationDisplay();
        updateClock();
    } else if (mode === 'stopwatch') {
        locationEl.textContent = 'Stopwatch';
        updateStopwatchDisplay();
    } else {
        locationEl.textContent = 'Timer';
        updateTimerDisplay();
    }
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

function getStopwatchElapsedMs() {
    return stopwatchIntervalId ? Date.now() - stopwatchStartedAt : stopwatchElapsedMs;
}

function updateStopwatchDisplay() {
    if (currentMode !== 'stopwatch') {
        return;
    }

    clockEl.textContent = formatElapsedTime(getStopwatchElapsedMs());
}

function formatElapsedTime(elapsedMs) {
    const totalTenths = Math.floor(elapsedMs / 100);
    const tenths = totalTenths % 10;
    const totalSeconds = Math.floor(totalTenths / 10);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

function syncTimerDurationFromInput() {
    const minutes = Math.max(0, Number(timerMinutesInput.value) || 0);
    timerDurationMs = Math.max(1000, Math.round(minutes * 60_000));
}

function pauseTimer() {
    if (!timerIntervalId) {
        timerStartBtn.textContent = 'Start';
        return;
    }

    clearInterval(timerIntervalId);
    timerIntervalId = null;
    timerRemainingMs = Math.max(0, timerEndsAt - Date.now());
    timerStartBtn.textContent = 'Start';
}

function updateTimerDisplay() {
    if (timerIntervalId) {
        timerRemainingMs = Math.max(0, timerEndsAt - Date.now());
    }

    if (currentMode === 'timer') {
        clockEl.textContent = formatTimerTime(timerRemainingMs);
    }

    if (timerIntervalId && timerRemainingMs <= 0) {
        clearInterval(timerIntervalId);
        timerIntervalId = null;
        timerFinished = true;
        timerStartBtn.textContent = 'Start';
        playScreamingMan();
    }
}

function formatTimerTime(remainingMs) {
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function playScreamingMan() {
    manaudio.loop = false;
    manaudio.currentTime = 0;
    manaudio.play().catch(() => {});
}

async function randomScreamingMan() {
    if (screamLoopActive) {
        return;
    }

    setTimeout(() => {
        const number = Math.random()
        if (number <= SCREAM_CHANCE) {
            playScreamingMan()
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
