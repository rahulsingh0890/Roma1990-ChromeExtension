// Roma1990 Pomodoro Timer - Popup UI Logic

// === FlipCard Class ===
// Vanilla JS equivalent of the React FlipCard component.
// Tracks digit changes and triggers CSS flip animations.

class FlipCard {
  constructor(containerEl) {
    this.container = containerEl;
    this.currentDigit = '0';
    this.previousDigit = '0';
    this.isFlipping = false;
    this.flipTimeout = null;
    this.render();
  }

  setDigit(newDigit) {
    if (newDigit === this.currentDigit) return;

    // Cancel any in-progress flip
    if (this.flipTimeout) {
      clearTimeout(this.flipTimeout);
    }

    this.previousDigit = this.currentDigit;
    this.isFlipping = true;
    this.render();

    // After animation completes (600ms), update to new digit
    this.flipTimeout = setTimeout(() => {
      this.currentDigit = newDigit;
      this.isFlipping = false;
      this.flipTimeout = null;
      this.render();
    }, 600);
  }

  // Force-set digit without animation (for initial render)
  setDigitImmediate(digit) {
    if (this.flipTimeout) {
      clearTimeout(this.flipTimeout);
      this.flipTimeout = null;
    }
    this.currentDigit = digit;
    this.previousDigit = digit;
    this.isFlipping = false;
    this.render();
  }

  render() {
    const displayTop = this.isFlipping ? this.previousDigit : this.currentDigit;

    let flipHtml = '';
    if (this.isFlipping) {
      flipHtml = `
        <div class="flip-top flip-top-animation"><span>${this.previousDigit}</span></div>
        <div class="flip-bottom flip-bottom-animation"><span>${this.currentDigit}</span></div>
      `;
    }

    this.container.innerHTML = `
      <div class="card-inner">
        <div class="top-half"><span>${displayTop}</span></div>
        <div class="bottom-half"><span>${this.currentDigit}</span></div>
        ${flipHtml}
      </div>
    `;
  }
}

// === DOM References ===

const flipClock = document.getElementById('flipClock');
const slider = document.getElementById('durationSlider');
const durationDisplay = document.getElementById('durationDisplay');
const actionButton = document.getElementById('actionButton');
const sessionCount = document.getElementById('sessionCount');
const sessionLabel = document.getElementById('sessionLabel');

// === Initialize FlipCards ===

const cards = {
  minTens: new FlipCard(document.getElementById('minTens')),
  minOnes: new FlipCard(document.getElementById('minOnes')),
  secTens: new FlipCard(document.getElementById('secTens')),
  secOnes: new FlipCard(document.getElementById('secOnes'))
};

// === State ===

let currentState = null;
let previousTimerState = null;
let updateInterval = null;

// === Audio Chime (ported from useSound.ts) ===

let audioContext = null;

function playChime() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  const ctx = audioContext;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const playNote = (frequency, startTime, duration) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  };

  const now = ctx.currentTime;
  playNote(523.25, now, 0.4);        // C5
  playNote(659.25, now + 0.15, 0.5); // E5
}

// === Service Worker Communication ===

async function fetchState() {
  return chrome.runtime.sendMessage({ type: 'GET_STATE' });
}

// === Display Updates ===

function updateDisplay(totalSeconds, timerState, sessions) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const minStr = mins.toString().padStart(2, '0');
  const secStr = secs.toString().padStart(2, '0');

  cards.minTens.setDigit(minStr[0]);
  cards.minOnes.setDigit(minStr[1]);
  cards.secTens.setDigit(secStr[0]);
  cards.secOnes.setDigit(secStr[1]);

  // Update button state
  if (timerState === 'running') {
    actionButton.textContent = 'Stop';
    actionButton.className = 'action-button stop';
    actionButton.disabled = false;
  } else if (timerState === 'completed') {
    actionButton.textContent = 'Start';
    actionButton.className = 'action-button start';
    actionButton.disabled = true;
  } else {
    actionButton.textContent = 'Start';
    actionButton.className = 'action-button start';
    actionButton.disabled = false;
  }

  // Update slider disabled state
  slider.disabled = (timerState === 'running' || timerState === 'completed');

  // Update session counter
  if (sessions) {
    const today = new Date().toDateString();
    const count = (sessions.date === today) ? sessions.count : 0;
    sessionCount.textContent = count;
    sessionLabel.textContent = count === 1 ? 'session' : 'sessions';
  }

  // Pulse effect for completion
  if (timerState === 'completed') {
    flipClock.classList.add('pulse');
  } else {
    flipClock.classList.remove('pulse');
  }
}

function updateSliderProgress() {
  const progress = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty('--progress', `${progress}%`);
}

// === Tick Loop ===

async function tick() {
  try {
    const state = await fetchState();
    currentState = state;

    let displaySeconds;
    if (state.timerState === 'running') {
      displaySeconds = state.remainingSeconds;
    } else if (state.timerState === 'idle') {
      displaySeconds = state.durationMinutes * 60;
    } else {
      displaySeconds = 0;
    }

    updateDisplay(displaySeconds, state.timerState, state.sessions);

    // Play chime when transitioning to completed
    if (state.timerState === 'completed' && previousTimerState === 'running') {
      playChime();
    }
    previousTimerState = state.timerState;
  } catch (err) {
    // Popup may have been disconnected; ignore
  }
}

// === Initialization ===

async function init() {
  try {
    const state = await fetchState();
    currentState = state;
    previousTimerState = state.timerState;

    // Set slider to saved duration
    slider.value = state.durationMinutes;
    updateSliderProgress();
    durationDisplay.textContent = `${state.durationMinutes} minutes`;

    // Set initial digits without animation
    let displaySeconds;
    if (state.timerState === 'running') {
      displaySeconds = state.remainingSeconds;
    } else if (state.timerState === 'idle') {
      displaySeconds = state.durationMinutes * 60;
    } else {
      displaySeconds = 0;
    }

    const mins = Math.floor(displaySeconds / 60);
    const secs = displaySeconds % 60;
    const minStr = mins.toString().padStart(2, '0');
    const secStr = secs.toString().padStart(2, '0');

    cards.minTens.setDigitImmediate(minStr[0]);
    cards.minOnes.setDigitImmediate(minStr[1]);
    cards.secTens.setDigitImmediate(secStr[0]);
    cards.secOnes.setDigitImmediate(secStr[1]);

    // Update UI state (button, slider, session counter)
    updateDisplay(displaySeconds, state.timerState, state.sessions);

    // Start tick loop
    updateInterval = setInterval(tick, 1000);
  } catch (err) {
    console.error('Failed to initialize popup:', err);
  }
}

// === Event Handlers ===

slider.addEventListener('input', async (e) => {
  const value = Number(e.target.value);
  durationDisplay.textContent = `${value} minutes`;
  updateSliderProgress();

  await chrome.runtime.sendMessage({ type: 'SET_DURATION', durationMinutes: value });

  // Update display immediately if idle
  if (currentState && currentState.timerState === 'idle') {
    const totalSeconds = value * 60;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const minStr = mins.toString().padStart(2, '0');
    const secStr = secs.toString().padStart(2, '0');

    cards.minTens.setDigit(minStr[0]);
    cards.minOnes.setDigit(minStr[1]);
    cards.secTens.setDigit(secStr[0]);
    cards.secOnes.setDigit(secStr[1]);
  }
});

actionButton.addEventListener('click', async () => {
  if (!currentState) return;

  if (currentState.timerState === 'running') {
    await chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
  } else if (currentState.timerState === 'idle') {
    const duration = Number(slider.value);
    await chrome.runtime.sendMessage({ type: 'START_TIMER', durationMinutes: duration });
  }

  // Immediately tick to update display
  await tick();
});

// === Cleanup ===

window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

// === Boot ===

init();
