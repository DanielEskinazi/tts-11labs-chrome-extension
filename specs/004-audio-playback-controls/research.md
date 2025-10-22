# Research: Audio Playback Controls Technical Decisions

**Feature Branch**: `004-audio-playback-controls`
**Date**: 2025-10-19
**Status**: Complete

## Overview

This document captures technical research and decisions for implementing a floating audio playback control panel in the Chrome extension. Research focused on Shadow DOM patterns, state synchronization, positioning strategies, and integration with existing toast notification and audio playback systems.

---

## 1. Shadow DOM Control Panel Patterns

### Decision

Use **closed Shadow DOM** with inline styles and event delegation for the control panel, following the exact pattern established by the existing toast notification system.

### Rationale

1. **CSS Isolation**: Shadow DOM provides complete style encapsulation, preventing page CSS from affecting controls and vice versa. This is critical since the extension runs on arbitrary websites with unpredictable styling.

2. **Existing Pattern Proven**: The toast notification system (content.js lines 135-198) already successfully uses closed Shadow DOM with inline styles. This approach:
   - Passes CSP (Content Security Policy) compliance
   - Works across all tested websites
   - Provides complete isolation without external stylesheet dependencies
   - Has no FOUC (Flash of Unstyled Content) issues

3. **Closed Mode Security**: Using `{ mode: 'closed' }` prevents page JavaScript from accessing or manipulating the Shadow DOM, enhancing security against malicious page scripts.

4. **Event Handling**: Shadow DOM events can be handled by attaching listeners to elements within the shadow root. The toast pattern demonstrates this works well (lines 202-217).

5. **Accessibility**: Shadow DOM supports ARIA attributes and semantic HTML, allowing proper accessibility implementation.

### Implementation Pattern

```javascript
// Create host element
const container = document.createElement('div');
container.className = 'elevenlabs-tts-controls-host';

// Attach closed shadow root
const shadow = container.attachShadow({ mode: 'closed' });

// Inject styles and content
shadow.innerHTML = `
  <style>
    /* Inline styles here - fully isolated */
    .control-panel {
      position: fixed;
      /* ... styles ... */
    }
  </style>
  <div class="control-panel" role="region" aria-label="Audio playback controls">
    <button id="pause-btn" aria-label="Pause">⏸</button>
    <button id="stop-btn" aria-label="Stop">⏹</button>
  </div>
`;

// Attach event listeners to shadow elements
const pauseBtn = shadow.querySelector('#pause-btn');
pauseBtn.addEventListener('click', handlePauseClick);

// Append to page
document.body.appendChild(container);
```

### Alternatives Considered

**Alternative 1: Open Shadow DOM**
- **Rejected**: Open mode allows page JavaScript to access shadow root via `element.shadowRoot`, creating potential security vulnerabilities and unintended interactions.

**Alternative 2: Regular DOM with prefixed class names**
- **Rejected**: No style isolation. Page CSS could interfere with controls, and control CSS could affect page. High risk of conflicts across diverse websites.

**Alternative 3: iframe for isolation**
- **Rejected**: Overkill for a simple control panel. iframes add complexity (separate document context, messaging overhead, positioning challenges). Shadow DOM provides sufficient isolation with simpler implementation.

**Alternative 4: External stylesheet injection**
- **Rejected**: Requires manifest changes and CSP handling. Inline styles (current toast pattern) are simpler, equally performant, and self-contained.

---

## 2. Playback State Synchronization

### Decision

Implement **unidirectional message flow** with state confirmation messages from offscreen document to content script. Content script maintains optimistic UI state with server-side (offscreen) confirmation pattern.

### Rationale

1. **Single Source of Truth**: The AudioPlayer in offscreen.js is the authoritative source for playback state (status: 'playing', 'paused', 'idle'). Content script reflects this state but doesn't own it.

2. **Existing Message Infrastructure**: The extension already has a robust message passing system:
   - Content → Background → Offscreen for commands (PAUSE_AUDIO, RESUME_AUDIO, STOP_AUDIO)
   - Background → Content for notifications (SHOW_TOAST, AUTOPLAY_BLOCKED)
   - All messages include timestamp validation (lines 28-32 in content.js)

3. **Race Condition Handling**: Optimistic UI updates (immediate button state change) + confirmation messages prevents UI lag while handling race conditions:
   - User clicks pause → UI immediately shows play button
   - Offscreen confirms pause → UI stays in play button state
   - If pause fails → Offscreen sends error → UI reverts to pause button

4. **Async Response Pattern**: Existing message handlers return promises and use `return true` for async responses (background.js lines 114-147), providing a proven pattern for state synchronization.

5. **Status Change Callbacks**: AudioPlayer has `onStatusChange` callback (audio.js line 48) that can notify when state changes, enabling reactive updates to content script.

### Implementation Pattern

**State Synchronization Flow**:

```
User clicks pause button in content script
  ↓
Content script: Optimistically update UI (pause → play button)
  ↓
Content script → Background: CONTROL_PAUSE_CLICKED message
  ↓
Background → Offscreen: PAUSE_AUDIO message
  ↓
Offscreen: audioPlayer.pause() executes
  ↓
Offscreen: onStatusChange('paused') callback fires
  ↓
Offscreen → Background: AUDIO_STATE_CHANGED message { status: 'paused' }
  ↓
Background → Content: AUDIO_PLAYBACK_PAUSED message
  ↓
Content script: Confirm UI state (already showing play button)
```

**Error Handling**:
```
If audioPlayer.pause() fails:
  Offscreen → Background: Error response
  Background → Content: AUDIO_PLAYBACK_ERROR message
  Content script: Revert UI to previous state (play → pause button)
  Show error toast
```

**Rapid Click Protection**:
```javascript
// Content script debouncing
let isControlActionPending = false;

async function handlePauseClick() {
  if (isControlActionPending) {
    console.log('Control action already pending, ignoring click');
    return;
  }

  isControlActionPending = true;
  updateButtonState('paused'); // Optimistic update

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CONTROL_PAUSE_CLICKED',
      payload: {},
      timestamp: Date.now()
    });

    if (!response.success) {
      // Revert on error
      updateButtonState('playing');
    }
  } catch (error) {
    updateButtonState('playing');
  } finally {
    isControlActionPending = false;
  }
}
```

### Alternatives Considered

**Alternative 1: Polling for state**
- **Rejected**: Inefficient and introduces lag. Would require periodic GET_AUDIO_STATE messages (offscreen.js line 52), consuming resources unnecessarily. Message-driven approach is more responsive.

**Alternative 2: Content script maintains state independently**
- **Rejected**: Creates dual source of truth. State can drift if offscreen playback fails or changes outside content script control. Single source of truth (offscreen) is more reliable.

**Alternative 3: Bidirectional binding / reactive state**
- **Rejected**: Chrome extension message passing doesn't support true bidirectional binding. Would require custom implementation with significant complexity for minimal benefit.

**Alternative 4: Synchronous message passing**
- **Rejected**: Chrome extension messages are inherently async. Attempting synchronous communication would block and degrade UX.

---

## 3. Control Panel Positioning

### Decision

Use **fixed positioning** anchored to bottom-right corner with viewport-relative coordinates and high z-index. Include responsive breakpoints for mobile viewports.

### Rationale

1. **Fixed Positioning Advantages**:
   - Remains visible during page scrolling (critical for long articles)
   - Viewport-relative positioning avoids conflicts with page layout
   - Consistent position across different page structures
   - Matches user expectations for media controls (similar to video players)

2. **Bottom-Right Corner Choice**:
   - Least likely to obstruct reading content (most content flows top-left to bottom-left)
   - Common location for floating controls (chat widgets, accessibility tools)
   - Accessible to right-handed mouse users (majority)
   - Compatible with browser UI (doesn't conflict with browser controls)

3. **High Z-Index Strategy**:
   - Toast notifications use `z-index: 2147483647` (max safe integer, toast.css line 13)
   - Control panel should use same z-index to ensure visibility
   - Tested pattern: works across complex page layouts (modals, sticky headers)

4. **Responsive Considerations**:
   - Mobile viewports: Reduce padding, potentially center at bottom for thumb access
   - Desktop: Right corner with adequate margin from edges
   - Breakpoint at 768px (standard mobile/tablet boundary)

5. **Animation Entry**:
   - Reuse toast slideIn animation for consistency (toast.css lines 44-52)
   - Slide from right for desktop, fade-in for mobile to avoid horizontal scroll

### Implementation Pattern

```css
/* Control panel positioning */
.control-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647; /* Max z-index, same as toast */

  /* Layout */
  display: flex;
  gap: 12px;
  padding: 12px 16px;

  /* Visual styling */
  background: rgba(0, 0, 0, 0.85); /* Semi-transparent dark */
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2),
              0 0 0 1px rgba(255, 255, 255, 0.1); /* Subtle border */

  /* Animation */
  animation: slideInFromRight 0.3s ease-out;
}

/* Slide in from right (desktop) */
@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Mobile responsive positioning */
@media (max-width: 768px) {
  .control-panel {
    /* Center at bottom for thumb access */
    right: auto;
    left: 50%;
    transform: translateX(-50%);
    bottom: 16px;

    /* Adjust sizing */
    padding: 10px 14px;
    gap: 10px;

    /* Different animation for mobile */
    animation: fadeIn 0.3s ease-out;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Button styling for accessibility */
.control-panel button {
  width: 44px;  /* Minimum touch target size */
  height: 44px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 20px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.control-panel button:hover {
  background: rgba(255, 255, 255, 0.25);
}

.control-panel button:active {
  transform: scale(0.95);
}

.control-panel button:focus {
  outline: 2px solid white;
  outline-offset: 2px;
}
```

### Alternatives Considered

**Alternative 1: Absolute positioning relative to page content**
- **Rejected**: Requires finding suitable anchor element on page. Different page layouts would need different strategies. Fixed positioning is more reliable.

**Alternative 2: Sticky positioning at top of viewport**
- **Rejected**: Top area often contains navigation, headers, banners. Higher risk of obstruction. Bottom is less contested.

**Alternative 3: Bottom-center positioning**
- **Rejected for desktop**: Interferes with reading flow for centered content. Better for mobile only (implemented in responsive breakpoint).

**Alternative 4: Draggable/repositionable controls**
- **Rejected**: Out of scope (spec line 166) and adds significant complexity. Fixed position is sufficient for MVP.

**Alternative 5: Lower z-index to avoid always-on-top**
- **Rejected**: Controls must be accessible when needed. If hidden behind page content, defeats purpose. High z-index is required.

---

## 4. Existing Toast Notification Patterns

### Decision

**Reuse toast notification patterns** for Shadow DOM structure, CSS isolation, lifecycle management, and animation. Adapt styling for control panel aesthetic (dark theme for controls vs. colored status for toasts).

### Rationale

1. **Proven Implementation**: Toast notifications successfully handle:
   - Shadow DOM creation and attachment (content.js lines 135-141)
   - CSP-compliant inline styles (lines 159-194)
   - XSS prevention via HTML escaping (lines 156, 244-250)
   - Auto-removal lifecycle (lines 226-229)
   - Accessibility with ARIA attributes (line 195)

2. **Consistent User Experience**: Reusing similar visual language (border-radius, shadows, animations) creates cohesive extension UX. Users recognize controls as part of the same system.

3. **Code Efficiency**: Leveraging existing patterns reduces implementation time and testing surface. Same CSS properties, same DOM manipulation approach.

4. **Animation Consistency**: Toast uses slideIn from right (toast.css lines 44-52), same animation for control panel maintains visual consistency.

5. **Error Handling Patterns**: Toast includes defensive checks:
   - Document body availability (content.js lines 122-131)
   - Shadow DOM creation errors (lines 231-241)
   - Message validation (lines 116-119)
   These patterns should be replicated for controls.

### Reusable Patterns

**Pattern 1: Shadow DOM Lifecycle**
```javascript
// From toast implementation (content.js lines 135-221)
function showControlPanel() {
  // Check document.body availability
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => showControlPanel());
      return;
    }
    return;
  }

  try {
    // Create host
    const container = document.createElement('div');
    container.className = 'elevenlabs-tts-controls-host';

    // Attach shadow
    const shadow = container.attachShadow({ mode: 'closed' });

    // Inject styles and content
    shadow.innerHTML = `<style>/* ... */</style><div>/* ... */</div>`;

    // Append to page
    document.body.appendChild(container);

    // Store reference for later removal
    return container;

  } catch (error) {
    console.error('Error showing control panel:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
  }
}
```

**Pattern 2: Safe HTML Injection**
```javascript
// From toast (content.js lines 156, 244-250)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text; // textContent handles UTF-8 and special chars
  return div.innerHTML;
}

// Use when injecting dynamic content
shadow.innerHTML = `<div>${escapedContent}</div>`;
```

**Pattern 3: Auto-removal with Cleanup**
```javascript
// From toast (lines 226-229), adapted for controls
function hideControlPanel(container) {
  if (container && container.parentNode) {
    container.remove();
    console.log('Control panel removed');
  }
}

// Call when audio stops
setTimeout(() => hideControlPanel(controlPanelRef), 2000); // Fade delay
```

**Pattern 4: Message Validation**
```javascript
// From content.js lines 28-32, 116-119
function validateMessage(message) {
  if (!message || !message.type || !message.timestamp) {
    console.warn('Invalid message structure:', message);
    return false;
  }
  return true;
}

// Use in message listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!validateMessage(message)) {
    sendResponse({ success: false, error: 'Invalid message' });
    return false;
  }
  // ... handle message
});
```

### Styling Adaptations

**Toast Styling** (for reference):
- Background: Status-based colors (#10b981 green, #f59e0b yellow, #ef4444 red)
- Position: Top-right, temporary display
- Typography: system-ui, 14px, 500 weight
- Animation: Slide in from right, auto-remove after 3s

**Control Panel Styling** (adaptations):
- Background: Dark semi-transparent (rgba(0,0,0,0.85)) for media controls aesthetic
- Position: Bottom-right, persistent while audio active
- Typography: Same system-ui font for consistency
- Animation: Same slide-in, manual removal on stop/audio end
- Additional: Button hover states, focus indicators for interactivity

```css
/* Control panel - adapted from toast pattern */
.control-panel {
  /* Positioning (adapted) */
  position: fixed;
  bottom: 20px;
  right: 20px;

  /* Same elevation */
  z-index: 2147483647;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* Different background for controls */
  background: rgba(0, 0, 0, 0.85); /* Dark instead of status color */

  /* Same border radius, spacing */
  border-radius: 8px;
  padding: 12px 16px; /* Slightly adjusted for buttons */

  /* Same typography */
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Same animation */
  animation: slideIn 0.3s ease-out;
}

/* Reuse exact animation from toast.css */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

### Alternatives Considered

**Alternative 1: Create entirely new control panel system**
- **Rejected**: Reinventing the wheel. Toast pattern already solves Shadow DOM, CSP, positioning, and animation. Reuse maximizes efficiency.

**Alternative 2: Use same colored backgrounds as toasts**
- **Rejected**: Status colors (green/yellow/red) don't convey playback controls well. Dark background is media player convention and more appropriate.

**Alternative 3: Different animation style (fade, scale)**
- **Rejected**: Slide-in animation establishes visual language for extension elements. Consistency aids user recognition.

**Alternative 4: Persistent control panel (never auto-remove)**
- **Rejected**: Clutters page unnecessarily when audio not active. Auto-removal (like toasts) keeps interface clean.

---

## 5. AudioPlayer Integration Points

### Decision

Leverage existing **AudioPlayer methods** (pause, resume, stop) and **onStatusChange callback** for state synchronization. Extend background.js message routing to forward control commands to offscreen document without modifying AudioPlayer class.

### Rationale

1. **AudioPlayer API Completeness**: The AudioPlayer class (src/api/audio.js) already implements all required methods:
   - `pause()` (line 148): Pauses playback, updates status to 'paused'
   - `resume()` (line 164): Resumes from paused position, updates status to 'playing'
   - `stop()` (line 186): Stops playback, resets position, updates status to 'idle'
   - `getState()` (line 33): Returns current status, position, duration

2. **Status Change Hook**: `onStatusChange` callback (line 46) provides reactive notification when playback state changes. This enables:
   - Automatic UI updates when state changes
   - Notification to background script when offscreen playback state updates
   - Foundation for state synchronization pattern

3. **Existing Message Handlers**: Background.js already routes control messages to offscreen:
   - PAUSE_AUDIO (lines 118-127)
   - RESUME_AUDIO (lines 128-137)
   - STOP_AUDIO (lines 138-147)
   - Pattern: Forward message to offscreen, return response to content script

4. **Offscreen Message Handlers**: Offscreen.js implements handlers for all control messages:
   - PAUSE_AUDIO → handlePauseAudio() (lines 36-39, 175-183)
   - RESUME_AUDIO → handleResumeAudio() (lines 41-45, 188-200)
   - STOP_AUDIO → handleStopAudio() (lines 47-50, 205-213)
   - GET_AUDIO_STATE → getAudioState() (lines 52-55, 218-229)

5. **Audio Lifecycle Events**: AudioPlayer includes completion and error callbacks:
   - `onPlaybackEnd` (line 24): Fires when audio ends naturally (line 100-106)
   - `onPlaybackError` (line 25): Fires on audio errors (lines 84-98)
   - These are already wired to notify background script (offscreen.js lines 99-130)

### Integration Architecture

**Message Flow for Control Commands**:

```
Content Script                Background Script              Offscreen Document
     |                              |                              |
     | CONTROL_PAUSE_CLICKED        |                              |
     |----------------------------->|                              |
     |                              | PAUSE_AUDIO                  |
     |                              |----------------------------->|
     |                              |                              | audioPlayer.pause()
     |                              |                              | onStatusChange('paused')
     |                              | { success: true }            |
     |                              |<-----------------------------|
     | { success: true }            |                              |
     |<-----------------------------|                              |
     |                              |                              |
     | (Optional) AUDIO_PLAYBACK_PAUSED confirmation              |
     |<-----------------------------|<-----------------------------|
```

**Status Synchronization Flow**:

```javascript
// offscreen.js - Wire up status change callback
audioPlayer.onStatusChange = (newStatus) => {
  console.log('Audio status changed to:', newStatus);

  // Notify background script of state change
  chrome.runtime.sendMessage({
    type: 'AUDIO_STATE_CHANGED',
    payload: {
      status: newStatus,
      position: audioPlayer.currentPosition,
      duration: audioPlayer.duration
    },
    timestamp: Date.now()
  }).catch(err => console.error('Failed to notify background:', err));
};
```

```javascript
// background.js - Add handler for AUDIO_STATE_CHANGED
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing handlers ...

  if (message.type === 'AUDIO_STATE_CHANGED') {
    const { status, position, duration } = message.payload;

    // Forward state change to active content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: status === 'playing' ? 'AUDIO_PLAYBACK_RESUMED' :
                status === 'paused' ? 'AUDIO_PLAYBACK_PAUSED' :
                'AUDIO_PLAYBACK_STOPPED',
          payload: { position, duration },
          timestamp: Date.now()
        });
      }
    });

    sendResponse({ success: true });
  }
});
```

### Required Extensions

**New Message Handlers in background.js**:

1. **CONTROL_PAUSE_CLICKED**: Route to PAUSE_AUDIO (reuse existing handler)
2. **CONTROL_RESUME_CLICKED**: Route to RESUME_AUDIO (reuse existing handler)
3. **CONTROL_STOP_CLICKED**: Route to STOP_AUDIO + send AUDIO_PLAYBACK_STOPPED to content
4. **AUDIO_STATE_CHANGED**: Receive from offscreen, broadcast to content script

**New Message Handlers in content.js**:

1. **AUDIO_PLAYBACK_STARTED**: Show control panel
2. **AUDIO_PLAYBACK_PAUSED**: Update button to play icon
3. **AUDIO_PLAYBACK_RESUMED**: Update button to pause icon
4. **AUDIO_PLAYBACK_STOPPED**: Hide control panel

**Trigger for AUDIO_PLAYBACK_STARTED**:

Currently, background.js starts audio after TTS request succeeds (lines 299-310). Add notification to content script:

```javascript
// background.js - After successful play
const playResult = await chrome.runtime.sendMessage({
  type: 'PLAY_AUDIO',
  payload: {},
  timestamp: Date.now()
});

if (playResult.success) {
  console.log('Automatic playback started in offscreen document');

  // NEW: Notify content script to show controls
  chrome.tabs.sendMessage(tabId, {
    type: 'AUDIO_PLAYBACK_STARTED',
    payload: {
      duration: loadResult.payload.duration
    },
    timestamp: Date.now()
  });
}
```

### Alternatives Considered

**Alternative 1: Modify AudioPlayer class to broadcast state changes**
- **Rejected**: AudioPlayer is in offscreen document, can't directly message content script. Would require offscreen → background → content routing anyway. Keeping AudioPlayer focused on audio logic (not messaging) maintains separation of concerns.

**Alternative 2: Content script polls for audio state**
- **Rejected**: Inefficient. Requires periodic GET_AUDIO_STATE messages. Event-driven approach (status change callbacks) is more performant and responsive.

**Alternative 3: Duplicate audio control logic in background script**
- **Rejected**: AudioPlayer in offscreen document is the single source of truth. Duplicating logic creates maintenance burden and potential state drift.

**Alternative 4: Content script directly controls offscreen document**
- **Rejected**: Chrome extension architecture doesn't allow direct content-to-offscreen messaging. Must route through background service worker (current pattern).

**Alternative 5: WebSocket or custom channel for real-time state**
- **Rejected**: Overkill for single-tab, single-audio-session use case. Chrome runtime messaging is sufficient and simpler.

---

## Implementation Checklist

Based on research findings, implementation should proceed as follows:

### Phase 1: P1 Stories (Pause/Resume)

- [ ] Create control panel Shadow DOM structure (reuse toast pattern)
- [ ] Implement pause button with click handler
- [ ] Implement play button (toggle with pause)
- [ ] Add CONTROL_PAUSE_CLICKED message handler in content.js
- [ ] Add CONTROL_RESUME_CLICKED message handler in content.js
- [ ] Route control messages through background.js to offscreen
- [ ] Wire onStatusChange in offscreen.js to notify background
- [ ] Add AUDIO_PLAYBACK_PAUSED/RESUMED handlers in content.js
- [ ] Implement button state toggle (pause ↔ play icon)
- [ ] Test rapid clicking (debouncing)
- [ ] Test pause → resume preserves position

### Phase 2: P2 Stories (Stop, Auto-show)

- [ ] Add stop button to control panel
- [ ] Add CONTROL_STOP_CLICKED message handler
- [ ] Implement auto-show on AUDIO_PLAYBACK_STARTED
- [ ] Test control panel appears when audio starts
- [ ] Test new audio replaces old control panel
- [ ] Test stop removes control panel

### Phase 3: P3 Stories (Auto-hide, Polish)

- [ ] Implement auto-hide on AUDIO_PLAYBACK_STOPPED (natural end)
- [ ] Add fade-out animation before removal
- [ ] Test control panel disappears after audio ends
- [ ] Responsive positioning (mobile breakpoint)
- [ ] Accessibility: ARIA labels, keyboard focus
- [ ] Cross-browser testing

---

## Technical Unknowns Resolved

1. **Shadow DOM approach**: Closed mode with inline styles (proven by toast pattern)
2. **State synchronization**: Unidirectional message flow with optimistic UI + confirmation
3. **Positioning strategy**: Fixed bottom-right, high z-index, responsive breakpoint at 768px
4. **Reusable patterns**: Toast lifecycle, animations, error handling all applicable
5. **AudioPlayer integration**: Use existing methods + onStatusChange callback, route through background
6. **Message contracts**: Extend existing PAUSE/RESUME/STOP handlers, add state change notifications
7. **Race conditions**: Client-side debouncing + pending flag prevents rapid click issues
8. **Cleanup**: Reuse toast auto-removal pattern, triggered on stop or audio end

---

## References

- Existing Code:
  - `/content.js`: Toast notification implementation (lines 112-242)
  - `/toast.css`: Toast styling patterns (lines 6-59)
  - `/src/api/audio.js`: AudioPlayer class API (lines 15-219)
  - `/offscreen.js`: Offscreen audio handlers (lines 23-230)
  - `/background.js`: Message routing (lines 98-166)

- Chrome Extension APIs:
  - Shadow DOM: https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM
  - Runtime Messaging: https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
  - Content Scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts

- Design Patterns:
  - Optimistic UI: https://www.apollographql.com/docs/react/performance/optimistic-ui/
  - Event-driven architecture for state sync
  - Debouncing for UI interaction throttling

---

**Research Complete**: All technical unknowns resolved. Proceed to Phase 1 (data-model.md, contracts/, quickstart.md).
