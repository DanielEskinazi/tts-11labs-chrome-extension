# Data Model: Audio Playback Controls

**Feature**: Audio Playback Controls
**Branch**: `004-audio-playback-controls`
**Date**: 2025-10-19
**Status**: Phase 1 Design

## Overview

This document defines the data models and state machines for the audio playback control panel feature. The control panel is a floating UI component that appears when audio plays and provides pause/resume/stop controls. State is synchronized between the content script (UI), background service worker (coordinator), and offscreen document (audio player).

## Architecture Context

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Content Script │◄───────►│ Background       │◄───────►│ Offscreen Doc   │
│  (UI Layer)     │ Messages│ Service Worker   │ Messages│ (Audio Layer)   │
│                 │         │ (Coordinator)    │         │                 │
│ - Control Panel │         │ - Message Router │         │ - AudioPlayer   │
│ - Button States │         │ - State Relay    │         │ - Audio State   │
└─────────────────┘         └──────────────────┘         └─────────────────┘
       ▲                                                          │
       │                                                          │
       └────────────── State Synchronization ────────────────────┘
```

**Key Principles**:
- **Single Source of Truth**: AudioPlayer in offscreen document owns playback state
- **Unidirectional Flow**: State changes flow from offscreen → background → content
- **Optimistic UI**: Content script updates UI immediately, confirmed by state messages
- **Stateless Coordination**: Background service worker routes messages, doesn't store state

---

## 1. Control Panel State Machine

The control panel UI follows a finite state machine based on audio playback status.

### States

| State | Description | Visual Representation | Lifecycle |
|-------|-------------|----------------------|-----------|
| `hidden` | No control panel visible on page | DOM element removed | Default state |
| `showing-playing` | Panel visible with pause + stop buttons | Pause button (⏸) active | Audio actively playing |
| `showing-paused` | Panel visible with play + stop buttons | Play button (▶) active | Audio paused |

### State Transitions

```
┌─────────┐
│ hidden  │ (Initial state)
└─────┬───┘
      │
      │ AUDIO_PLAYBACK_STARTED
      │ (from background)
      ▼
┌──────────────────┐
│ showing-playing  │◄─────┐
└─────┬────────────┘      │
      │                   │ AUDIO_PLAYBACK_RESUMED
      │ CONTROL_PAUSE_CLICKED  │ (confirmation)
      │ (user action)          │
      ▼                   │
┌──────────────────┐      │
│ showing-paused   │──────┘
└─────┬────────────┘
      │
      │ CONTROL_STOP_CLICKED or AUDIO_PLAYBACK_STOPPED
      │
      ▼
┌─────────┐
│ hidden  │
└─────────┘
```

### Transition Triggers

| From State | To State | Trigger | Side Effects |
|------------|----------|---------|--------------|
| `hidden` | `showing-playing` | AUDIO_PLAYBACK_STARTED message received | Create Shadow DOM, inject styles, show pause button |
| `showing-playing` | `showing-paused` | CONTROL_PAUSE_CLICKED (optimistic) OR AUDIO_PLAYBACK_PAUSED (confirmed) | Swap pause button to play button |
| `showing-paused` | `showing-playing` | CONTROL_RESUME_CLICKED (optimistic) OR AUDIO_PLAYBACK_RESUMED (confirmed) | Swap play button to pause button |
| `showing-playing` | `hidden` | CONTROL_STOP_CLICKED OR AUDIO_PLAYBACK_STOPPED (natural end) | Remove Shadow DOM from page |
| `showing-paused` | `hidden` | CONTROL_STOP_CLICKED OR AUDIO_PLAYBACK_STOPPED | Remove Shadow DOM from page |

### State Persistence

**Storage**: In-memory only (content script context)
- State is ephemeral and tied to page lifecycle
- No chrome.storage persistence needed
- State resets when page navigates or reloads
- If audio continues playing after page reload (offscreen document survives), control panel will be re-created on new page when audio starts

**Validation**:
- Only one state active at a time (mutually exclusive)
- Transitions only occur via defined triggers (no arbitrary state changes)
- Invalid transitions are logged and ignored (e.g., pause when already paused)

---

## 2. Playback State Entity

The playback state represents the current status of audio playback. This entity is owned by the AudioPlayer class in the offscreen document and mirrored in the content script for UI rendering.

### Fields

| Field | Type | Description | Valid Values | Default |
|-------|------|-------------|--------------|---------|
| `status` | `string` (enum) | Current playback status | `"idle"`, `"loading"`, `"playing"`, `"paused"`, `"error"` | `"idle"` |
| `hasActiveSession` | `boolean` | Whether an audio session exists | `true`, `false` | `false` |
| `currentPosition` | `number` | Current playback position in seconds | 0 to `duration` | `0` |
| `duration` | `number` | Total audio duration in seconds | > 0 | `0` |

### Validation Rules

```javascript
// Status must be one of the enum values
const VALID_STATUSES = ['idle', 'loading', 'playing', 'paused', 'error'];
function validateStatus(status) {
  return VALID_STATUSES.includes(status);
}

// Position must not exceed duration
function validatePosition(position, duration) {
  return position >= 0 && position <= duration;
}

// Duration must be positive when audio is loaded
function validateDuration(duration, status) {
  if (status !== 'idle' && status !== 'loading') {
    return duration > 0;
  }
  return true;
}
```

### Relationships

- **Owned by**: AudioPlayer instance (offscreen.js)
- **Observed by**: Content script (control panel UI)
- **Coordinated by**: Background service worker (message relay)

**Data Flow**:
```
AudioPlayer._updateStatus(newStatus)
  → onStatusChange callback fires
  → Offscreen sends AUDIO_STATE_CHANGED to background
  → Background sends AUDIO_PLAYBACK_[STARTED|PAUSED|RESUMED|STOPPED] to content
  → Content script updates control panel state
```

### Status Change Events

| Status | Triggers | Next Actions |
|--------|----------|--------------|
| `"idle"` | Initial state, stop() called, audio ended | Hide control panel if visible |
| `"loading"` | loadAudio() called | No UI change (audio not ready) |
| `"playing"` | play() succeeds, resume() succeeds | Show control panel with pause button |
| `"paused"` | pause() called | Update control panel to show play button |
| `"error"` | Audio loading/playback fails | Hide control panel, show error toast |

---

## 3. Control Panel UI Entity

The control panel UI is a floating Shadow DOM component that renders playback controls.

### Fields

| Field | Type | Description | Valid Values | Default |
|-------|------|-------------|--------------|---------|
| `visibility` | `boolean` | Whether panel is shown on page | `true`, `false` | `false` |
| `currentButton` | `string` (enum) | Which primary button is shown | `"pause"`, `"play"` | `"pause"` |
| `position` | `object` | CSS positioning coordinates | `{ bottom: string, right: string }` | `{ bottom: "20px", right: "20px" }` |
| `isActionPending` | `boolean` | Whether a control action is in progress | `true`, `false` | `false` |

### Lifecycle Phases

#### 1. Creation (Show)

**Trigger**: AUDIO_PLAYBACK_STARTED message received

**Steps**:
1. Check if document.body is available (wait for DOMContentLoaded if needed)
2. Create host `<div>` element: `<div class="elevenlabs-tts-controls-host"></div>`
3. Attach closed Shadow DOM: `container.attachShadow({ mode: 'closed' })`
4. Inject inline styles and HTML structure into shadow root
5. Attach event listeners to buttons (pause, stop)
6. Append container to document.body
7. Set `visibility = true`, `currentButton = "pause"`

**Error Handling**:
- If document.body is null and readyState is 'loading', defer creation
- If Shadow DOM creation fails, log error and skip control panel
- No fallback UI (graceful degradation)

#### 2. Update (Button Toggle)

**Trigger**: AUDIO_PLAYBACK_PAUSED or AUDIO_PLAYBACK_RESUMED message

**Steps**:
1. Locate button element in Shadow DOM
2. Update button icon (⏸ ↔ ▶)
3. Update ARIA label ("Pause" ↔ "Play")
4. Update `currentButton` field
5. Clear `isActionPending` flag

**Optimistic Update**:
- When user clicks pause/play, button updates immediately
- If confirmation message doesn't match optimistic state, revert button

#### 3. Destruction (Hide)

**Trigger**: AUDIO_PLAYBACK_STOPPED or CONTROL_STOP_CLICKED

**Steps**:
1. Remove container element from document.body
2. Shadow DOM and event listeners are garbage collected automatically
3. Set `visibility = false`
4. Clear any pending action flags

**Animation**:
- Optional: Add fade-out CSS animation before removal (P3 priority)
- Current: Immediate removal

### Structure Template

```javascript
// Shadow DOM structure injected during creation
const shadowHTML = `
  <style>
    .control-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647; /* Max z-index */

      display: flex;
      gap: 12px;
      padding: 12px 16px;

      background: rgba(0, 0, 0, 0.85);
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2),
                  0 0 0 1px rgba(255, 255, 255, 0.1);

      animation: slideInFromRight 0.3s ease-out;
    }

    .control-panel button {
      width: 44px;
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

    /* Mobile responsive */
    @media (max-width: 768px) {
      .control-panel {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
        bottom: 16px;
        padding: 10px 14px;
        gap: 10px;
      }
    }
  </style>
  <div class="control-panel" role="region" aria-label="Audio playback controls">
    <button id="pause-btn" aria-label="Pause">⏸</button>
    <button id="stop-btn" aria-label="Stop">⏹</button>
  </div>
`;
```

### Accessibility

| Feature | Implementation |
|---------|----------------|
| **Semantic HTML** | `<button>` elements for controls |
| **ARIA Labels** | `aria-label` on each button (Pause, Play, Stop) |
| **ARIA Roles** | `role="region"` on control panel container |
| **Keyboard Navigation** | Buttons are focusable via Tab key |
| **Focus Indicators** | Visible outline on keyboard focus |
| **Screen Reader** | Buttons announce as "Pause button", "Stop button" |

### Responsive Behavior

**Desktop (> 768px)**:
- Position: Bottom-right corner
- Margins: 20px from edges
- Animation: Slide in from right

**Mobile (≤ 768px)**:
- Position: Bottom-center (horizontally centered)
- Margins: 16px from bottom
- Animation: Fade in (no horizontal slide to avoid scroll)
- Button spacing: Reduced gap (10px vs 12px)

---

## State Synchronization Patterns

### Optimistic UI Pattern

Content script immediately updates UI when user clicks controls, then waits for confirmation.

```javascript
// User clicks pause button
async function handlePauseClick() {
  if (isActionPending) {
    return; // Prevent double-clicks
  }

  isActionPending = true;
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
    isActionPending = false;
  }
}

// Confirmation message arrives
function handleAudioPlaybackPaused(message) {
  // Confirm optimistic update was correct
  updateButtonState('paused');
  isActionPending = false;
}
```

### Race Condition Handling

**Scenario**: User clicks pause/resume rapidly before first action completes

**Solution**:
1. Set `isActionPending = true` immediately on button click
2. Ignore subsequent clicks while pending
3. Clear pending flag when confirmation arrives or error occurs
4. Timeout after 3 seconds if no confirmation (reset to previous state)

**Scenario**: Multiple audio sessions start in quick succession

**Solution**:
1. Only one control panel exists at a time
2. New AUDIO_PLAYBACK_STARTED removes old panel and creates new one
3. Control messages include timestamp to detect stale commands

---

## Error States and Recovery

### Error Scenarios

| Error | Detection | Recovery |
|-------|-----------|----------|
| **Shadow DOM creation fails** | try-catch around attachShadow() | Log error, skip control panel (graceful degradation) |
| **Pause/Resume fails** | Response success=false or Promise rejection | Revert button to previous state, show error toast |
| **Control message timeout** | No confirmation after 3 seconds | Revert button, log warning |
| **Audio stops unexpectedly** | AUDIO_PLAYBACK_STOPPED with reason="error" | Hide controls, show error toast |
| **Page navigates during playback** | Page unload event | Controls auto-removed by browser (DOM cleared) |

### State Validation

```javascript
// Validate state before transitions
function canTransitionTo(newState) {
  const validTransitions = {
    'hidden': ['showing-playing'],
    'showing-playing': ['showing-paused', 'hidden'],
    'showing-paused': ['showing-playing', 'hidden']
  };

  const currentState = getControlPanelState();
  return validTransitions[currentState]?.includes(newState) ?? false;
}

// Example usage
if (!canTransitionTo('showing-paused')) {
  console.warn('Invalid state transition attempted');
  return;
}
```

---

## Testing Checklist

### State Machine Testing

- [ ] Control panel starts in `hidden` state on page load
- [ ] Transitions to `showing-playing` when audio starts
- [ ] Pause button click transitions to `showing-paused`
- [ ] Play button click transitions back to `showing-playing`
- [ ] Stop button click transitions to `hidden`
- [ ] Audio ending naturally transitions to `hidden`
- [ ] Invalid transitions are rejected (e.g., pause when already paused)

### Playback State Testing

- [ ] Status updates correctly for all AudioPlayer state changes
- [ ] Position tracking updates during playback
- [ ] Duration is set after audio loads
- [ ] Error status triggers control panel removal

### UI Entity Testing

- [ ] Shadow DOM creates successfully
- [ ] Buttons render with correct icons
- [ ] Button states toggle correctly (pause ↔ play)
- [ ] Event listeners fire on button clicks
- [ ] Control panel removes cleanly without memory leaks
- [ ] Positioning works on desktop (bottom-right)
- [ ] Positioning works on mobile (bottom-center)
- [ ] Accessibility attributes are present

### Synchronization Testing

- [ ] Optimistic updates work without lag
- [ ] Confirmation messages sync state correctly
- [ ] Race conditions handled (rapid clicking)
- [ ] Multiple audio sessions handled (old panel replaced)
- [ ] Error messages revert optimistic updates

---

## References

- **AudioPlayer API**: `/src/api/audio.js` (lines 15-219)
- **Toast Pattern**: `/content.js` (lines 112-242)
- **Message Contracts**: `/specs/004-audio-playback-controls/contracts/messages.md`
- **Research Document**: `/specs/004-audio-playback-controls/research.md`

---

**Document Status**: Phase 1 Complete - Ready for contract definition and implementation planning.
