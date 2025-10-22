# Research: Voice Selection Feature

**Feature**: Voice Selection | **Date**: 2025-10-22 | **Phase**: 0 (Outline & Research)

## Research Questions

This document resolves all technical unknowns and researches best practices for implementing voice selection in the Chrome extension.

---

## 1. ElevenLabs Voices API

**Question**: What API endpoint and request format is needed to retrieve the list of available voices?

**Decision**: Use GET `/v1/voices` endpoint

**Rationale**:
- ElevenLabs API documentation specifies `/v1/voices` as the standard endpoint for retrieving available voices
- Returns JSON array of voice objects with id, name, labels (gender, accent, age), and other metadata
- No request body needed - simple GET request with API key in header
- Response includes preview_url for each voice (useful for future enhancements)

**Implementation Details**:
```javascript
// Request format
GET https://api.elevenlabs.io/v1/voices
Headers: {
  'xi-api-key': '<API_KEY>'
}

// Response format (simplified)
{
  "voices": [
    {
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "name": "Rachel",
      "labels": {
        "accent": "american",
        "description": "calm",
        "age": "young",
        "gender": "female"
      }
    },
    // ... more voices
  ]
}
```

**Alternatives Considered**:
- Using `/v1/models` endpoint: Rejected - returns AI models, not voices
- Hardcoding voice list: Rejected - voices change over time, new voices added regularly

---

## 2. Voice List Caching Strategy

**Question**: How should we cache the voice list to minimize API calls while keeping data fresh?

**Decision**: 24-hour cache with timestamp validation

**Rationale**:
- Voice list changes infrequently (new voices added monthly at most)
- 24-hour TTL balances freshness with API call efficiency
- Store in chrome.storage.local with structure: `{ voices: [], timestamp: Date.now(), ttl: 86400000 }`
- Check timestamp on popup open; fetch new list if cache expired
- Fallback to cache even if expired when API call fails (graceful degradation)

**Implementation Pattern**:
```javascript
// Cache structure
{
  voiceCache: {
    voices: [...],
    cachedAt: 1698234567890,
    ttl: 86400000  // 24 hours in milliseconds
  }
}

// Cache validation
function isCacheValid(cache) {
  if (!cache || !cache.cachedAt) return false;
  const age = Date.now() - cache.cachedAt;
  return age < cache.ttl;
}
```

**Alternatives Considered**:
- No caching: Rejected - unnecessary API calls every popup open
- 1-hour cache: Rejected - too short, still many API calls
- 7-day cache: Rejected - too long, users miss new voices
- localStorage: Rejected - chrome.storage.local is the Manifest V3 standard

---

## 3. Voice Preview Implementation

**Question**: How should voice previews be generated and played?

**Decision**: Generate preview using ElevenLabs TTS API with fixed sample text, play in offscreen document

**Rationale**:
- Reuse existing textToSpeech() function infrastructure
- Use short sample text: "Hello, this is a preview of this voice."
- Leverage existing offscreen audio player (already handles audio playback)
- Preview button sends message to background → background generates audio → sends to offscreen player
- Cancel any playing preview before starting new one (prevents overlapping audio)

**Sample Text Choice**: "Hello, this is a preview of this voice." (45 characters)
- Long enough to demonstrate voice characteristics
- Short enough to generate/play quickly (<1 second target)
- Generic enough to work for all voices

**Alternatives Considered**:
- Using ElevenLabs preview_url from API response: Rejected - preview URLs may not be available for all voices
- Playing preview in popup context: Rejected - popup may close before preview completes
- Custom preview text per voice: Rejected - adds complexity, sample text should be consistent

---

## 4. Voice Preference Storage

**Question**: What storage key and structure should be used for voice preference?

**Decision**: Use key `selectedVoiceId` in chrome.storage.local with simple string value

**Rationale**:
- Simple string storage (just the voice ID)
- Consistent with existing pattern (`playbackSpeed` for speed preference from feature 005)
- Easy to retrieve and validate
- No need for complex object structure
- Default to existing `DEFAULT_VOICE_ID` when preference not set

**Storage Pattern**:
```javascript
// Save
chrome.storage.local.set({ selectedVoiceId: 'voice_id_here' });

// Retrieve
const { selectedVoiceId } = await chrome.storage.local.get(['selectedVoiceId']);
const voiceId = selectedVoiceId || DEFAULT_VOICE_ID;
```

**Alternatives Considered**:
- Storing full voice object: Rejected - wastes storage, voice metadata already cached in voice list
- Using chrome.storage.sync: Rejected - voice preference is per-device (different audio setups)
- Nested in settings object: Rejected - keep preferences flat for easier access

---

## 5. Dropdown UI Implementation

**Question**: What HTML element and pattern should be used for the voice dropdown?

**Decision**: Use native `<select>` element with `<option>` elements

**Rationale**:
- Native HTML select element provides accessibility out of the box
- Works well for 10-50 options (expected voice count)
- Auto-save on 'change' event matches specification requirement
- Familiar UX pattern for users
- No additional libraries needed
- Proper keyboard navigation built-in

**HTML Structure**:
```html
<div class="form-group">
  <label for="voice-select">Voice</label>
  <select id="voice-select">
    <option value="voice_id_1">Rachel - Female, American</option>
    <option value="voice_id_2">Josh - Male, American</option>
    <!-- ... more options -->
  </select>
  <button type="button" id="preview-button">Preview Voice</button>
</div>
```

**Alternatives Considered**:
- Custom dropdown with divs: Rejected - poor accessibility, more code
- Radio buttons: Rejected - takes too much vertical space for 50+ options
- Searchable dropdown library: Rejected - adds dependency, overkill for this use case

---

## 6. Error Recovery and Fallback Strategy

**Question**: How should the system handle API failures and voice unavailability?

**Decision**: Auto-fallback to DEFAULT_VOICE_ID with non-blocking notification

**Rationale**:
- Aligns with clarification decision from spec (Q1: Option B)
- Never block text-to-speech playback due to voice issues
- Use existing toast notification system (from content.js) for user feedback
- Check if selectedVoiceId exists in voice list; if not, use DEFAULT_VOICE_ID
- Log errors to console for debugging

**Error Scenarios**:
1. **Voice list API fails**: Use cached list (even if expired), show notification "Using cached voice list"
2. **No cache available**: Show notification "Voice list unavailable, using default voice"
3. **Selected voice not in list**: Auto-switch to DEFAULT_VOICE_ID, show notification "Selected voice no longer available, switched to default"
4. **Preview generation fails**: Show error near preview button, don't block selection

**Implementation Pattern**:
```javascript
async function getSafeVoiceId() {
  const { selectedVoiceId } = await chrome.storage.local.get(['selectedVoiceId']);

  if (!selectedVoiceId) {
    return DEFAULT_VOICE_ID;
  }

  // Validate voice exists in available voices
  const voices = await getVoices();
  const voiceExists = voices.some(v => v.voice_id === selectedVoiceId);

  if (!voiceExists) {
    // Show notification about fallback
    showNotification('Selected voice unavailable, using default voice');
    return DEFAULT_VOICE_ID;
  }

  return selectedVoiceId;
}
```

**Alternatives Considered**:
- Blocking playback on voice errors: Rejected - poor UX, violates spec requirement
- Silent fallback without notification: Rejected - users should know when their selection changed
- Retry logic for API failures: Rejected - adds latency, cache provides better fallback

---

## 7. Integration with Existing Playback System

**Question**: How should voice selection integrate with the current textToSpeech flow?

**Decision**: Modify textToSpeech() to accept voiceId parameter with default, retrieve preference in background.js before API call

**Rationale**:
- Existing textToSpeech() in elevenlabs.js already supports voiceId parameter (defaulting to DEFAULT_VOICE_ID)
- Background.js context menu handler needs to retrieve selectedVoiceId before calling textToSpeech()
- Minimal changes to existing code
- Maintains backward compatibility (default voice if preference not set)

**Integration Points**:
1. **background.js** - Read voice preference when handling "read aloud" action
2. **elevenlabs.js** - No changes needed (already accepts voiceId)
3. **offscreen.js** - No changes needed (plays whatever audio is sent)

**Code Changes**:
```javascript
// In background.js (context menu handler)
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { selectedVoiceId } = await chrome.storage.local.get(['selectedVoiceId']);
  const voiceId = selectedVoiceId || DEFAULT_VOICE_ID;

  // ... existing text extraction logic ...

  const audioBlob = await textToSpeech(text, apiKey, voiceId);
  // ... existing playback logic ...
});
```

**Alternatives Considered**:
- Passing voice preference via message: Rejected - background.js should own preference retrieval
- Modifying textToSpeech signature: Rejected - already supports voiceId, no changes needed

---

## 8. Voice Dropdown Label Format

**Question**: How should voices be labeled in the dropdown for best UX?

**Decision**: Format as "Name - Gender, Accent" (e.g., "Rachel - Female, American")

**Rationale**:
- Provides essential information for voice selection decision
- Concise enough to fit in dropdown without truncation
- Name comes first (most important identifier)
- Gender and accent help narrow down preferences
- Matches example format in spec

**Label Generation**:
```javascript
function formatVoiceLabel(voice) {
  const name = voice.name;
  const gender = voice.labels?.gender || '';
  const accent = voice.labels?.accent || '';

  if (gender && accent) {
    return `${name} - ${capitalize(gender)}, ${capitalize(accent)}`;
  } else if (gender) {
    return `${name} - ${capitalize(gender)}`;
  }

  return name;
}
```

**Alternatives Considered**:
- Just name: Rejected - insufficient differentiation for similar voices
- Name + all labels (age, description): Rejected - too verbose, clutters dropdown
- Separate dropdowns for filters: Rejected - out of scope per spec

---

## Summary

All research questions resolved. Key decisions:
1. **API**: GET `/v1/voices` with API key header
2. **Caching**: 24-hour TTL in chrome.storage.local
3. **Preview**: ElevenLabs TTS API with fixed sample text, play in offscreen
4. **Storage**: Simple string key `selectedVoiceId`
5. **UI**: Native `<select>` element with formatted labels
6. **Errors**: Auto-fallback to DEFAULT_VOICE_ID with notifications
7. **Integration**: Modify background.js to retrieve preference, pass to existing textToSpeech()
8. **Labels**: "Name - Gender, Accent" format

Ready to proceed to Phase 1 (Design & Contracts).
