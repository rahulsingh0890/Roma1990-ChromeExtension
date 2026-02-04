# Roma1990 Pomodoro Timer - Chrome Extension

A beautiful retro flip clock Pomodoro timer that lives in your Chrome toolbar.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)

![MockUp](MockUp.png)

## Features

- **Retro Flip Clock** - 3D animated flip cards with realistic hinge, shadows, and glass reflections
- **Adjustable Timer** - Set focus sessions from 5 to 60 minutes
- **Background Timing** - Timer keeps running even when the popup is closed
- **Badge Countdown** - Remaining time shown on the extension icon (`25m`, then `4:32` for the last 5 minutes)
- **Completion Notification** - Chrome notification when your session finishes
- **Audio Chime** - Two-note chime (C5 + E5) plays on completion when the popup is open
- **Session Tracking** - Counts completed sessions per day
- **Auto-Reset** - Timer resets to idle automatically after completion

## Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/rahulsingh0890/Roma1990-ChromeExtension.git
   ```
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select the cloned `Roma1990-ChromeExtension` folder
6. The Roma1990 icon appears in your toolbar - click it to start a session

## How It Works

### Architecture

The extension uses a **timestamp-based timer** for reliability. Instead of counting down each second, it stores the absolute `endTime` when a timer starts. The remaining time is always computed as `endTime - now`, making it resilient to Chrome suspending the service worker.

```
popup.js  ──sendMessage──>  service-worker.js  ──>  chrome.storage.local
          <──sendResponse──
```

### Project Structure

```
Roma1990-ChromeExtension/
├── manifest.json              # Chrome extension manifest (V3)
├── background/
│   └── service-worker.js      # Timer engine, badge, alarms, notifications
├── popup/
│   ├── popup.html             # Popup DOM structure
│   ├── popup.css              # Retro flip clock styling
│   └── popup.js               # UI logic and flip card animations
└── icons/                     # Extension icons (16/32/48/128px)
```

### Permissions

| Permission | Purpose |
|---|---|
| `alarms` | Reliable timer completion even when service worker sleeps |
| `storage` | Persist timer state and session count |
| `notifications` | Alert when a Pomodoro session completes |

## Built With

- Vanilla JavaScript - no frameworks, no build step
- CSS 3D transforms for flip card animations
- Web Audio API for the completion chime
- Chrome Extensions Manifest V3

## Related

This is the browser extension companion to the [Roma1990 Pomodoro Timer](https://github.com/rahulsingh0890/the-pomodoro) desktop app built with Next.js and Tauri.

## License

MIT License - feel free to use and modify!

Made with love and tomatoes.
