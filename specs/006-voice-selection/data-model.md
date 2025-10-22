# Data Model: Voice Selection Feature

**Feature**: Voice Selection | **Date**: 2025-10-22 | **Phase**: 1 (Design & Contracts)

## Overview

This document defines the data structures for the voice selection feature. All data is stored in chrome.storage.local (Manifest V3 compliant).

---

## 1. Voice Object

**Source**: ElevenLabs API `/v1/voices` endpoint response

**Purpose**: Represents an available voice from ElevenLabs

**Structure**:
```javascript
{
  voice_id: string,        // Unique identifier (required)
  name: string,            // Display name (required)
  labels: {                // Voice characteristics (optional)
    gender: string,        // e.g., "male", "female"
    accent: string,        // e.g., "american", "british", "australian"
    description: string,   // e.g., "calm", "energetic"
    age: string,          // e.g., "young", "middle-aged", "old"
    use_case: string      // e.g., "narration", "conversation"
  },
  preview_url: string,     // URL to voice preview sample (optional, not used in MVP)
  category: string         // Voice category (optional)
}
```

**Validation Rules**:
- `voice_id` must be non-empty string
- `name` must be non-empty string
- `labels` object may be missing or incomplete
- All other fields are optional

**Example**:
```javascript
{
  voice_id: "21m00Tcm4TlvDq8ikWAM",
  name: "Rachel",
  labels: {
    gender: "female",
    accent: "american",
    description: "calm",
    age: "young"
  },
  preview_url: "https://storage.googleapis.com/...",
  category: "premade"
}
```

---

## 2. Voice Cache

**Storage Key**: `voiceCache`

**Purpose**: Caches the list of available voices with timestamp to minimize API calls

**Structure**:
```javascript
{
  voices: Voice[],         // Array of Voice objects
  cachedAt: number,        // Unix timestamp (milliseconds) when cache was created
  ttl: number             // Time-to-live in milliseconds (24 hours = 86400000)
}
```

**Validation Rules**:
- `voices` must be an array (may be empty)
- `cachedAt` must be a valid Unix timestamp
- `ttl` must be a positive number (default: 86400000)
- Cache is considered valid if `(Date.now() - cachedAt) < ttl`

**Example**:
```javascript
{
  voices: [
    { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", labels: {...} },
    { voice_id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde", labels: {...} },
    // ... more voices
  ],
  cachedAt: 1698234567890,
  ttl: 86400000
}
```

**Cache Invalidation Logic**:
```javascript
function isCacheValid(cache) {
  if (!cache || !cache.cachedAt || !Array.isArray(cache.voices)) {
    return false;
  }

  const age = Date.now() - cache.cachedAt;
  return age < (cache.ttl || 86400000);
}
```

---

## 3. Voice Preference

**Storage Key**: `selectedVoiceId`

**Purpose**: Stores the user's selected voice ID

**Structure**:
```javascript
string  // Voice ID selected by user
```

**Validation Rules**:
- Must be a non-empty string
- Should correspond to a voice_id in the voice list
- If validation fails or voice unavailable, fallback to `DEFAULT_VOICE_ID`

**Default Value**: `null` (not set) - system uses `DEFAULT_VOICE_ID` from elevenlabs.js

**Example**:
```javascript
"21m00Tcm4TlvDq8ikWAM"  // Rachel's voice ID
```

**Retrieval Pattern**:
```javascript
async function getSelectedVoiceId() {
  const { selectedVoiceId } = await chrome.storage.local.get(['selectedVoiceId']);
  return selectedVoiceId || DEFAULT_VOICE_ID;
}
```

---

## 4. Voice Dropdown Option

**Purpose**: UI representation of a voice in the dropdown menu

**Structure** (HTML):
```html
<option value="{voice_id}">{formatted_label}</option>
```

**Label Format**: `{name} - {Gender}, {Accent}`

**Example**:
```html
<option value="21m00Tcm4TlvDq8ikWAM">Rachel - Female, American</option>
```

**Label Generation Logic**:
```javascript
function formatVoiceLabel(voice) {
  const name = voice.name;
  const gender = voice.labels?.gender || '';
  const accent = voice.labels?.accent || '';

  if (gender && accent) {
    const capitalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1);
    const capitalizedAccent = accent.charAt(0).toUpperCase() + accent.slice(1);
    return `${name} - ${capitalizedGender}, ${capitalizedAccent}`;
  } else if (gender) {
    const capitalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1);
    return `${name} - ${capitalizedGender}`;
  }

  return name;
}
```

---

## 5. Preview Request Message

**Purpose**: Message sent from popup to background to request voice preview

**Structure**:
```javascript
{
  action: "PREVIEW_VOICE",
  voiceId: string,         // Voice ID to preview
  sampleText: string       // Fixed sample text: "Hello, this is a preview of this voice."
}
```

**Example**:
```javascript
{
  action: "PREVIEW_VOICE",
  voiceId: "21m00Tcm4TlvDq8ikWAM",
  sampleText: "Hello, this is a preview of this voice."
}
```

**Response**: None (preview plays in offscreen document, errors logged to console)

---

## 6. Voice List Request Message

**Purpose**: Message sent from popup to background to request voice list

**Structure**:
```javascript
{
  action: "GET_VOICES",
  forceRefresh: boolean    // Optional: true to bypass cache
}
```

**Response Structure**:
```javascript
{
  success: boolean,
  voices: Voice[],         // Array of Voice objects
  error: string           // Error message if success is false
}
```

**Example Request**:
```javascript
{
  action: "GET_VOICES",
  forceRefresh: false
}
```

**Example Success Response**:
```javascript
{
  success: true,
  voices: [
    { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", labels: {...} },
    { voice_id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde", labels: {...} }
  ]
}
```

**Example Error Response**:
```javascript
{
  success: false,
  voices: [],
  error: "Failed to fetch voices from API"
}
```

---

## State Transitions

### Voice Cache Lifecycle

```
[Initial State: No Cache]
         |
         v
[Popup Opens] --> Check cache validity
         |
         +-- Cache Valid --> Use cached voices
         |
         +-- Cache Invalid/Missing --> Fetch from API
                    |
                    +-- API Success --> Update cache + display voices
                    |
                    +-- API Failure --> Use stale cache (if exists) + show notification
                                  |
                                  +-- No cache --> Show error + use default voice
```

### Voice Selection Lifecycle

```
[User Opens Popup]
         |
         v
[Load Selected Voice from Storage] --> selectedVoiceId or DEFAULT_VOICE_ID
         |
         v
[Display in Dropdown] --> Set dropdown.value to voice ID
         |
         v
[User Changes Selection] --> 'change' event fires
         |
         v
[Auto-Save to Storage] --> chrome.storage.local.set({ selectedVoiceId: newValue })
         |
         v
[Apply to Playback] --> Background uses new voice ID for textToSpeech
```

### Preview Lifecycle

```
[User Clicks Preview Button]
         |
         v
[Get Currently Selected Voice from Dropdown]
         |
         v
[Send PREVIEW_VOICE Message to Background]
         |
         v
[Background Generates Audio via TTS API]
         |
         +-- Success --> Send audio to offscreen player
         |                     |
         |                     v
         |               [Play Preview Audio]
         |
         +-- Failure --> Log error + show notification near preview button
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         POPUP UI                             │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │ Voice Dropdown  │  │ Preview Button   │                  │
│  │ (select element)│  │                  │                  │
│  └────────┬────────┘  └────────┬─────────┘                  │
│           │                    │                             │
│           │ change event       │ click event                 │
│           v                    v                             │
│  ┌─────────────────────────────────────┐                    │
│  │        popup.js                      │                    │
│  │ - Save voice to storage (auto-save) │                    │
│  │ - Send preview request               │                    │
│  └──────────────┬──────────────────────┘                    │
└─────────────────┼───────────────────────────────────────────┘
                  │
                  │ chrome.runtime.sendMessage
                  v
┌─────────────────────────────────────────────────────────────┐
│                    BACKGROUND SERVICE WORKER                 │
│  ┌─────────────────────────────────────────┐                │
│  │         background.js                    │                │
│  │ - Handle GET_VOICES request              │                │
│  │ - Handle PREVIEW_VOICE request           │                │
│  │ - Fetch voice list from API              │                │
│  │ - Manage voice cache                     │                │
│  │ - Generate preview audio                 │                │
│  └──────────────┬──────────────────────────┘                │
└─────────────────┼───────────────────────────────────────────┘
                  │
                  │ sendMessage to offscreen
                  v
┌─────────────────────────────────────────────────────────────┐
│                    OFFSCREEN DOCUMENT                        │
│  ┌─────────────────────────────────────────┐                │
│  │         offscreen.js                     │                │
│  │ - Receive audio blob                     │                │
│  │ - Play preview/playback audio            │                │
│  │ - Handle audio controls                  │                │
│  └──────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                  │
                  │ Web Audio API / HTMLAudioElement
                  v
          [Audio Output to User]


┌─────────────────────────────────────────────────────────────┐
│                  CHROME STORAGE (Persistent)                 │
│  ┌─────────────────────────────────────────┐                │
│  │ selectedVoiceId: "21m00Tcm4TlvDq8ikWAM" │                │
│  │ voiceCache: {                            │                │
│  │   voices: [...],                         │                │
│  │   cachedAt: 1698234567890,               │                │
│  │   ttl: 86400000                          │                │
│  │ }                                        │                │
│  └──────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

**Core Data Entities**:
1. Voice Object - from ElevenLabs API
2. Voice Cache - in chrome.storage.local with 24-hour TTL
3. Voice Preference - simple string voice ID in chrome.storage.local
4. Voice Dropdown Option - UI representation
5. Preview Request Message - popup ↔ background communication
6. Voice List Request Message - popup ↔ background communication

**Storage Keys**:
- `selectedVoiceId` - User's voice preference
- `voiceCache` - Cached voice list with timestamp

**Key Relationships**:
- Voice Preference references Voice Object by voice_id
- Voice Cache contains array of Voice Objects
- Dropdown Options derived from Voice Objects
- All communication via chrome.runtime.sendMessage
