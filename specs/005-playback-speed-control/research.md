# Research: Playback Speed Control

**Feature**: 005-playback-speed-control
**Date**: 2025-10-19
**Status**: Complete

## Research Tasks Completed

### 1. HTMLAudioElement.playbackRate API Research

**Decision**: Use browser's native `HTMLAudioElement.playbackRate` property

**Rationale**:
- Standard Web Audio API feature supported in all modern browsers (Chrome 88+)
- No external libraries or polyfills needed
- Property accepts decimal values (0.5 = half speed, 2.0 = double speed)
- Changes apply instantly without interrupting playback
- Browser handles pitch preservation and audio quality automatically
- Zero performance overhead (browser-native implementation)

**Alternatives Considered**:
- **Web Audio API (AudioContext, AudioBufferSourceNode)**: More complex, requires rewriting existing AudioPlayer implementation. Rejected because current HTMLAudioElement approach works well and playbackRate is sufficient.
- **Third-party library (Tone.js, Howler.js)**: Adds unnecessary bundle size (~50-200KB). Rejected because native API provides all needed functionality.
- **Custom time-stretching algorithm**: Extremely complex, poor audio quality without significant DSP expertise. Rejected as reinventing the wheel.

**Implementation Notes**:
```javascript
// Simple, instant speed change
audioElement.playbackRate = 1.5; // Plays at 1.5x speed

// Validation before setting
function setPlaybackSpeed(rate) {
  if (rate < 0.5 || rate > 2.0) {
    console.error('Invalid playback rate:', rate);
    return false;
  }
  audioElement.playbackRate = rate;
  return true;
}
```

**Browser Compatibility**:
- Chrome 88+: ✅ Full support
- Edge 88+: ✅ Full support
- Safari 14.1+: ✅ Full support
- Firefox 85+: ✅ Full support

Source: [MDN Web Docs - HTMLMediaElement.playbackRate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate)

---

### 2. Storage Strategy for Speed Preference

**Decision**: Use `chrome.storage.local` with key `playbackSpeed`

**Rationale**:
- chrome.storage.local persists across browser sessions (unlike chrome.storage.session)
- Already used in extension for API key storage (consistent pattern)
- Async API compatible with Manifest V3 service workers
- Storage quota (5MB) far exceeds needs (~8 bytes for float value)
- No need for chrome.storage.sync (speed preference is device-specific, not user-profile-specific)

**Alternatives Considered**:
- **chrome.storage.session**: Doesn't persist across browser restarts. Rejected because spec requires "speed remembered across sessions".
- **chrome.storage.sync**: Syncs across devices via Chrome Sync. Rejected because listening speed preference is likely device-specific (mobile vs desktop, headphones vs speakers).
- **IndexedDB**: Overkill for single value. Rejected due to unnecessary complexity.
- **localStorage**: Not compatible with service workers in Manifest V3. Rejected for compliance reasons.

**Implementation Notes**:
```javascript
// Save speed preference
async function setPlaybackSpeed(rate) {
  await chrome.storage.local.set({ playbackSpeed: rate });
}

// Load speed preference (with default fallback)
async function getPlaybackSpeed() {
  const result = await chrome.storage.local.get({ playbackSpeed: 1.0 });
  const rate = result.playbackSpeed;

  // Validate stored value
  if (typeof rate !== 'number' || rate < 0.5 || rate > 2.0) {
    console.warn('Invalid stored playback speed, using default 1.0x');
    return 1.0;
  }

  return rate;
}
```

**Storage Key Schema**:
```
Key: "playbackSpeed"
Value: Number (0.5 - 2.0)
Default: 1.0
Size: ~8 bytes
```

---

### 3. UI Pattern for Speed Control

**Decision**: Compact dropdown menu with 7 preset buttons

**Rationale**:
- Fits within existing control panel layout without overflow
- Dropdown conserves space (closed by default, expands on click)
- 7 presets cover common use cases (0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x)
- Single-click access to any speed (no slider dragging required)
- Clear visual labels (e.g., "1.5x" button text)
- Mobile-friendly (tap targets ≥ 44x44px when expanded)

**Alternatives Considered**:
- **Horizontal button group (all 7 buttons visible)**: Takes too much space, would overflow on mobile. Rejected due to responsive design constraints.
- **Slider/range input**: Precise but slower to use, no clear presets. Rejected because users want "quick access to common speeds" per spec.
- **Number input field**: Allows custom speeds but adds complexity and validation. Rejected because spec explicitly lists "Custom speed input" as out-of-scope.
- **Nested menu (speed → submenu)**: Extra click required. Rejected for user experience reasons.

**Implementation Notes**:
```html
<!-- Compact dropdown approach (preferred) -->
<div class="speed-control">
  <button id="speed-toggle" aria-label="Playback speed">
    <span id="speed-current">1x</span> ▼
  </button>
  <div id="speed-menu" class="speed-menu hidden">
    <button data-speed="0.5">0.5x</button>
    <button data-speed="0.75">0.75x</button>
    <button data-speed="1.0" class="active">1x</button>
    <button data-speed="1.25">1.25x</button>
    <button data-speed="1.5">1.5x</button>
    <button data-speed="1.75">1.75x</button>
    <button data-speed="2.0">2x</button>
  </div>
</div>
```

**CSS Considerations**:
- Dropdown positioned absolutely relative to control panel
- z-index higher than control panel background but below max
- Smooth expand/collapse animation (CSS transitions)
- Active preset highlighted with different background color
- Mobile: Full-width dropdown, larger tap targets

---

### 4. Message Passing Architecture

**Decision**: Extend existing message types with speed control messages

**Rationale**:
- Reuses proven pattern from feature 004 (pause/resume/stop controls)
- Content script → Background → Offscreen flow already established
- Background service worker handles storage read/write (centralized state)
- Offscreen document applies speed (direct access to AudioPlayer)

**Message Types Required**:
1. `CONTROL_SPEED_CHANGED` (content → background): User clicked speed preset
2. `SET_PLAYBACK_SPEED` (background → offscreen): Apply speed to AudioPlayer
3. `SPEED_APPLIED` (offscreen → background → content): Confirm speed change (optional, for UI feedback)

**Alternatives Considered**:
- **Direct content → offscreen messaging**: Chrome doesn't support this. Must route through background service worker. No alternative.
- **Store speed in content script**: Would lose preference on page navigation/refresh. Rejected because background service worker is persistent state manager.
- **Polling for speed updates**: Inefficient and unnecessary. Rejected in favor of event-driven messages.

**Implementation Notes**:
```javascript
// Content script (speed preset clicked)
async function handleSpeedChange(newSpeed) {
  const response = await chrome.runtime.sendMessage({
    type: 'CONTROL_SPEED_CHANGED',
    payload: { speed: newSpeed },
    timestamp: Date.now()
  });

  if (response.success) {
    updateSpeedUI(newSpeed); // Update dropdown display
  }
}

// Background service worker (route and persist)
if (message.type === 'CONTROL_SPEED_CHANGED') {
  const { speed } = message.payload;

  // Save preference
  await chrome.storage.local.set({ playbackSpeed: speed });

  // Forward to offscreen
  chrome.runtime.sendMessage({
    type: 'SET_PLAYBACK_SPEED',
    payload: { speed },
    timestamp: Date.now()
  });

  sendResponse({ success: true });
}

// Offscreen document (apply to AudioPlayer)
if (message.type === 'SET_PLAYBACK_SPEED') {
  if (audioPlayer && audioPlayer.audio) {
    audioPlayer.setPlaybackSpeed(message.payload.speed);
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: 'No audio playing' });
  }
}
```

---

### 5. Auto-apply Saved Speed Preference

**Decision**: Load and apply saved speed when audio starts playing

**Rationale**:
- Spec requirement: "speed preference remembered for future audio sessions"
- User expects speed to persist (don't have to set it every time)
- Load preference during `LOAD_AUDIO` or `PLAY_AUDIO` phase
- Apply before audio starts to avoid mid-playback speed change (smoother UX)

**Implementation Strategy**:
1. Background service worker loads preference from chrome.storage.local during `PLAY_AUDIO`
2. Pass saved speed as payload in `PLAY_AUDIO` message to offscreen
3. Offscreen applies speed immediately after loading audio (before playback starts)
4. Content script updates UI to reflect saved speed when control panel appears

**Alternatives Considered**:
- **Apply after audio starts**: Causes brief moment of wrong speed. Rejected for user experience.
- **Always start at 1x, then apply saved**: Same issue as above. Rejected.
- **Let user manually set speed each time**: Violates spec requirement. Rejected.

**Implementation Notes**:
```javascript
// Background: Load preference before starting playback
async function handleTTSRequest(payload, tabId) {
  // ... existing TTS logic ...

  // Load saved speed preference
  const savedSpeed = await getPlaybackSpeed(); // Defaults to 1.0

  // Start playback with saved speed
  const playResult = await chrome.runtime.sendMessage({
    type: 'PLAY_AUDIO',
    payload: { initialSpeed: savedSpeed },
    timestamp: Date.now()
  });

  // Notify content script (so UI shows correct speed)
  chrome.tabs.sendMessage(tabId, {
    type: 'AUDIO_PLAYBACK_STARTED',
    payload: { duration, currentSpeed: savedSpeed },
    timestamp: Date.now()
  });
}

// Offscreen: Apply initial speed
async function handlePlayAudio(payload) {
  const { initialSpeed = 1.0 } = payload;

  await audioPlayer.play();
  audioPlayer.setPlaybackSpeed(initialSpeed); // Apply saved preference
}
```

---

## Research Summary

All technical unknowns resolved:

✅ **Playback Rate API**: Use native `HTMLAudioElement.playbackRate` (instant, no libraries)
✅ **Storage**: `chrome.storage.local` with key `playbackSpeed`, default `1.0`
✅ **UI Pattern**: Compact dropdown with 7 preset buttons
✅ **Messages**: Extend existing architecture with `CONTROL_SPEED_CHANGED`, `SET_PLAYBACK_SPEED`
✅ **Auto-apply**: Load preference during `PLAY_AUDIO`, apply before playback starts

**No unresolved questions**. Ready for Phase 1 (Data Model & Contracts).

---

**Next Phase**: Generate data-model.md, contracts/messages.md, and quickstart.md
