# Data Model: Playback Speed Control

**Feature**: 005-playback-speed-control
**Date**: 2025-10-19
**Status**: Phase 1 Design

## Entities

### Speed Preference

**Description**: Represents the user's saved playback speed setting that persists across browser sessions.

**Storage Location**: `chrome.storage.local` (key: `playbackSpeed`)

**Attributes**:
| Attribute | Type | Range/Values | Default | Description |
|-----------|------|--------------|---------|-------------|
| speed | Number (float) | 0.5 - 2.0 | 1.0 | Playback speed multiplier |

**Validation Rules**:
- Value MUST be a number (reject strings, null, undefined)
- Value MUST be >= 0.5 and <= 2.0 (inclusive)
- Invalid values fallback to default 1.0
- Precision: Recommend storing as-is (0.5, 0.75, 1.0, etc.), no rounding needed

**Lifecycle**:
1. **Created**: First time user changes speed from default
2. **Read**: Every time audio playback starts (auto-apply preference)
3. **Updated**: Every time user selects different speed preset
4. **Deleted**: Never (persists indefinitely unless user clears extension data)

**Example Storage**:
```json
{
  "playbackSpeed": 1.5
}
```

---

### Playback Speed State (Runtime)

**Description**: Represents the current playback speed during an active audio session. This is runtime state, not persisted.

**Storage Location**: In-memory (AudioPlayer instance in offscreen document)

**Attributes**:
| Attribute | Type | Range/Values | Default | Description |
|-----------|------|--------------|---------|-------------|
| currentSpeed | Number (float) | 0.5 - 2.0 | 1.0 | Currently active playback speed |

**State Transitions**:

```
Initial State: No Audio
  ↓
LOAD_AUDIO + saved preference
  ↓
Speed Set to Saved Preference (e.g., 1.5x)
  ↓
PLAY_AUDIO
  ↓
Audio Playing at 1.5x
  ↓ (user changes speed)
SET_PLAYBACK_SPEED (e.g., 2.0x)
  ↓
Audio Playing at 2.0x (no interruption)
  ↓ (user changes speed again)
SET_PLAYBACK_SPEED (e.g., 0.75x)
  ↓
Audio Playing at 0.75x
  ↓
STOP_AUDIO or AUDIO_PLAYBACK_ENDED
  ↓
Speed Preference Saved (0.75x persisted)
  ↓
Back to Initial State (no audio, preference remembered)
```

**State Invariants**:
- Speed MUST always be within 0.5x - 2.0x range during playback
- Speed changes MUST NOT pause, stop, or restart audio
- Speed MUST persist across pause/resume cycles (pausing doesn't reset speed)

---

## Speed Preset List (Constants)

**Description**: Predefined speed options available to users. Not persisted, defined in code.

**Presets**:
| Label | Value | Use Case |
|-------|-------|----------|
| 0.5x | 0.5 | Very slow (learning, accessibility, non-native speakers) |
| 0.75x | 0.75 | Slow (careful listening, complex content) |
| 1x | 1.0 | Normal speed (default) |
| 1.25x | 1.25 | Slightly faster (comfortable speedup) |
| 1.5x | 1.5 | Fast (common for podcasts, audiobooks) |
| 1.75x | 1.75 | Very fast (experienced listeners) |
| 2x | 2.0 | Maximum speed (skim content quickly) |

**Implementation**:
```javascript
const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

// Validation helper
function isValidSpeed(speed) {
  return typeof speed === 'number' && speed >= 0.5 && speed <= 2.0;
}

// Find closest preset (if needed for UI highlighting)
function getClosestPreset(speed) {
  return SPEED_PRESETS.reduce((prev, curr) =>
    Math.abs(curr - speed) < Math.abs(prev - speed) ? curr : prev
  );
}
```

---

## Entity Relationships

```
User
  └─ has one ─→ Speed Preference (persisted in chrome.storage.local)

Audio Session (runtime)
  ├─ has one ─→ Playback Speed State (current speed during playback)
  └─ initialized from ─→ Speed Preference (auto-applied on audio start)

Speed Preset List (constants)
  └─ provides options for ─→ User
```

**Relationship Notes**:
- One Speed Preference per user (global setting, not per-audio-file)
- One Playback Speed State per active audio session (reset when new audio loads)
- Speed Preset List is static (no user customization)

---

## Data Flow

```
1. User Loads Extension
   ↓
2. Background reads Speed Preference from chrome.storage.local
   → If not found: default to 1.0
   → If invalid: fallback to 1.0 and log warning
   ↓
3. User Triggers TTS Audio
   ↓
4. Background passes saved preference to Offscreen
   ↓
5. Offscreen creates AudioPlayer, sets playbackRate to preference
   ↓
6. Audio plays at saved speed
   ↓
7. User clicks speed preset in control panel (e.g., 1.5x)
   ↓
8. Content script sends CONTROL_SPEED_CHANGED to Background
   ↓
9. Background:
   - Saves new speed (1.5) to chrome.storage.local
   - Forwards SET_PLAYBACK_SPEED to Offscreen
   ↓
10. Offscreen:
    - Applies speed to audioPlayer.audio.playbackRate
    - Confirms success to Background (optional)
    ↓
11. Background notifies Content script (optional)
    ↓
12. Content script updates UI (highlights 1.5x preset)
    ↓
13. Audio continues playing at new speed (1.5x)
```

---

## Validation & Error Handling

### Storage Read Validation

```javascript
async function getPlaybackSpeed() {
  try {
    const result = await chrome.storage.local.get({ playbackSpeed: 1.0 });
    const speed = result.playbackSpeed;

    // Type check
    if (typeof speed !== 'number') {
      console.error('Invalid speed type:', typeof speed, 'expected number');
      return 1.0; // Fallback to default
    }

    // Range check
    if (speed < 0.5 || speed > 2.0) {
      console.error('Speed out of range:', speed, 'expected 0.5-2.0');
      return 1.0; // Fallback to default
    }

    return speed;
  } catch (error) {
    console.error('Failed to read playback speed:', error);
    return 1.0; // Fallback to default
  }
}
```

### Runtime Speed Change Validation

```javascript
function setPlaybackSpeed(speed) {
  // Validate before applying
  if (typeof speed !== 'number') {
    console.error('Invalid speed type:', typeof speed);
    return false;
  }

  if (speed < 0.5 || speed > 2.0) {
    console.error('Speed out of range:', speed);
    return false;
  }

  if (!this.audio) {
    console.warn('No audio element to set speed on');
    return false;
  }

  try {
    this.audio.playbackRate = speed;
    console.log('Playback speed set to:', speed);
    return true;
  } catch (error) {
    console.error('Failed to set playback speed:', error);
    return false;
  }
}
```

---

## Schema Versioning

**Current Version**: 1.0.0

**Storage Schema**:
```
chrome.storage.local {
  "playbackSpeed": Number (0.5 - 2.0)
}
```

**Future Migration Notes**:
- If adding per-voice or per-content-type speeds: migrate single `playbackSpeed` to `{ default: 1.5, voices: {...} }`
- If adding custom presets: add `customSpeedPresets: []` array
- Always provide fallback for missing or corrupted data

---

**Status**: Complete - Data model defines all entities, relationships, validation rules, and state transitions for playback speed control feature.
