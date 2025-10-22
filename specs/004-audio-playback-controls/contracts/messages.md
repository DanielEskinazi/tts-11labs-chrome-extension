# Message Contracts: Audio Playback Controls

**Feature**: Audio Playback Controls
**Branch**: `004-audio-playback-controls`
**Date**: 2025-10-19
**Status**: Phase 1 Design

## Overview

This document defines the Chrome runtime message contracts for audio playback control communication. Messages flow between content script (UI), background service worker (coordinator), and offscreen document (audio player).

## Message Flow Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Content Script │         │ Background       │         │ Offscreen Doc   │
│                 │         │ Service Worker   │         │                 │
└────────┬────────┘         └────────┬─────────┘         └────────┬────────┘
         │                           │                            │
         │ CONTROL_PAUSE_CLICKED     │                            │
         │──────────────────────────>│ PAUSE_AUDIO                │
         │                           │───────────────────────────>│
         │                           │                            │ audioPlayer.pause()
         │                           │                            │ onStatusChange('paused')
         │                           │                            │
         │                           │ AUDIO_STATE_CHANGED        │
         │                           │<───────────────────────────│
         │ AUDIO_PLAYBACK_PAUSED     │                            │
         │<──────────────────────────│                            │
         │                           │                            │
```

## Message Types Summary

| Message Type | Direction | Purpose | Priority |
|--------------|-----------|---------|----------|
| `AUDIO_PLAYBACK_STARTED` | Background → Content | Notify content script audio has started | P2 |
| `AUDIO_PLAYBACK_PAUSED` | Background → Content | Confirm audio paused successfully | P1 |
| `AUDIO_PLAYBACK_RESUMED` | Background → Content | Confirm audio resumed successfully | P1 |
| `AUDIO_PLAYBACK_STOPPED` | Background → Content | Notify audio stopped (user/natural/error) | P2 |
| `CONTROL_PAUSE_CLICKED` | Content → Background | User clicked pause button | P1 |
| `CONTROL_RESUME_CLICKED` | Content → Background | User clicked play/resume button | P1 |
| `CONTROL_STOP_CLICKED` | Content → Background | User clicked stop button | P2 |
| `AUDIO_STATE_CHANGED` | Offscreen → Background | Internal: Audio state changed | P1 |

---

## 1. AUDIO_PLAYBACK_STARTED

**Direction**: Background Service Worker → Content Script

**Purpose**: Notify content script that audio playback has started and control panel should be shown.

### Trigger Condition

Sent by background service worker after:
1. TTS audio is successfully loaded into AudioPlayer (offscreen document)
2. `audioPlayer.play()` succeeds without autoplay blocking
3. Audio begins playing for the first time (not resume from pause)

**Code Location**: `background.js` (after successful PLAY_AUDIO response)

### Payload Schema

```typescript
{
  type: "AUDIO_PLAYBACK_STARTED",
  payload: {
    duration: number,        // Total audio duration in seconds (optional)
    sessionId?: string      // Optional session identifier for tracking
  },
  timestamp: number         // Unix timestamp in milliseconds
}
```

**Payload Validation**:
```javascript
function validateAudioPlaybackStarted(payload) {
  if (payload.duration !== undefined && typeof payload.duration !== 'number') {
    throw new Error('duration must be a number');
  }
  if (payload.duration !== undefined && payload.duration <= 0) {
    throw new Error('duration must be positive');
  }
  return true;
}
```

### Response Schema

```typescript
{
  success: boolean,
  error?: string          // Only present if success is false
}
```

Content script acknowledges receipt but doesn't return meaningful data.

### Handler Actions (Content Script)

1. **Validate message structure** (type, timestamp, payload)
2. **Check if control panel already exists**:
   - If exists: Remove old panel first (new audio session)
   - If not: Proceed to creation
3. **Create control panel Shadow DOM**:
   - Create host element
   - Attach closed shadow root
   - Inject styles and HTML
   - Attach event listeners to buttons
4. **Append control panel to document.body**
5. **Set initial state**: `showing-playing` with pause button active
6. **Log**: "Control panel shown for new audio playback"

**Error Handling**:
- If document.body is null: Wait for DOMContentLoaded, retry once
- If Shadow DOM creation fails: Log error, send response with success=false
- If panel already exists: Clean up old panel first (no error)

### Example Messages

```javascript
// Example 1: Basic audio started notification
{
  type: "AUDIO_PLAYBACK_STARTED",
  payload: {
    duration: 45.3
  },
  timestamp: 1729182000000
}

// Example 2: With optional session ID
{
  type: "AUDIO_PLAYBACK_STARTED",
  payload: {
    duration: 120.5,
    sessionId: "session-abc123"
  },
  timestamp: 1729182050000
}
```

---

## 2. AUDIO_PLAYBACK_PAUSED

**Direction**: Background Service Worker → Content Script

**Purpose**: Confirm that audio has been paused successfully and control panel should show play button.

### Trigger Condition

Sent by background service worker after:
1. Receiving AUDIO_STATE_CHANGED message from offscreen document with status='paused'
2. AudioPlayer.onStatusChange callback fires with 'paused' status
3. This is a **confirmation message** after CONTROL_PAUSE_CLICKED

**Code Location**: `background.js` (in AUDIO_STATE_CHANGED handler)

### Payload Schema

```typescript
{
  type: "AUDIO_PLAYBACK_PAUSED",
  payload: {
    currentPosition: number  // Current playback position in seconds
  },
  timestamp: number
}
```

**Payload Validation**:
```javascript
function validateAudioPlaybackPaused(payload) {
  if (typeof payload.currentPosition !== 'number') {
    throw new Error('currentPosition must be a number');
  }
  if (payload.currentPosition < 0) {
    throw new Error('currentPosition must be non-negative');
  }
  return true;
}
```

### Response Schema

```typescript
{
  success: boolean
}
```

### Handler Actions (Content Script)

1. **Validate message structure**
2. **Check if control panel exists**:
   - If not: Log warning, ignore message (stale or out-of-sync)
   - If yes: Proceed
3. **Update button state**:
   - Change pause button (⏸) to play button (▶)
   - Update ARIA label from "Pause" to "Play"
4. **Clear `isActionPending` flag** (if optimistic update was applied)
5. **Log**: "Audio paused at {currentPosition}s"

**Optimistic UI Confirmation**:
- If user already clicked pause and button shows play icon (optimistic update), this message confirms the state is correct
- If button state doesn't match (e.g., still shows pause), force update to play button

### Example Message

```javascript
{
  type: "AUDIO_PLAYBACK_PAUSED",
  payload: {
    currentPosition: 12.5
  },
  timestamp: 1729182005000
}
```

---

## 3. AUDIO_PLAYBACK_RESUMED

**Direction**: Background Service Worker → Content Script

**Purpose**: Confirm that audio has resumed playing and control panel should show pause button.

### Trigger Condition

Sent by background service worker after:
1. Receiving AUDIO_STATE_CHANGED message from offscreen document with status='playing'
2. AudioPlayer.onStatusChange callback fires with 'playing' status after resume
3. This is a **confirmation message** after CONTROL_RESUME_CLICKED

**Code Location**: `background.js` (in AUDIO_STATE_CHANGED handler)

### Payload Schema

```typescript
{
  type: "AUDIO_PLAYBACK_RESUMED",
  payload: {
    currentPosition: number  // Position where playback resumed
  },
  timestamp: number
}
```

**Payload Validation**:
```javascript
function validateAudioPlaybackResumed(payload) {
  if (typeof payload.currentPosition !== 'number') {
    throw new Error('currentPosition must be a number');
  }
  if (payload.currentPosition < 0) {
    throw new Error('currentPosition must be non-negative');
  }
  return true;
}
```

### Response Schema

```typescript
{
  success: boolean
}
```

### Handler Actions (Content Script)

1. **Validate message structure**
2. **Check if control panel exists**:
   - If not: Log warning, ignore message
   - If yes: Proceed
3. **Update button state**:
   - Change play button (▶) to pause button (⏸)
   - Update ARIA label from "Play" to "Pause"
4. **Clear `isActionPending` flag**
5. **Log**: "Audio resumed from {currentPosition}s"

**Optimistic UI Confirmation**:
- Confirms optimistic update when user clicked play button
- If button state doesn't match, force update to pause button

### Example Message

```javascript
{
  type: "AUDIO_PLAYBACK_RESUMED",
  payload: {
    currentPosition: 12.5
  },
  timestamp: 1729182010000
}
```

---

## 4. AUDIO_PLAYBACK_STOPPED

**Direction**: Background Service Worker → Content Script

**Purpose**: Notify content script that audio has stopped and control panel should be removed.

### Trigger Condition

Sent by background service worker when:
1. User clicks stop button (CONTROL_STOP_CLICKED succeeded)
2. Audio playback ends naturally (AudioPlayer.onPlaybackEnd callback)
3. Audio playback errors (AudioPlayer.onPlaybackError callback)
4. New audio session starts (previous session stops)

**Code Location**:
- `background.js` (after STOP_AUDIO succeeds)
- `offscreen.js` (in onPlaybackEnd/onPlaybackError callbacks)

### Payload Schema

```typescript
{
  type: "AUDIO_PLAYBACK_STOPPED",
  payload: {
    reason: "user" | "ended" | "error" | "replaced"
  },
  timestamp: number
}
```

**Payload Validation**:
```javascript
const VALID_STOP_REASONS = ['user', 'ended', 'error', 'replaced'];

function validateAudioPlaybackStopped(payload) {
  if (!VALID_STOP_REASONS.includes(payload.reason)) {
    throw new Error('reason must be one of: user, ended, error, replaced');
  }
  return true;
}
```

### Response Schema

```typescript
{
  success: boolean
}
```

### Handler Actions (Content Script)

1. **Validate message structure**
2. **Check if control panel exists**:
   - If not: No action needed (already removed or never shown)
   - If yes: Proceed to removal
3. **Remove control panel**:
   - Find host element by class name
   - Call `element.remove()` to detach from DOM
   - Shadow DOM and event listeners are garbage collected
4. **Reset internal state**:
   - Set `visibility = false`
   - Clear `isActionPending` flag
5. **Optional**: Show toast notification if reason is 'error'
6. **Log**: "Control panel removed (reason: {reason})"

**Stop Reasons**:
- `"user"`: User clicked stop button - clean removal, no notification
- `"ended"`: Audio played to end naturally - clean removal, no notification
- `"error"`: Playback error occurred - show error toast after removal
- `"replaced"`: New audio session starting - silent removal (new panel will appear)

### Example Messages

```javascript
// Example 1: User clicked stop
{
  type: "AUDIO_PLAYBACK_STOPPED",
  payload: {
    reason: "user"
  },
  timestamp: 1729182015000
}

// Example 2: Audio ended naturally
{
  type: "AUDIO_PLAYBACK_STOPPED",
  payload: {
    reason: "ended"
  },
  timestamp: 1729182045000
}

// Example 3: Playback error
{
  type: "AUDIO_PLAYBACK_STOPPED",
  payload: {
    reason: "error"
  },
  timestamp: 1729182020000
}
```

---

## 5. CONTROL_PAUSE_CLICKED

**Direction**: Content Script → Background Service Worker

**Purpose**: User clicked the pause button in control panel. Request audio playback to pause.

### Trigger Condition

Sent by content script when:
1. User clicks pause button (⏸) in control panel
2. No other control action is currently pending
3. Control panel is in `showing-playing` state

**Code Location**: `content.js` (pause button click handler)

### Payload Schema

```typescript
{
  type: "CONTROL_PAUSE_CLICKED",
  payload: {},              // Empty payload (no additional data needed)
  timestamp: number
}
```

**Validation**:
- No payload validation needed (empty object)
- Timestamp must be present and recent (within last 5 seconds)

### Response Schema

```typescript
{
  success: boolean,
  error?: string          // Error message if pause fails
}
```

**Response Validation**:
- `success: true` indicates audioPlayer.pause() succeeded
- `success: false` indicates pause failed (e.g., no audio loaded, already paused)

### Handler Actions (Background Service Worker)

1. **Validate message structure**
2. **Forward to offscreen document**:
   - Send `PAUSE_AUDIO` message to offscreen
   - Wait for response from offscreen
3. **Handle offscreen response**:
   - If success: Return `{ success: true }` to content script
   - If error: Return `{ success: false, error: message }` to content script
4. **State change notification**:
   - Offscreen AudioPlayer calls onStatusChange('paused')
   - Background receives AUDIO_STATE_CHANGED
   - Background sends AUDIO_PLAYBACK_PAUSED to content (separate message)

**Error Cases**:
- No audio loaded: Return `{ success: false, error: "No audio to pause" }`
- Already paused: Return `{ success: false, error: "Audio already paused" }`
- Offscreen communication failure: Return `{ success: false, error: "Failed to communicate with audio player" }`

### Example Request/Response

```javascript
// Request from content script
{
  type: "CONTROL_PAUSE_CLICKED",
  payload: {},
  timestamp: 1729182003000
}

// Success response from background
{
  success: true
}

// Error response (already paused)
{
  success: false,
  error: "Audio already paused"
}
```

---

## 6. CONTROL_RESUME_CLICKED

**Direction**: Content Script → Background Service Worker

**Purpose**: User clicked the play button in control panel. Request audio playback to resume.

### Trigger Condition

Sent by content script when:
1. User clicks play button (▶) in control panel
2. No other control action is currently pending
3. Control panel is in `showing-paused` state

**Code Location**: `content.js` (play button click handler)

### Payload Schema

```typescript
{
  type: "CONTROL_RESUME_CLICKED",
  payload: {},
  timestamp: number
}
```

### Response Schema

```typescript
{
  success: boolean,
  error?: string
}
```

### Handler Actions (Background Service Worker)

1. **Validate message structure**
2. **Forward to offscreen document**:
   - Send `RESUME_AUDIO` message to offscreen
   - Wait for response
3. **Handle offscreen response**:
   - If success: Return `{ success: true }`
   - If error: Return `{ success: false, error: message }`
4. **State change notification**:
   - Offscreen AudioPlayer calls onStatusChange('playing')
   - Background receives AUDIO_STATE_CHANGED
   - Background sends AUDIO_PLAYBACK_RESUMED to content

**Error Cases**:
- No audio loaded: `{ success: false, error: "No audio to resume" }`
- Not paused: `{ success: false, error: "Audio not paused" }`
- Autoplay blocked: `{ success: false, error: "Autoplay blocked" }` (unlikely after user interaction)

### Example Request/Response

```javascript
// Request from content script
{
  type: "CONTROL_RESUME_CLICKED",
  payload: {},
  timestamp: 1729182008000
}

// Success response
{
  success: true
}
```

---

## 7. CONTROL_STOP_CLICKED

**Direction**: Content Script → Background Service Worker

**Purpose**: User clicked the stop button in control panel. Request audio playback to stop completely.

### Trigger Condition

Sent by content script when:
1. User clicks stop button (⏹) in control panel
2. No other control action is currently pending
3. Control panel is visible (any state: playing or paused)

**Code Location**: `content.js` (stop button click handler)

### Payload Schema

```typescript
{
  type: "CONTROL_STOP_CLICKED",
  payload: {},
  timestamp: number
}
```

### Response Schema

```typescript
{
  success: boolean,
  error?: string
}
```

### Handler Actions (Background Service Worker)

1. **Validate message structure**
2. **Forward to offscreen document**:
   - Send `STOP_AUDIO` message to offscreen
   - Wait for response
3. **Handle offscreen response**:
   - If success: Return `{ success: true }`
   - If error: Return `{ success: false, error: message }`
4. **Send AUDIO_PLAYBACK_STOPPED**:
   - After successful stop, send notification to content script
   - Payload: `{ reason: "user" }`
5. **Cleanup**:
   - Offscreen AudioPlayer resets position, sets status to 'idle'
   - Background may clear any session data

**Error Cases**:
- No audio loaded: `{ success: false, error: "No audio to stop" }` (unlikely, but possible)
- Stop operation fails: `{ success: false, error: "Failed to stop audio" }`

### Example Request/Response

```javascript
// Request from content script
{
  type: "CONTROL_STOP_CLICKED",
  payload: {},
  timestamp: 1729182012000
}

// Success response
{
  success: true
}

// Followed by separate AUDIO_PLAYBACK_STOPPED message
{
  type: "AUDIO_PLAYBACK_STOPPED",
  payload: {
    reason: "user"
  },
  timestamp: 1729182012500
}
```

---

## 8. AUDIO_STATE_CHANGED (Internal)

**Direction**: Offscreen Document → Background Service Worker

**Purpose**: Internal message to notify background when AudioPlayer state changes. Not directly exposed to content script.

### Trigger Condition

Sent by offscreen document when:
1. AudioPlayer.onStatusChange callback fires
2. Status changes to: 'playing', 'paused', 'idle', 'error'

**Code Location**: `offscreen.js` (in onStatusChange callback setup)

### Payload Schema

```typescript
{
  type: "AUDIO_STATE_CHANGED",
  payload: {
    status: "idle" | "loading" | "playing" | "paused" | "error",
    currentPosition: number,
    duration: number
  },
  timestamp: number
}
```

### Response Schema

```typescript
{
  success: boolean
}
```

### Handler Actions (Background Service Worker)

1. **Validate message structure**
2. **Determine content script message**:
   - If status='playing' (from resume): Send AUDIO_PLAYBACK_RESUMED
   - If status='paused': Send AUDIO_PLAYBACK_PAUSED
   - If status='idle' (from stop): Send AUDIO_PLAYBACK_STOPPED with reason='ended'
   - If status='error': Send AUDIO_PLAYBACK_STOPPED with reason='error'
3. **Query active tab**:
   - Use `chrome.tabs.query({ active: true, currentWindow: true })`
   - Send appropriate message to content script via `chrome.tabs.sendMessage`
4. **Handle errors**:
   - If no active tab: Log warning (no content script to notify)
   - If sendMessage fails: Log error (content script may not be injected)

**This is an internal coordination message** - content script never directly receives it.

### Example Message

```javascript
{
  type: "AUDIO_STATE_CHANGED",
  payload: {
    status: "paused",
    currentPosition: 12.5,
    duration: 45.3
  },
  timestamp: 1729182005000
}
```

---

## Message Validation Utilities

### Base Message Validation

```javascript
/**
 * Validate base message structure (all messages must pass)
 */
function validateBaseMessage(message) {
  if (!message || typeof message !== 'object') {
    throw new Error('Message must be an object');
  }
  if (!message.type || typeof message.type !== 'string') {
    throw new Error('Message type is required and must be a string');
  }
  if (!message.timestamp || typeof message.timestamp !== 'number') {
    throw new Error('Timestamp is required and must be a number');
  }

  // Check timestamp is recent (within last 5 seconds)
  const now = Date.now();
  if (message.timestamp > now + 1000) {
    throw new Error('Timestamp is in the future');
  }
  if (now - message.timestamp > 5000) {
    console.warn('Message timestamp is old (>5s):', message.type);
  }

  return true;
}
```

### Message Type Router

```javascript
/**
 * Route message to appropriate handler based on type
 */
function routeMessage(message, sender, sendResponse) {
  try {
    validateBaseMessage(message);
  } catch (error) {
    console.error('Invalid message:', error.message);
    sendResponse({ success: false, error: error.message });
    return false;
  }

  switch (message.type) {
    case 'AUDIO_PLAYBACK_STARTED':
      handleAudioPlaybackStarted(message, sendResponse);
      return false;

    case 'AUDIO_PLAYBACK_PAUSED':
      handleAudioPlaybackPaused(message, sendResponse);
      return false;

    case 'AUDIO_PLAYBACK_RESUMED':
      handleAudioPlaybackResumed(message, sendResponse);
      return false;

    case 'AUDIO_PLAYBACK_STOPPED':
      handleAudioPlaybackStopped(message, sendResponse);
      return false;

    case 'CONTROL_PAUSE_CLICKED':
      handleControlPauseClicked(message, sendResponse);
      return true; // Async response

    case 'CONTROL_RESUME_CLICKED':
      handleControlResumeClicked(message, sendResponse);
      return true; // Async response

    case 'CONTROL_STOP_CLICKED':
      handleControlStopClicked(message, sendResponse);
      return true; // Async response

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
      return false;
  }
}
```

---

## Error Handling Patterns

### Content Script Error Handling

```javascript
// Optimistic update with error recovery
async function sendControlMessage(type) {
  if (isActionPending) {
    console.log('Control action already pending');
    return;
  }

  isActionPending = true;
  const previousState = getCurrentButtonState();

  try {
    const response = await chrome.runtime.sendMessage({
      type: type,
      payload: {},
      timestamp: Date.now()
    });

    if (!response.success) {
      // Revert optimistic update
      revertButtonState(previousState);
      console.error('Control action failed:', response.error);
    }
  } catch (error) {
    // Runtime error (e.g., background not available)
    revertButtonState(previousState);
    console.error('Failed to send control message:', error);
  } finally {
    isActionPending = false;
  }
}
```

### Background Service Worker Error Handling

```javascript
// Forward message to offscreen with error handling
async function forwardToOffscreen(messageType) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: messageType,
      payload: {},
      timestamp: Date.now()
    });

    return response;
  } catch (error) {
    console.error('Failed to communicate with offscreen:', error);
    return {
      success: false,
      error: 'Offscreen document not available'
    };
  }
}
```

---

## Testing Checklist

### Message Delivery Testing

- [ ] AUDIO_PLAYBACK_STARTED reaches content script when audio starts
- [ ] AUDIO_PLAYBACK_PAUSED confirms pause action
- [ ] AUDIO_PLAYBACK_RESUMED confirms resume action
- [ ] AUDIO_PLAYBACK_STOPPED removes control panel
- [ ] CONTROL_PAUSE_CLICKED pauses audio
- [ ] CONTROL_RESUME_CLICKED resumes audio
- [ ] CONTROL_STOP_CLICKED stops audio

### Validation Testing

- [ ] Messages without type are rejected
- [ ] Messages without timestamp are rejected
- [ ] Messages with invalid payload are rejected
- [ ] Stale messages (>5s old) log warning
- [ ] Unknown message types are gracefully ignored

### Error Scenario Testing

- [ ] Failed pause returns error response
- [ ] Failed resume returns error response
- [ ] Failed stop returns error response
- [ ] Optimistic updates revert on error
- [ ] Background unavailable is handled
- [ ] Offscreen unavailable is handled

### Race Condition Testing

- [ ] Rapid pause/resume clicks are debounced
- [ ] Multiple AUDIO_PLAYBACK_STARTED messages replace control panel
- [ ] Confirmation messages for stale actions are ignored

---

## References

- **Chrome Runtime Messaging**: https://developer.chrome.com/docs/extensions/reference/api/runtime#method-sendMessage
- **Data Model**: `/specs/004-audio-playback-controls/data-model.md`
- **Research Document**: `/specs/004-audio-playback-controls/research.md`
- **Existing Messages**: `/specs/002-text-selection-context-menu/contracts/message-schema.json`

---

**Document Status**: Phase 1 Complete - Message contracts defined and ready for implementation.
