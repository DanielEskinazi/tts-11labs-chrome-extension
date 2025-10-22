# API Contract: ElevenLabs Voices API

**Feature**: Voice Selection | **Date**: 2025-10-22 | **Phase**: 1 (Design & Contracts)

## Overview

This document specifies the contract for interacting with the ElevenLabs Voices API endpoint to retrieve available voices.

---

## Endpoint: Get Voices

### Request

**Method**: `GET`

**URL**: `https://api.elevenlabs.io/v1/voices`

**Headers**:
```
xi-api-key: <API_KEY>
```

**Query Parameters**: None

**Request Body**: None

**Example**:
```http
GET /v1/voices HTTP/1.1
Host: api.elevenlabs.io
xi-api-key: sk_1234567890abcdef
```

---

### Response

#### Success (200 OK)

**Content-Type**: `application/json`

**Body Structure**:
```json
{
  "voices": [
    {
      "voice_id": "string",
      "name": "string",
      "samples": null,
      "category": "string",
      "fine_tuning": {
        "model_id": "string",
        "is_allowed_to_fine_tune": boolean,
        "finetuning_state": "string",
        "verification_attempts": null,
        "verification_failures": [],
        "verification_attempts_count": number,
        "slice_ids": null,
        "manual_verification": null,
        "manual_verification_requested": boolean
      },
      "labels": {
        "accent": "string",
        "description": "string",
        "age": "string",
        "gender": "string",
        "use_case": "string"
      },
      "description": null,
      "preview_url": "string",
      "available_for_tiers": [],
      "settings": null,
      "sharing": null,
      "high_quality_base_model_ids": [],
      "safety_control": null,
      "voice_verification": {
        "requires_verification": boolean,
        "is_verified": boolean,
        "verification_failures": [],
        "verification_attempts_count": number,
        "language": null,
        "verification_attempts": null
      },
      "permission_on_resource": null
    }
  ]
}
```

**Minimal Structure Used by Extension**:
```json
{
  "voices": [
    {
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "name": "Rachel",
      "labels": {
        "accent": "american",
        "gender": "female",
        "age": "young",
        "description": "calm"
      },
      "preview_url": "https://storage.googleapis.com/..."
    }
  ]
}
```

**Example Success Response**:
```json
{
  "voices": [
    {
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "name": "Rachel",
      "category": "premade",
      "labels": {
        "accent": "american",
        "description": "calm",
        "age": "young",
        "gender": "female",
        "use_case": "narration"
      },
      "preview_url": "https://storage.googleapis.com/elevenlabs-public/voices/21m00Tcm4TlvDq8ikWAM/9c74ab86-fb8e-4d5d-aa1c-f96e729f3ad0.mp3"
    },
    {
      "voice_id": "2EiwWnXFnvU5JabPnv8n",
      "name": "Clyde",
      "category": "premade",
      "labels": {
        "accent": "american",
        "description": "deep",
        "age": "middle-aged",
        "gender": "male",
        "use_case": "video games"
      },
      "preview_url": "https://storage.googleapis.com/elevenlabs-public/voices/2EiwWnXFnvU5JabPnv8n/5ae5acdd-8f9f-4e8f-8d6a-e4980d1053d3.mp3"
    }
  ]
}
```

#### Error Responses

**401 Unauthorized**

```json
{
  "detail": {
    "status": "invalid_api_key",
    "message": "Invalid API key"
  }
}
```

**Too Many Requests (429)**

```json
{
  "detail": {
    "status": "quota_exceeded",
    "message": "You have exceeded your quota"
  }
}
```

**500 Internal Server Error**

```json
{
  "detail": {
    "status": "internal_server_error",
    "message": "Internal server error"
  }
}
```

---

## Implementation Contract

### Function: `getVoices()`

**Location**: `src/api/elevenlabs.js`

**Purpose**: Retrieve list of available voices from ElevenLabs API

**Signature**:
```javascript
/**
 * Get available voices from ElevenLabs API
 * @param {string} apiKey - The ElevenLabs API key
 * @returns {Promise<Voice[]>} - Array of voice objects
 * @throws {Error} - If API request fails
 */
export async function getVoices(apiKey)
```

**Parameters**:
- `apiKey` (string, required): Valid ElevenLabs API key

**Returns**: Promise resolving to array of Voice objects

**Voice Object Structure** (returned):
```javascript
{
  voice_id: string,
  name: string,
  labels: {
    gender?: string,
    accent?: string,
    age?: string,
    description?: string,
    use_case?: string
  },
  preview_url?: string,
  category?: string
}
```

**Error Handling**:
- Invalid API key: Throw error with message "Invalid API key"
- Network failure: Throw error with message "Failed to fetch voices from API"
- Invalid response: Throw error with message "Invalid response from voices API"

**Example Usage**:
```javascript
import { getVoices } from './src/api/elevenlabs.js';

try {
  const voices = await getVoices(apiKey);
  console.log(`Retrieved ${voices.length} voices`);

  voices.forEach(voice => {
    console.log(`${voice.name} (${voice.voice_id})`);
  });
} catch (error) {
  console.error('Failed to get voices:', error.message);
}
```

**Implementation**:
```javascript
export async function getVoices(apiKey) {
  const url = `${API_BASE_URL}/voices`;

  const headers = {
    'xi-api-key': apiKey
  };

  const response = await fetch(url, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid API key');
    }
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data.voices || !Array.isArray(data.voices)) {
    throw new Error('Invalid response from voices API');
  }

  return data.voices;
}
```

---

## Caching Contract

### Function: `getCachedVoices()`

**Location**: `src/utils/storage.js`

**Purpose**: Retrieve cached voices if still valid

**Signature**:
```javascript
/**
 * Get cached voices from chrome.storage.local
 * @returns {Promise<Voice[]|null>} - Cached voices or null if invalid/missing
 */
export async function getCachedVoices()
```

**Returns**:
- Valid cache: Array of Voice objects
- Invalid/expired cache: `null`
- No cache: `null`

**Example Usage**:
```javascript
const cached = await getCachedVoices();
if (cached) {
  console.log('Using cached voices');
  return cached;
}

console.log('Cache miss, fetching from API');
const voices = await getVoices(apiKey);
await cacheVoices(voices);
```

---

### Function: `cacheVoices()`

**Location**: `src/utils/storage.js`

**Purpose**: Save voices to cache with timestamp

**Signature**:
```javascript
/**
 * Cache voices in chrome.storage.local
 * @param {Voice[]} voices - Array of voice objects to cache
 * @returns {Promise<void>}
 */
export async function cacheVoices(voices)
```

**Parameters**:
- `voices` (Voice[], required): Array of voice objects from API

**Cache Structure**:
```javascript
{
  voiceCache: {
    voices: Voice[],
    cachedAt: number,  // Unix timestamp
    ttl: 86400000     // 24 hours in milliseconds
  }
}
```

**Example Usage**:
```javascript
const voices = await getVoices(apiKey);
await cacheVoices(voices);
console.log('Voices cached successfully');
```

---

## Message Passing Contracts

### Message: GET_VOICES

**Direction**: Popup → Background

**Purpose**: Request voice list (with caching)

**Request**:
```javascript
{
  action: "GET_VOICES",
  forceRefresh: boolean  // Optional, default: false
}
```

**Response**:
```javascript
{
  success: boolean,
  voices: Voice[],       // Empty array on error
  error?: string        // Present only if success is false
}
```

**Example**:
```javascript
// In popup.js
const response = await chrome.runtime.sendMessage({
  action: "GET_VOICES",
  forceRefresh: false
});

if (response.success) {
  populateVoiceDropdown(response.voices);
} else {
  showError(response.error);
}
```

---

### Message: PREVIEW_VOICE

**Direction**: Popup → Background

**Purpose**: Generate and play voice preview

**Request**:
```javascript
{
  action: "PREVIEW_VOICE",
  voiceId: string,
  sampleText: "Hello, this is a preview of this voice."
}
```

**Response**: None (fire-and-forget)

**Example**:
```javascript
// In popup.js
chrome.runtime.sendMessage({
  action: "PREVIEW_VOICE",
  voiceId: document.getElementById('voice-select').value,
  sampleText: "Hello, this is a preview of this voice."
});
```

**Error Handling**:
- Errors logged to console
- Notification shown near preview button if generation fails

---

## Rate Limiting

**ElevenLabs API Limits**:
- Free tier: 10,000 characters/month
- Voices endpoint: No documented rate limit per request
- Recommended: Cache voices to minimize API calls

**Extension Caching Strategy**:
- Cache TTL: 24 hours
- Voices endpoint called max once per day per user (assuming cache not cleared)
- Preview audio: Not cached (generated on-demand)

---

## Error Handling Strategy

| Error Type | Extension Behavior |
|------------|-------------------|
| Invalid API Key | Show error in popup, prevent voice fetching |
| Network Failure | Use cached voices (even if expired), show notification |
| No Cache Available | Show error, use DEFAULT_VOICE_ID for playback |
| Voice Not in List | Auto-fallback to DEFAULT_VOICE_ID, show notification |
| Preview Generation Fails | Show error near preview button, don't block selection |

---

## Testing Checklist

- [ ] GET /v1/voices returns expected structure
- [ ] Voice IDs are stable across multiple requests
- [ ] API handles invalid API key gracefully (401)
- [ ] Caching reduces redundant API calls
- [ ] Cache invalidation works after 24 hours
- [ ] Fallback to cached voices on network failure
- [ ] Preview audio generation uses correct voice ID
- [ ] Error messages are user-friendly

---

## Summary

**Primary Endpoint**: `GET /v1/voices`
**Authentication**: API key in `xi-api-key` header
**Response**: JSON with `voices` array
**Caching**: 24-hour TTL in chrome.storage.local
**Error Strategy**: Graceful fallback with user notifications
**Rate Limiting**: Minimized via caching
