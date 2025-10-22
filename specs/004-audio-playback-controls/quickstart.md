# Quickstart Guide: Audio Playback Controls

**Feature**: Audio Playback Controls
**Branch**: `004-audio-playback-controls`
**Date**: 2025-10-19
**Status**: Phase 1 Design

## Overview

This guide helps developers quickly set up, test, and debug the audio playback control panel feature. It covers development environment setup, testing strategies, debugging techniques, and common issues.

## Prerequisites

Before working on this feature, ensure you have:
- Chrome browser (version 88+ for Manifest V3 support)
- Chrome extension already installed in developer mode
- Basic understanding of Chrome extension architecture (content script, background service worker, offscreen document)
- Familiarity with Shadow DOM and Chrome runtime messaging

---

## Development Setup

### 1. Install the Extension

The extension should already be installed. If not:

```bash
# Navigate to extension directory
cd /Users/dany/Documents/CODE/github.com/tts-11labs-chrome-extension

# Open Chrome extensions page
# Navigate to: chrome://extensions/

# Enable "Developer mode" (toggle in top-right)
# Click "Load unpacked"
# Select the extension directory
```

### 2. Verify Extension Is Active

1. Click the extension icon in Chrome toolbar
2. Right-click and select "Manage Extension"
3. Verify **Manifest V3** is shown
4. Check permissions include:
   - `activeTab`
   - `contextMenus`
   - `storage`
   - `offscreen`

### 3. Enable Console Logging

Open Chrome DevTools for debugging:

**Content Script Console**:
```
1. Navigate to any webpage (e.g., Wikipedia)
2. Right-click → Inspect → Console tab
3. Look for: "ElevenLabs TTS content script loaded"
```

**Background Service Worker Console**:
```
1. Go to chrome://extensions/
2. Find "ElevenLabs TTS Chrome Extension"
3. Click "service worker" link (inspect views)
4. Console tab opens for background script
```

**Offscreen Document Console**:
```
1. Background service worker console (see above)
2. After audio playback starts, offscreen document logs appear
3. Look for: "[AudioPlayer]" prefixed messages
```

---

## Testing in Isolation

### Testing Control Panel UI (Without Audio)

Test control panel rendering without full audio integration:

**Create Test Stub in Content Script**:

```javascript
// Add to content.js (temporary for testing)
function testShowControlPanel() {
  console.log('TEST: Showing control panel');

  // Simulate AUDIO_PLAYBACK_STARTED message
  handleAudioPlaybackStarted({
    type: 'AUDIO_PLAYBACK_STARTED',
    payload: { duration: 60 },
    timestamp: Date.now()
  });
}

// Expose to console
window.testShowControlPanel = testShowControlPanel;
```

**Test in Browser Console** (on any webpage):

```javascript
// Show control panel
testShowControlPanel();

// Inspect Shadow DOM
const host = document.querySelector('.elevenlabs-tts-controls-host');
console.log('Host element:', host);
console.log('Shadow root:', host.shadowRoot); // Will be null (closed mode)

// Check positioning
const rect = host.getBoundingClientRect();
console.log('Position:', rect.bottom, rect.right);

// Simulate button click
const pauseBtn = host.shadowRoot.querySelector('#pause-btn'); // Won't work (closed)
// Instead, trigger via event
host.click(); // Won't work directly - buttons inside shadow DOM
```

**Test Shadow DOM Contents**:

Since Shadow DOM is closed, test by logging from within:

```javascript
// In showControlPanel() function, after creating shadow DOM:
const shadow = container.attachShadow({ mode: 'closed' });
shadow.innerHTML = `...`; // styles and content

// Add test logging
const pauseBtn = shadow.querySelector('#pause-btn');
console.log('Pause button created:', pauseBtn);
pauseBtn.addEventListener('click', () => {
  console.log('TEST: Pause button clicked');
});
```

### Testing Button State Transitions

**Test Pause → Play Toggle**:

```javascript
// Add to content.js for testing
function testToggleButton() {
  const host = document.querySelector('.elevenlabs-tts-controls-host');
  if (!host) {
    console.error('Control panel not found');
    return;
  }

  // Simulate pause
  console.log('TEST: Simulating pause');
  handleAudioPlaybackPaused({
    type: 'AUDIO_PLAYBACK_PAUSED',
    payload: { currentPosition: 10 },
    timestamp: Date.now()
  });

  // Wait 2 seconds, then simulate resume
  setTimeout(() => {
    console.log('TEST: Simulating resume');
    handleAudioPlaybackResumed({
      type: 'AUDIO_PLAYBACK_RESUMED',
      payload: { currentPosition: 10 },
      timestamp: Date.now()
    });
  }, 2000);
}

window.testToggleButton = testToggleButton;
```

### Testing Control Removal

```javascript
// Test control panel cleanup
function testHideControlPanel() {
  console.log('TEST: Hiding control panel');

  handleAudioPlaybackStopped({
    type: 'AUDIO_PLAYBACK_STOPPED',
    payload: { reason: 'user' },
    timestamp: Date.now()
  });

  // Verify removal
  setTimeout(() => {
    const host = document.querySelector('.elevenlabs-tts-controls-host');
    console.log('Control panel removed?', host === null);
  }, 100);
}

window.testHideControlPanel = testHideControlPanel;
```

---

## Debugging with Chrome DevTools

### Debugging Content Script

**Set Breakpoints**:

1. Open DevTools on webpage (F12)
2. Go to **Sources** tab
3. Navigate to: `Content Scripts → elevenlabs-tts-chrome-extension → content.js`
4. Set breakpoints in:
   - `showControlPanel()` (panel creation)
   - `handleControlPauseClicked()` (button click)
   - Message listener (line ~24)

**Watch Variables**:

Add watches in DevTools:
- `isActionPending` (debouncing flag)
- `document.querySelector('.elevenlabs-tts-controls-host')` (panel exists?)
- `window.getSelection().toString()` (selected text)

### Debugging Background Service Worker

**Monitor Message Flow**:

```javascript
// Add to background.js (if not already present)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔵 BACKGROUND received:', {
    type: message.type,
    from: sender.tab ? 'content-script' : 'offscreen',
    tabId: sender.tab?.id,
    timestamp: message.timestamp,
    payload: message.payload
  });

  // ... existing handler logic ...
});
```

**Common Checks**:

1. Verify messages are routing correctly:
   ```javascript
   // Content → Background → Offscreen
   CONTROL_PAUSE_CLICKED → PAUSE_AUDIO
   ```

2. Check for async response pattern:
   ```javascript
   // Must return true for async responses
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     // ... async work ...
     return true; // ← Required for async
   });
   ```

### Debugging Offscreen Document

**Access Offscreen Console**:

1. Background service worker console must be open
2. Audio playback must start (creates offscreen document)
3. Look for `[AudioPlayer]` log prefix
4. Offscreen logs appear in background console (same context)

**Monitor AudioPlayer State**:

```javascript
// Add to offscreen.js
audioPlayer.onStatusChange = (newStatus) => {
  console.log('🎵 AudioPlayer status changed:', {
    status: newStatus,
    position: audioPlayer.currentPosition,
    duration: audioPlayer.duration,
    hasAudio: audioPlayer.audio !== null
  });

  // ... existing notification logic ...
};
```

### Debugging Shadow DOM

**Inspect Shadow DOM Contents** (workaround for closed mode):

```javascript
// Add debug logging inside shadow DOM creation
function showControlPanel() {
  // ... create container ...
  const shadow = container.attachShadow({ mode: 'closed' });

  // Store reference for debugging (temporary)
  window.__debugShadowRoot = shadow; // ← DEBUG ONLY, remove in production

  shadow.innerHTML = `...`;

  // Log shadow contents
  console.log('Shadow DOM created:', {
    buttons: shadow.querySelectorAll('button').length,
    pauseBtn: shadow.querySelector('#pause-btn'),
    stopBtn: shadow.querySelector('#stop-btn')
  });
}

// Later, inspect in console:
window.__debugShadowRoot.querySelectorAll('button');
```

**Inspect Computed Styles**:

```javascript
// Check if control panel is positioned correctly
const host = document.querySelector('.elevenlabs-tts-controls-host');
const styles = window.getComputedStyle(host);
console.log('Control panel styles:', {
  position: styles.position,
  bottom: styles.bottom,
  right: styles.right,
  zIndex: styles.zIndex
});
```

---

## Testing Checklist

### P1 Priority Tests (Pause/Resume)

**Pause Functionality**:
- [ ] Select text on webpage, trigger TTS (context menu or popup)
- [ ] Verify control panel appears in bottom-right corner
- [ ] Audio starts playing automatically
- [ ] Control panel shows pause button (⏸) and stop button (⏹)
- [ ] Click pause button
- [ ] Verify audio stops immediately
- [ ] Verify pause button changes to play button (▶)
- [ ] Verify control panel remains visible

**Resume Functionality**:
- [ ] After pausing, click play button
- [ ] Verify audio resumes from paused position (not from start)
- [ ] Verify play button changes back to pause button (⏸)
- [ ] Verify audio continues playing to end

**Pause/Resume Rapid Clicking**:
- [ ] Click pause button multiple times rapidly
- [ ] Verify only first click is processed (debouncing works)
- [ ] Verify no duplicate pause commands sent (check background console)
- [ ] Verify button state stays consistent

**Pause/Resume Position Preservation**:
- [ ] Pause audio at 10 seconds
- [ ] Wait 5 seconds (audio still paused)
- [ ] Click play
- [ ] Verify audio resumes at 10 seconds (not 15 seconds)

### P2 Priority Tests (Stop, Auto-show)

**Stop Functionality**:
- [ ] Start audio playback
- [ ] Click stop button (⏹)
- [ ] Verify audio stops immediately
- [ ] Verify control panel disappears
- [ ] Verify playback position resets (start new audio, plays from beginning)

**Auto-show on Audio Start**:
- [ ] Select text, trigger TTS
- [ ] Verify control panel appears within 500ms of audio start
- [ ] Verify panel is visible and not obstructed by page content
- [ ] Verify panel appears in same location across different pages

**New Audio Replaces Old Controls**:
- [ ] Start audio playback (control panel shows)
- [ ] Without stopping, trigger new TTS on different text
- [ ] Verify old control panel disappears
- [ ] Verify new control panel appears
- [ ] Verify only one control panel exists at a time

### P3 Priority Tests (Auto-hide, Polish)

**Auto-hide on Audio End**:
- [ ] Start short audio clip (or let audio play to end)
- [ ] Wait for audio to finish naturally
- [ ] Verify control panel disappears within 2 seconds of audio ending
- [ ] Verify no orphaned DOM elements (inspect with DevTools)

**Responsive Positioning**:
- [ ] Test on desktop viewport (>768px width)
  - [ ] Control panel in bottom-right corner
  - [ ] Adequate margins from edges (20px)
- [ ] Test on mobile viewport (≤768px width)
  - [ ] Control panel centered at bottom
  - [ ] Margins adjusted (16px from bottom)
  - [ ] Buttons accessible with thumb

**Accessibility**:
- [ ] Tab through controls with keyboard
- [ ] Verify pause button receives focus (visible outline)
- [ ] Verify stop button receives focus
- [ ] Press Enter on focused button (should trigger click)
- [ ] Use screen reader (VoiceOver on Mac, NVDA on Windows)
  - [ ] Pause button announces as "Pause button"
  - [ ] Stop button announces as "Stop button"
  - [ ] Play button announces as "Play button"

**Cross-browser Testing** (Chromium-based):
- [ ] Test on Google Chrome (main target)
- [ ] Test on Microsoft Edge (Chromium)
- [ ] Test on Brave browser
- [ ] Verify consistent behavior across browsers

---

## Common Issues and Solutions

### Issue 1: Control Panel Doesn't Appear

**Symptoms**:
- Audio plays but no control panel shows
- Console error: "Cannot show toast: document.body is not available"

**Diagnosis**:

```javascript
// Check in content script console
console.log('document.body available?', !!document.body);
console.log('document.readyState:', document.readyState);
```

**Solutions**:

1. **Page not fully loaded**:
   ```javascript
   // Already handled in showControlPanel():
   if (!document.body) {
     if (document.readyState === 'loading') {
       document.addEventListener('DOMContentLoaded', () => showControlPanel());
       return;
     }
   }
   ```

2. **Content script not injected**:
   - Check manifest.json includes `"matches": ["<all_urls>"]` in content_scripts
   - Reload extension: chrome://extensions/ → Reload button
   - Refresh webpage

3. **Message not reaching content script**:
   - Check background console for AUDIO_PLAYBACK_STARTED send
   - Verify tab ID is correct: `chrome.tabs.query({ active: true })`

### Issue 2: Shadow DOM Creation Fails

**Symptoms**:
- Console error: "Failed to execute 'attachShadow' on 'Element'"
- Control panel host element exists but no shadow root

**Diagnosis**:

```javascript
// Check if element supports shadow DOM
const container = document.createElement('div');
console.log('Can attach shadow?', 'attachShadow' in container);
```

**Solutions**:

1. **Browser compatibility**:
   - Shadow DOM requires Chrome 53+ (should not be issue)
   - Check browser version: `chrome://version/`

2. **Already attached**:
   - Cannot attach shadow root twice to same element
   - Remove old host element before creating new one

3. **CSP violation** (rare):
   - Shadow DOM inline styles should be CSP-compliant
   - Check console for CSP errors
   - Verify no strict CSP on page blocks Shadow DOM

### Issue 3: Buttons Don't Respond to Clicks

**Symptoms**:
- Control panel visible but clicking buttons does nothing
- No console logs for button clicks

**Diagnosis**:

```javascript
// Check if event listeners attached
// Add this in showControlPanel() after attaching listeners:
const pauseBtn = shadow.querySelector('#pause-btn');
console.log('Pause button event listeners:', getEventListeners(pauseBtn)); // Chrome only
```

**Solutions**:

1. **Event listeners not attached**:
   ```javascript
   // Ensure event listeners attached AFTER shadow.innerHTML set
   shadow.innerHTML = `...`;
   const pauseBtn = shadow.querySelector('#pause-btn'); // ← Must be after innerHTML
   pauseBtn.addEventListener('click', handlePauseClick);
   ```

2. **CSS pointer-events disabled**:
   - Check button styles: `cursor: pointer;` should be present
   - Verify no `pointer-events: none;` on buttons

3. **High z-index page elements**:
   - Page modal or overlay might be covering controls
   - Verify control panel z-index: `2147483647` (max)

### Issue 4: Button State Doesn't Update

**Symptoms**:
- Audio pauses but button still shows pause icon (⏸)
- Button state out of sync with audio state

**Diagnosis**:

```javascript
// Check if confirmation message received
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUDIO_PLAYBACK_PAUSED') {
    console.log('🔵 Pause confirmation received:', message);
  }
});
```

**Solutions**:

1. **Confirmation message not received**:
   - Check background service worker is routing AUDIO_STATE_CHANGED → AUDIO_PLAYBACK_PAUSED
   - Verify offscreen onStatusChange callback is firing

2. **Button update logic incorrect**:
   ```javascript
   // Ensure button icon is updated
   function updateButtonState(newState) {
     const pauseBtn = shadow.querySelector('#pause-btn');
     if (newState === 'paused') {
       pauseBtn.textContent = '▶';
       pauseBtn.setAttribute('aria-label', 'Play');
     } else {
       pauseBtn.textContent = '⏸';
       pauseBtn.setAttribute('aria-label', 'Pause');
     }
   }
   ```

3. **Stale shadow reference**:
   - If control panel is recreated, shadow reference is stale
   - Always query fresh: `document.querySelector('.elevenlabs-tts-controls-host')`

### Issue 5: Control Panel Obstructs Content

**Symptoms**:
- Control panel covers important page text or buttons
- Users can't interact with page content behind panel

**Diagnosis**:

```javascript
// Check control panel position
const host = document.querySelector('.elevenlabs-tts-controls-host');
const rect = host.getBoundingClientRect();
console.log('Control panel position:', {
  top: rect.top,
  left: rect.left,
  bottom: rect.bottom,
  right: rect.right
});

// Check page elements at same position
const elementsAtPosition = document.elementsFromPoint(rect.left, rect.top);
console.log('Elements behind control panel:', elementsAtPosition);
```

**Solutions**:

1. **Adjust positioning**:
   - Change bottom/right margins in CSS
   - Test on problematic pages (e.g., sites with chat widgets)

2. **Make draggable** (out of scope for MVP):
   - Future enhancement: drag control panel to preferred location
   - Store position in chrome.storage.local

3. **Page-specific adjustments**:
   - Detect problematic page layouts
   - Adjust position based on page structure (e.g., detect footer height)

### Issue 6: Multiple Control Panels Appear

**Symptoms**:
- More than one control panel visible on page
- Overlapping control panels

**Diagnosis**:

```javascript
// Count control panel host elements
const hosts = document.querySelectorAll('.elevenlabs-tts-controls-host');
console.log('Number of control panels:', hosts.length);
```

**Solutions**:

1. **Remove old panel before creating new**:
   ```javascript
   function showControlPanel() {
     // Clean up any existing panel first
     const existingPanel = document.querySelector('.elevenlabs-tts-controls-host');
     if (existingPanel) {
       existingPanel.remove();
       console.log('Removed old control panel');
     }

     // Create new panel
     const container = document.createElement('div');
     // ...
   }
   ```

2. **Multiple AUDIO_PLAYBACK_STARTED messages**:
   - Check background service worker isn't sending duplicate messages
   - Debounce control panel creation (store timestamp of last creation)

### Issue 7: Memory Leaks

**Symptoms**:
- Browser becomes slow after multiple audio sessions
- Extension memory usage grows over time

**Diagnosis**:

```javascript
// Monitor memory usage
// Chrome DevTools → Memory → Take heap snapshot
// Look for detached DOM nodes related to control panel

// Check for orphaned event listeners
// Before removing control panel:
console.log('Event listeners before removal:', getEventListeners(pauseBtn));
```

**Solutions**:

1. **Remove event listeners before DOM removal**:
   ```javascript
   function hideControlPanel() {
     const host = document.querySelector('.elevenlabs-tts-controls-host');
     if (!host) return;

     // Event listeners inside closed shadow DOM are auto-cleaned
     // But verify with heap snapshot if needed

     host.remove();
   }
   ```

2. **Clear shadow DOM references**:
   ```javascript
   // Don't store shadow root in global scope
   // Bad:
   window.controlPanelShadow = shadow;

   // Good:
   // Shadow root is local to showControlPanel() function
   ```

3. **Monitor heap snapshots**:
   - Take snapshot before audio starts
   - Take snapshot after audio stops and controls removed
   - Compare snapshots for detached nodes

---

## Performance Testing

### Measuring Control Panel Latency

**Test Control Panel Appearance Time**:

```javascript
// Add timing logs
function handleAudioPlaybackStarted(message) {
  const startTime = performance.now();

  showControlPanel();

  const endTime = performance.now();
  console.log('⏱️ Control panel appeared in:', endTime - startTime, 'ms');
  // Target: < 50ms (subjectively instant)
}
```

**Test Button Click Responsiveness**:

```javascript
function handlePauseClick() {
  const clickTime = performance.now();

  // ... send message to background ...

  chrome.runtime.sendMessage({...}).then(() => {
    const responseTime = performance.now();
    console.log('⏱️ Pause command processed in:', responseTime - clickTime, 'ms');
    // Target: < 100ms (feels responsive)
  });
}
```

### Profiling with Chrome DevTools

1. Open **Performance** tab in DevTools
2. Click **Record** button
3. Trigger TTS audio playback
4. Click pause button, then play button
5. Stop recording
6. Analyze flame chart for bottlenecks:
   - Look for long tasks (>50ms)
   - Check Shadow DOM creation time
   - Verify no forced reflows/repaints

---

## End-to-End Testing Workflow

### Complete Feature Test

**Setup**:
1. Open Chrome with extension installed
2. Open DevTools (Content script console, Background console)
3. Navigate to test page (e.g., Wikipedia article)

**Test Flow**:

```
Step 1: Trigger TTS
  - Select text on page
  - Right-click → Context menu → "Read Aloud"
  - Verify: Background console shows TEXT_CAPTURED
  - Verify: Background console shows TTS_REQUEST
  - Verify: Background console shows PLAY_AUDIO

Step 2: Control Panel Appears
  - Verify: Control panel appears bottom-right
  - Verify: Audio starts playing
  - Verify: Control panel shows pause (⏸) and stop (⏹) buttons
  - Timing: Panel appears within 500ms

Step 3: Pause Audio
  - Click pause button
  - Verify: Audio stops immediately
  - Verify: Button changes to play icon (▶)
  - Verify: Content console shows CONTROL_PAUSE_CLICKED
  - Verify: Background console shows PAUSE_AUDIO → offscreen
  - Verify: Background console shows AUDIO_PLAYBACK_PAUSED → content

Step 4: Resume Audio
  - Click play button
  - Verify: Audio resumes from paused position
  - Verify: Button changes to pause icon (⏸)
  - Verify: Content console shows CONTROL_RESUME_CLICKED
  - Verify: Background console shows RESUME_AUDIO → offscreen
  - Verify: Background console shows AUDIO_PLAYBACK_RESUMED → content

Step 5: Stop Audio
  - Click stop button
  - Verify: Audio stops
  - Verify: Control panel disappears
  - Verify: Content console shows CONTROL_STOP_CLICKED
  - Verify: Background console shows STOP_AUDIO → offscreen
  - Verify: Background console shows AUDIO_PLAYBACK_STOPPED → content

Step 6: Cleanup
  - Verify: No orphaned DOM elements (inspect Elements tab)
  - Verify: No console errors
  - Verify: Extension icon shows normal state
```

---

## References

- **Data Model**: `/specs/004-audio-playback-controls/data-model.md`
- **Message Contracts**: `/specs/004-audio-playback-controls/contracts/messages.md`
- **Research Document**: `/specs/004-audio-playback-controls/research.md`
- **Feature Spec**: `/specs/004-audio-playback-controls/spec.md`

- **Chrome Extension Docs**:
  - Runtime Messaging: https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
  - Content Scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
  - Debugging: https://developer.chrome.com/docs/extensions/mv3/tut_debugging/

- **Shadow DOM**:
  - MDN: https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM
  - Closed vs Open: https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/mode

---

**Document Status**: Phase 1 Complete - Quickstart guide ready for developer onboarding.

## Next Steps

1. Review this quickstart guide before implementation
2. Set up debugging environment (DevTools for all contexts)
3. Start with P1 stories (pause/resume) following test checklist
4. Verify each test passes before moving to next priority
5. Use common issues section when blocked
