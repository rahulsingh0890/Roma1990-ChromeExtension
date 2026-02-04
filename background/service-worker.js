// Roma1990 Pomodoro Timer - Service Worker (Background Timer Engine)
// Uses absolute endTime timestamps for resilience to service worker termination.

const DEFAULT_STATE = {
  timerState: 'idle',
  durationMinutes: 25,
  endTime: null,
  sessions: { date: new Date().toDateString(), count: 0 }
};

// === State Management ===

async function getState() {
  const result = await chrome.storage.local.get('pomodoroState');
  return result.pomodoroState || { ...DEFAULT_STATE };
}

async function setState(updates) {
  const current = await getState();
  const newState = { ...current, ...updates };
  await chrome.storage.local.set({ pomodoroState: newState });
  return newState;
}

// === Badge Updates ===

let badgeInterval = null;

async function updateBadge() {
  const state = await getState();

  if (state.timerState === 'running' && state.endTime) {
    const remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));

    // Check if timer should have completed (safety net for missed alarms)
    if (remaining === 0) {
      await handleCompletion();
      return;
    }

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    // "25m" for > 5 min, "4:32" for last 5 min
    const text = mins >= 5 ? `${mins}m` : `${mins}:${secs.toString().padStart(2, '0')}`;
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#E86F4A' });
  } else if (state.timerState === 'completed') {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

function startBadgeUpdates() {
  stopBadgeUpdates();
  badgeInterval = setInterval(updateBadge, 1000);
}

function stopBadgeUpdates() {
  if (badgeInterval) {
    clearInterval(badgeInterval);
    badgeInterval = null;
  }
}

// === Timer Control ===

async function startTimer(durationMinutes) {
  const endTime = Date.now() + durationMinutes * 60 * 1000;
  await setState({ timerState: 'running', durationMinutes, endTime });

  // Set completion alarm
  chrome.alarms.create('pomodoroComplete', { when: endTime });

  // Start badge updates
  startBadgeUpdates();
  updateBadge();
}

async function stopTimer() {
  await setState({ timerState: 'idle', endTime: null });
  chrome.alarms.clear('pomodoroComplete');
  stopBadgeUpdates();
  updateBadge();
}

// === Completion Handling ===

async function handleCompletion() {
  const state = await getState();

  // Prevent double-completion
  if (state.timerState !== 'running') return;

  // Increment session count
  const today = new Date().toDateString();
  let sessions = state.sessions || { date: today, count: 0 };
  if (sessions.date !== today) {
    sessions = { date: today, count: 0 };
  }
  sessions.count += 1;

  await setState({ timerState: 'completed', endTime: null, sessions });
  stopBadgeUpdates();
  updateBadge();

  // Show notification
  chrome.notifications.create('pomodoroComplete', {
    type: 'basic',
    iconUrl: '../icons/icon128.png',
    title: 'Pomodoro Complete!',
    message: `Session #${sessions.count} finished. Great work!`,
    priority: 2
  });

  // Auto-reset after 3 seconds
  setTimeout(async () => {
    const currentState = await getState();
    if (currentState.timerState === 'completed') {
      await setState({ timerState: 'idle' });
      updateBadge();
    }
  }, 3000);
}

// === Alarm Handler ===

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pomodoroComplete') {
    await handleCompletion();
  }
});

// === Message Handling (popup <-> service worker) ===

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_STATE': {
      const state = await getState();
      let remainingSeconds;

      if (state.timerState === 'running' && state.endTime) {
        remainingSeconds = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));

        // Safety net: if timer expired while service worker was asleep
        if (remainingSeconds === 0) {
          await handleCompletion();
          const updatedState = await getState();
          return { ...updatedState, remainingSeconds: 0 };
        }

        // Ensure badge updates are running while timer is active
        startBadgeUpdates();
      } else if (state.timerState === 'idle') {
        remainingSeconds = state.durationMinutes * 60;
      } else {
        remainingSeconds = 0;
      }

      return { ...state, remainingSeconds };
    }

    case 'START_TIMER':
      await startTimer(message.durationMinutes);
      return { success: true };

    case 'STOP_TIMER':
      await stopTimer();
      return { success: true };

    case 'SET_DURATION': {
      await setState({ durationMinutes: message.durationMinutes });
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// === Service Worker Lifecycle ===

// When Chrome starts up, check for active timer
chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  if (state.timerState === 'running' && state.endTime) {
    const remaining = state.endTime - Date.now();
    if (remaining <= 0) {
      await handleCompletion();
    } else {
      chrome.alarms.create('pomodoroComplete', { when: state.endTime });
      startBadgeUpdates();
      updateBadge();
    }
  }
});

// On extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ pomodoroState: { ...DEFAULT_STATE } });
  }
  updateBadge();
});
