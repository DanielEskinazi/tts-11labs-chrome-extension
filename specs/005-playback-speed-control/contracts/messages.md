# Message Contracts: Playback Speed Control

**Feature**: 005-playback-speed-control
**Date**: 2025-10-19
**Status**: Phase 1 Design

## Overview

This document defines the message contracts for playback speed control communication between content script, background service worker, and offscreen document. All messages follow the existing extension pattern with `type`, `payload`, and `timestamp` fields.

---

## Message Flow Diagram

```
Content Script          Background Service Worker          Offscreen Document
     │                            │                              │
     │  CONTROL_SPEED_CHANGED     │                              │
     │───────────────────────────>│                              │
     │                            │   SET_PLAYBACK_SPEED         │
     │                            │─────────────────────────────>│
     │                            │                              │ (apply speed)
     │                            │   SPEED_APPLIED (optional)   │
     │                            │<─────────────────────────────│
     │  SPEED_PREFERENCE_UPDATED  │                              │
     │<───────────────────────────│                              │
     │ (update UI)                │                              │
```

---

## Message Definitions

### 1. CONTROL_SPEED_CHANGED

**Direction**: Content Script → Background Service Worker

**Trigger**: User clicks a speed preset button in the control panel dropdown

**Purpose**: Notify background that user wants to change playback speed

**Schema**:
```typescript
{
  type: 'CONTROL_SPEED_CHANGED',
  payload: {
    speed: number  // 0.5 - 2.0, must be one of the 7 presets
  },
  timestamp: number  // Date.now()
}
```

**Example**:
```json
{
  "type": "CONTROL_SPEED_CHANGED",
  "payload": {
    "speed": 1.5
  },
  "timestamp": 1697812345678
}
```

**Validation Rules**:
- `speed` MUST be a number
- `speed` MUST be >= 0.5 and <= 2.0
- `speed` SHOULD be one of [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]
- `timestamp` MUST be present

**Response**:
```typescript
{
  success: boolean,
  error?: string  // Only if success is false
}
```

**Error Conditions**:
- Invalid speed value (outside 0.5-2.0 range)
- Missing required fields
- Background service worker error

---

### 2. SET_PLAYBACK_SPEED

**Direction**: Background Service Worker → Offscreen Document

**Trigger**: Background receives CONTROL_SPEED_CHANGED or needs to apply saved preference

**Purpose**: Instruct offscreen document to change AudioPlayer playback speed

**Schema**:
```typescript
{
  type: 'SET_PLAYBACK_SPEED',
  payload: {
    speed: number  // 0.5 - 2.0, validated by background
  },
  timestamp: number  // Date.now()
}
```

**Example**:
```json
{
  "type": "SET_PLAYBACK_SPEED",
  "payload": {
    "speed": 1.75
  },
  "timestamp": 1697812345680
}
```

**Validation Rules**:
- `speed` MUST be a number
- `speed` MUST be >= 0.5 and <= 2.0
- `timestamp` MUST be present

**Response**:
```typescript
{
  success: boolean,
  error?: string,  // e.g., "No audio playing"
  appliedSpeed?: number  // Confirmation of applied speed
}
```

**Error Conditions**:
- No audio currently loaded (audioPlayer is null)
- No audio element exists (audioPlayer.audio is null)
- Invalid speed value
- Browser error when setting playbackRate

---

### 3. SPEED_APPLIED (Optional)

**Direction**: Offscreen Document → Background Service Worker → Content Script

**Trigger**: Offscreen successfully changes playback speed

**Purpose**: Confirm speed change so content script can update UI

**Schema**:
```typescript
{
  type: 'SPEED_APPLIED',
  payload: {
    speed: number,  // The speed that was applied
    previousSpeed?: number  // Optional: previous speed before change
  },
  timestamp: number
}
```

**Example**:
```json
{
  "type": "SPEED_APPLIED",
  "payload": {
    "speed": 1.5,
    "previousSpeed": 1.0
  },
  "timestamp": 1697812345682
}
```

**Note**: This message is optional. Content script can assume success if CONTROL_SPEED_CHANGED response is `{ success: true }`. This confirmation is primarily for debugging and ensuring UI state matches audio state.

---

### 4. SPEED_PREFERENCE_UPDATED (Optional)

**Direction**: Background Service Worker → Content Script

**Trigger**: Background successfully saves speed preference to chrome.storage.local

**Purpose**: Notify content script that preference was saved (for UI feedback)

**Schema**:
```typescript
{
  type: 'SPEED_PREFERENCE_UPDATED',
  payload: {
    speed: number  // Saved preference value
  },
  timestamp: number
}
```

**Example**:
```json
{
  "type": "SPEED_PREFERENCE_UPDATED",
  "payload": {
    "speed": 1.25
  },
  "timestamp": 1697812345685
}
```

**Note**: This message is optional and primarily for future enhancements (e.g., showing "Preference saved!" toast).

---

## Extended Messages (Modifications to Existing)

### PLAY_AUDIO (Modified)

**Direction**: Background Service Worker → Offscreen Document

**Modification**: Add `initialSpeed` to payload to apply saved preference

**Updated Schema**:
```typescript
{
  type: 'PLAY_AUDIO',
  payload: {
    initialSpeed?: number  // NEW: Speed to apply before playback starts (default: 1.0)
  },
  timestamp: number
}
```

**Example**:
```json
{
  "type": "PLAY_AUDIO",
  "payload": {
    "initialSpeed": 1.5
  },
  "timestamp": 1697812345690
}
```

**Behavior**:
- Offscreen document reads `initialSpeed` from payload
- If present and valid, sets `audioPlayer.audio.playbackRate` immediately after play() starts
- If missing, defaults to 1.0 (normal speed)
- If invalid, logs warning and uses 1.0

---

### AUDIO_PLAYBACK_STARTED (Modified)

**Direction**: Background Service Worker → Content Script

**Modification**: Add `currentSpeed` to payload so UI knows initial speed

**Updated Schema**:
```typescript
{
  type: 'AUDIO_PLAYBACK_STARTED',
  payload: {
    duration: number,
    currentSpeed?: number  // NEW: Current playback speed (from saved preference)
  },
  timestamp: number
}
```

**Example**:
```json
{
  "type": "AUDIO_PLAYBACK_STARTED",
  "payload": {
    "duration": 45.5,
    "currentSpeed": 1.5
  },
  "timestamp": 1697812345695
}
```

**Behavior**:
- Content script reads `currentSpeed` from payload
- Updates speed dropdown UI to highlight correct preset
- If missing, assumes 1.0 (normal speed)

---

## Message Validation Helpers

### validateSpeedMessage

**Purpose**: Validate CONTROL_SPEED_CHANGED and SET_PLAYBACK_SPEED messages

**Implementation**:
```javascript
function validateSpeedMessage(message) {
  // Check structure
  if (!message || !message.type || !message.payload || !message.timestamp) {
    return { valid: false, error: 'Invalid message structure' };
  }

  // Check speed value
  const { speed } = message.payload;

  if (typeof speed !== 'number') {
    return { valid: false, error: 'Speed must be a number' };
  }

  if (speed < 0.5 || speed > 2.0) {
    return { valid: false, error: 'Speed out of range (0.5 - 2.0)' };
  }

  if (isNaN(speed) || !isFinite(speed)) {
    return { valid: false, error: 'Speed must be a finite number' };
  }

  return { valid: true };
}
```

**Usage**:
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CONTROL_SPEED_CHANGED' || message.type === 'SET_PLAYBACK_SPEED') {
    const validation = validateSpeedMessage(message);

    if (!validation.valid) {
      console.error('Invalid speed message:', validation.error);
      sendResponse({ success: false, error: validation.error });
      return false;
    }

    // Proceed with handling...
  }
});
```

---

## Error Response Codes

| Error | Message | Cause | Recovery |
|-------|---------|-------|----------|
| INVALID_SPEED | "Speed must be between 0.5 and 2.0" | Speed value outside allowed range | Fallback to 1.0 (normal speed) |
| NO_AUDIO | "No audio currently playing" | SET_PLAYBACK_SPEED sent when no audio loaded | Ignore or queue for next playback |
| INVALID_MESSAGE | "Invalid message structure" | Missing type, payload, or timestamp | Reject message, log error |
| STORAGE_ERROR | "Failed to save speed preference" | chrome.storage.local write failed | Continue playback, preference not saved |
| BROWSER_ERROR | "Failed to set playbackRate" | Browser rejected playbackRate change | Log error, keep previous speed |

---

## Testing Scenarios

### Happy Path

1. User clicks 1.5x preset
2. Content script sends CONTROL_SPEED_CHANGED with speed: 1.5
3. Background validates, saves to storage, forwards SET_PLAYBACK_SPEED to offscreen
4. Offscreen applies playbackRate = 1.5
5. Audio continues at 1.5x speed
6. Content script highlights 1.5x preset in UI

**Expected Messages**:
```
Content → Background: CONTROL_SPEED_CHANGED { speed: 1.5 }
Background → Offscreen: SET_PLAYBACK_SPEED { speed: 1.5 }
Offscreen → Background: { success: true, appliedSpeed: 1.5 }
Background → Content: { success: true }
```

### Error Path: Invalid Speed

1. Malformed message with speed: 5.0 (out of range)
2. Background validates, rejects
3. Content script receives error response

**Expected Messages**:
```
Content → Background: CONTROL_SPEED_CHANGED { speed: 5.0 }
Background → Content: { success: false, error: "Speed out of range (0.5 - 2.0)" }
```

### Error Path: No Audio Playing

1. User clicks speed preset while no audio is loaded
2. Background forwards to offscreen
3. Offscreen has no audioPlayer or audio element
4. Returns error

**Expected Messages**:
```
Content → Background: CONTROL_SPEED_CHANGED { speed: 1.5 }
Background → Offscreen: SET_PLAYBACK_SPEED { speed: 1.5 }
Offscreen → Background: { success: false, error: "No audio playing" }
Background → Content: { success: false, error: "No audio playing" }
```

### Edge Case: Rapid Speed Changes

1. User clicks 1.5x, then immediately clicks 2.0x
2. Two CONTROL_SPEED_CHANGED messages sent in quick succession
3. Background processes both, final speed is 2.0x

**Expected Behavior**:
- Both messages processed successfully
- Final playbackRate is 2.0 (last message wins)
- Storage contains 2.0 (last saved value)
- No race conditions or errors

---

## Message Priority & Ordering

**Priority**: Speed changes are **medium priority**
- Lower priority than pause/stop (safety controls)
- Higher priority than visual indicator updates (affects audio output)

**Ordering**: Speed changes are **FIFO** (first-in-first-out)
- If multiple CONTROL_SPEED_CHANGED messages queued, process in order
- Last applied speed is what user hears (override behavior, not additive)

---

**Status**: Complete - All message contracts defined with schemas, validation, error handling, and test scenarios.
