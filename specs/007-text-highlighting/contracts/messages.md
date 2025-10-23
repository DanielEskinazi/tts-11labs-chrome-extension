# Message Contracts: Text Highlighting

**Date**: 2025-10-22 | **Feature**: 007-text-highlighting

## Overview

Defines the chrome.runtime message contracts for communication between background.js, offscreen.js, and content.js for text highlighting synchronization.

---

## Message Types

### 1. START_HIGHLIGHTING

**Direction**: background.js → content.js (via chrome.tabs.sendMessage)

**Purpose**: Initialize highlighting when playback starts

**Payload**:
```javascript
{
  type: 'START_HIGHLIGHTING',
  payload: {
    text: string,              // The full selected text
    audioDuration: number,     // Total audio duration in milliseconds
    playbackSpeed: number,     // Initial playback speed (0.5 - 2.0)
    timestamp: number          // Message timestamp for debugging
  }
}
```

**Response**:
```javascript
{
  success: boolean,
  sentenceCount: number,      // Number of sentences parsed
  error: string | null        // Error message if success=false
}
```

**Validation**:
- `text` MUST be non-empty string
- `audioDuration` MUST be > 0
- `playbackSpeed` MUST be in [0.5, 2.0]

---

### 2. UPDATE_HIGHLIGHT_PROGRESS

**Direction**: offscreen.js → content.js (via chrome.runtime.sendMessage broadcast)

**Purpose**: Update current playback position for highlighting sync

**Payload**:
```javascript
{
  type: 'UPDATE_HIGHLIGHT_PROGRESS',
  payload: {
    currentTime: number,       // Current playback time in milliseconds
    timestamp: number          // Message timestamp
  }
}
```

**Response**: None (fire-and-forget)

**Validation**:
- `currentTime` MUST be >= 0

**Frequency**: Sent every 100ms during playback (10 updates per second)

---

### 3. PLAYBACK_PAUSED

**Direction**: offscreen.js → content.js (via chrome.runtime.sendMessage broadcast)

**Purpose**: Notify that playback has been paused (keep current highlight active)

**Payload**:
```javascript
{
  type: 'PLAYBACK_PAUSED',
  payload: {
    currentTime: number,       // Time when paused (milliseconds)
    timestamp: number
  }
}
```

**Response**: None (fire-and-forget)

---

### 4. PLAYBACK_RESUMED

**Direction**: offscreen.js → content.js (via chrome.runtime.sendMessage broadcast)

**Purpose**: Notify that playback has been resumed from pause

**Payload**:
```javascript
{
  type: 'PLAYBACK_RESUMED',
  payload: {
    currentTime: number,       // Time when resumed (milliseconds)
    timestamp: number
  }
}
```

**Response**: None (fire-and-forget)

---

### 5. PLAYBACK_STOPPED

**Direction**: offscreen.js → content.js (via chrome.runtime.sendMessage broadcast)

**Purpose**: Notify that playback has stopped (cleanup all highlights)

**Payload**:
```javascript
{
  type: 'PLAYBACK_STOPPED',
  payload: {
    reason: 'user' | 'completed' | 'error',  // Why playback stopped
    timestamp: number
  }
}
```

**Response**: None (fire-and-forget)

**Side Effects**: Content script MUST remove all highlights and reset state

---

### 6. SPEED_CHANGED

**Direction**: background.js → content.js (via chrome.tabs.sendMessage)

**Purpose**: Notify that playback speed has changed (recalculate timings)

**Payload**:
```javascript
{
  type: 'SPEED_CHANGED',
  payload: {
    newSpeed: number,          // New playback speed (0.5 - 2.0)
    currentTime: number,       // Current playback time when speed changed
    timestamp: number
  }
}
```

**Response**:
```javascript
{
  success: boolean,
  timingsRecalculated: boolean,
  error: string | null
}
```

**Validation**:
- `newSpeed` MUST be in [0.5, 2.0]
- `currentTime` MUST be >= 0

---

## Message Flow Diagram

```
User Selects Text
    ↓
background.js: textToSpeech(text)
    ↓
background.js → content.js: START_HIGHLIGHTING {text, audioDuration, speed}
    ↓
content.js: Parse sentences, calculate timings, initialize state
    ↓
    ← content.js: {success: true, sentenceCount: N}
    ↓
offscreen.js: Audio starts playing
    ↓
Every 100ms:
    offscreen.js → content.js: UPDATE_HIGHLIGHT_PROGRESS {currentTime}
    content.js: Check if new sentence should be highlighted → update DOM
    ↓
User pauses:
    offscreen.js → content.js: PLAYBACK_PAUSED {currentTime}
    content.js: Keep current highlight active, stop progress updates
    ↓
User resumes:
    offscreen.js → content.js: PLAYBACK_RESUMED {currentTime}
    content.js: Resume progress tracking
    ↓
User changes speed:
    background.js → content.js: SPEED_CHANGED {newSpeed, currentTime}
    content.js: Recalculate all sentence timings
    ← content.js: {success: true, timingsRecalculated: true}
    ↓
Playback completes OR user stops:
    offscreen.js → content.js: PLAYBACK_STOPPED {reason}
    content.js: Remove all highlights, reset state
```

---

## Error Handling

### Message Send Failures

**Scenario**: chrome.tabs.sendMessage fails (tab closed, content script not loaded)

**Handling**:
```javascript
try {
  const response = await chrome.tabs.sendMessage(tabId, message);
} catch (error) {
  console.error('Failed to send message to content script:', error);
  // Graceful degradation: Continue playback without highlighting
}
```

### Invalid Payload

**Scenario**: Content script receives message with invalid payload

**Handling**:
```javascript
if (!validatePayload(message.payload)) {
  console.error('Invalid payload:', message);
  return { success: false, error: 'Invalid payload' };
}
```

### Race Conditions

**Scenario**: SPEED_CHANGED arrives before START_HIGHLIGHTING completes

**Handling**: Content script queues SPEED_CHANGED and processes after initialization

---

## Performance Considerations

### Message Frequency

- UPDATE_HIGHLIGHT_PROGRESS: 10 messages/second (every 100ms)
- For 60-second audio: 600 messages total
- Payload size: ~50 bytes per message
- Total data: ~30KB (negligible)

### Message Batching

Not needed - current frequency is optimal for smooth highlighting updates without excessive overhead.

---

## Testing Checklist

- [ ] START_HIGHLIGHTING with valid payload → highlighting begins
- [ ] START_HIGHLIGHTING with invalid text → error response
- [ ] UPDATE_HIGHLIGHT_PROGRESS updates current sentence correctly
- [ ] PLAYBACK_PAUSED keeps current highlight frozen
- [ ] PLAYBACK_RESUMED continues highlighting from pause point
- [ ] PLAYBACK_STOPPED removes all highlights
- [ ] SPEED_CHANGED recalculates timings and resumes correctly
- [ ] Message send failure (closed tab) doesn't crash background script
- [ ] Rapid speed changes don't cause race conditions
