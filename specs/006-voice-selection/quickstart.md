# Quickstart: Voice Selection Feature

**Feature**: Voice Selection | **Date**: 2025-10-22 | **For**: Developers implementing this feature

## Overview

This guide provides a quick implementation path for the voice selection feature. Follow these steps in order to integrate voice selection into the ElevenLabs TTS Chrome extension.

**Estimated Time**: 2-3 hours

**Prerequisites**:
- Chrome extension already installed and functional
- ElevenLabs API key configured
- Familiarity with Chrome extension Manifest V3 APIs

---

## Step 1: Add Storage Utilities (15 min)

**File**: `src/utils/storage.js`

**Add these functions**:

```javascript
/**
 * Get selected voice ID from chrome.storage.local
 * @returns {Promise<string|null>}
 */
export async function getVoicePreference() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['selectedVoiceId'], (result) => {
      resolve(result.selectedVoiceId || null);
    });
  });
}

/**
 * Save selected voice ID to chrome.storage.local
 * @param {string} voiceId
 * @returns {Promise<void>}
 */
export async function setVoicePreference(voiceId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ selectedVoiceId: voiceId }, () => {
      resolve();
    });
  });
}

/**
 * Get cached voices from chrome.storage.local
 * @returns {Promise<object|null>} - Cache object or null if invalid
 */
export async function getVoiceCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['voiceCache'], (result) => {
      const cache = result.voiceCache;

      if (!cache || !cache.cachedAt || !Array.isArray(cache.voices)) {
        resolve(null);
        return;
      }

      // Check if cache is still valid (24 hours)
      const age = Date.now() - cache.cachedAt;
      const ttl = cache.ttl || 86400000; // 24 hours

      if (age < ttl) {
        resolve(cache);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Cache voices in chrome.storage.local
 * @param {Array} voices
 * @returns {Promise<void>}
 */
export async function setVoiceCache(voices) {
  return new Promise((resolve) => {
    const cache = {
      voices,
      cachedAt: Date.now(),
      ttl: 86400000 // 24 hours
    };

    chrome.storage.local.set({ voiceCache: cache }, () => {
      resolve();
    });
  });
}
```

**Test**: Run extension, check console for no errors

---

## Step 2: Add ElevenLabs Voices API Function (20 min)

**File**: `src/api/elevenlabs.js`

**Add this function**:

```javascript
/**
 * Get available voices from ElevenLabs API
 * @param {string} apiKey - The ElevenLabs API key
 * @returns {Promise<Array>} - Array of voice objects
 */
export async function getVoices(apiKey) {
  const url = `${API_BASE_URL}/voices`;

  const headers = {
    'xi-api-key': apiKey
  };

  try {
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
  } catch (error) {
    console.error('Failed to fetch voices:', error);
    throw error;
  }
}
```

**Test**: Call `getVoices(apiKey)` in browser console, verify array returned

---

## Step 3: Add Background Message Handlers (30 min)

**File**: `background.js`

**Import new functions**:

```javascript
import { getVoices } from './src/api/elevenlabs.js';
import { getVoiceCache, setVoiceCache, getVoicePreference } from './src/utils/storage.js';
```

**Add message handlers** (in existing `chrome.runtime.onMessage` listener):

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ... existing handlers ...

  if (request.action === 'GET_VOICES') {
    handleGetVoices(request, sendResponse);
    return true; // Keep channel open for async response
  }

  if (request.action === 'PREVIEW_VOICE') {
    handlePreviewVoice(request);
    return false;
  }

  // ... rest of existing handlers ...
});

/**
 * Handle GET_VOICES request
 */
async function handleGetVoices(request, sendResponse) {
  try {
    // Check cache first (unless force refresh requested)
    if (!request.forceRefresh) {
      const cache = await getVoiceCache();
      if (cache && cache.voices) {
        sendResponse({ success: true, voices: cache.voices });
        return;
      }
    }

    // Fetch from API
    const apiKey = await getApiKey();
    if (!apiKey) {
      sendResponse({ success: false, voices: [], error: 'API key not configured' });
      return;
    }

    const voices = await getVoices(apiKey);

    // Cache the result
    await setVoiceCache(voices);

    sendResponse({ success: true, voices });
  } catch (error) {
    console.error('Failed to get voices:', error);

    // Try to use stale cache as fallback
    const cache = await getVoiceCache();
    if (cache && cache.voices) {
      console.log('Using stale cache as fallback');
      sendResponse({ success: true, voices: cache.voices });
    } else {
      sendResponse({ success: false, voices: [], error: error.message });
    }
  }
}

/**
 * Handle PREVIEW_VOICE request
 */
async function handlePreviewVoice(request) {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error('API key not configured');
      return;
    }

    const { voiceId, sampleText } = request;
    const audioBlob = await textToSpeech(sampleText, apiKey, voiceId);

    // Send to offscreen for playback
    await chrome.runtime.sendMessage({
      action: 'PLAY_PREVIEW',
      audioUrl: URL.createObjectURL(audioBlob)
    });
  } catch (error) {
    console.error('Preview generation failed:', error);
  }
}
```

**Modify existing playback handler** to use selected voice:

```javascript
// In existing context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // ... existing code ...

  // Get selected voice preference
  const selectedVoiceId = await getVoicePreference();
  const voiceId = selectedVoiceId || DEFAULT_VOICE_ID;

  // Pass voiceId to textToSpeech
  const audioBlob = await textToSpeech(text, apiKey, voiceId);

  // ... rest of existing playback code ...
});
```

**Test**: Open background service worker console, verify messages handled

---

## Step 4: Add Offscreen Preview Handler (15 min)

**File**: `offscreen.js`

**Add handler** (in existing `chrome.runtime.onMessage` listener):

```javascript
chrome.runtime.onMessage.addListener((request) => {
  // ... existing handlers ...

  if (request.action === 'PLAY_PREVIEW') {
    playPreview(request.audioUrl);
    return;
  }

  // ... rest of existing handlers ...
});

/**
 * Play preview audio
 */
function playPreview(audioUrl) {
  // Stop any existing playback first
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
  }

  // Create new audio element
  audioElement = new Audio(audioUrl);

  audioElement.play().catch(error => {
    console.error('Preview playback failed:', error);
  });

  audioElement.onended = () => {
    URL.revokeObjectURL(audioUrl);
  };
}
```

**Test**: Send PLAY_PREVIEW message from console, verify audio plays

---

## Step 5: Update Popup HTML (10 min)

**File**: `popup.html`

**Add voice selector** (after API key form, before footer):

```html
<div class="form-group">
  <label for="voice-select">Voice</label>
  <div class="voice-controls">
    <select id="voice-select" disabled>
      <option value="">Loading voices...</option>
    </select>
    <button type="button" id="preview-button" class="secondary" disabled>
      Preview
    </button>
  </div>
  <p id="voice-error" class="error hidden"></p>
</div>
```

**Test**: Open popup, verify HTML renders correctly

---

## Step 6: Update Popup CSS (10 min)

**File**: `popup.css`

**Add styles**:

```css
.voice-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.voice-controls select {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.voice-controls select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.voice-controls button {
  padding: 8px 16px;
  white-space: nowrap;
}

#voice-error {
  margin-top: 4px;
  font-size: 12px;
}
```

**Test**: Open popup, verify styles applied

---

## Step 7: Add Popup JavaScript Logic (40 min)

**File**: `popup.js`

**Add initialization code**:

```javascript
// Voice selection elements
const voiceSelect = document.getElementById('voice-select');
const previewButton = document.getElementById('preview-button');
const voiceError = document.getElementById('voice-error');

/**
 * Initialize voice selector
 */
async function initializeVoiceSelector() {
  try {
    // Request voices from background
    const response = await chrome.runtime.sendMessage({
      action: 'GET_VOICES',
      forceRefresh: false
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to load voices');
    }

    populateVoiceDropdown(response.voices);
    await loadSelectedVoice();

    // Enable controls
    voiceSelect.disabled = false;
    previewButton.disabled = false;

    // Hide error if previously shown
    voiceError.classList.add('hidden');
  } catch (error) {
    console.error('Failed to initialize voice selector:', error);
    voiceError.textContent = 'Failed to load voices. Using default voice.';
    voiceError.classList.remove('hidden');
  }
}

/**
 * Populate voice dropdown with options
 */
function populateVoiceDropdown(voices) {
  // Clear existing options
  voiceSelect.innerHTML = '';

  // Add options for each voice
  voices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.voice_id;
    option.textContent = formatVoiceLabel(voice);
    voiceSelect.appendChild(option);
  });
}

/**
 * Format voice label for dropdown
 */
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

/**
 * Load and set selected voice in dropdown
 */
async function loadSelectedVoice() {
  const result = await chrome.storage.local.get(['selectedVoiceId']);
  const selectedVoiceId = result.selectedVoiceId;

  if (selectedVoiceId) {
    voiceSelect.value = selectedVoiceId;
  }
}

/**
 * Save voice selection
 */
async function saveVoiceSelection() {
  const voiceId = voiceSelect.value;

  await chrome.storage.local.set({ selectedVoiceId: voiceId });
  console.log('Voice preference saved:', voiceId);
}

/**
 * Preview selected voice
 */
function previewVoice() {
  const voiceId = voiceSelect.value;

  if (!voiceId) {
    return;
  }

  chrome.runtime.sendMessage({
    action: 'PREVIEW_VOICE',
    voiceId: voiceId,
    sampleText: 'Hello, this is a preview of this voice.'
  });
}

// Event listeners
voiceSelect.addEventListener('change', saveVoiceSelection);
previewButton.addEventListener('click', previewVoice);

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // ... existing initialization code ...

  // Initialize voice selector after API key check
  initializeVoiceSelector();
});
```

**Test**: Open popup, verify dropdown populates and selection saves

---

## Step 8: Test End-to-End (20 min)

### Test Checklist

- [ ] **Load Extension**: Open chrome://extensions, verify no console errors
- [ ] **Popup Opens**: Click extension icon, popup displays correctly
- [ ] **Voices Load**: Dropdown populates with voice options
- [ ] **Selection Persists**: Select voice, close popup, reopen → selection remembered
- [ ] **Preview Works**: Click preview button, hear sample audio in selected voice
- [ ] **Playback Uses Voice**: Select text, use "Read Aloud" → hears selected voice
- [ ] **Change Voice**: Change selection, trigger playback → hears new voice
- [ ] **Cache Works**: Close browser, reopen within 24 hours → voices load from cache (fast)
- [ ] **Fallback Works**: Disconnect network, open popup → uses cached voices
- [ ] **Default Voice**: Don't select any voice → playback uses Brian (default)

### Manual Testing Steps

1. **Initial Load**:
   ```
   - Open extension popup
   - Verify "Loading voices..." appears briefly
   - Verify dropdown populates with ~30-50 voices
   ```

2. **Voice Selection**:
   ```
   - Select "Rachel - Female, American"
   - Click "Preview" button
   - Hear: "Hello, this is a preview of this voice."
   - Close and reopen popup
   - Verify "Rachel" still selected
   ```

3. **Playback Integration**:
   ```
   - Go to any website
   - Select some text
   - Right-click → "Read Aloud with ElevenLabs"
   - Hear text read in Rachel's voice
   ```

4. **Voice Change**:
   ```
   - Open popup
   - Change to "Josh - Male, American"
   - Click "Preview" → hear male voice
   - Select text and trigger "Read Aloud"
   - Hear text in Josh's voice
   ```

5. **Cache Validation**:
   ```
   - Open popup (voices load from API - may take 1-2 sec)
   - Close popup
   - Immediately reopen popup (voices load from cache - instant)
   ```

6. **Error Handling**:
   ```
   - Disconnect network
   - Open popup
   - Verify uses cached voices (if cache exists)
   - If no cache, see error message
   ```

---

## Common Issues & Solutions

### Issue: Dropdown shows "Loading voices..." indefinitely

**Solution**: Check background service worker console for errors. Verify API key is set.

### Issue: Preview button does nothing

**Solution**: Check offscreen console for errors. Verify PLAY_PREVIEW handler added.

### Issue: Selected voice not used in playback

**Solution**: Verify background.js retrieves selectedVoiceId before calling textToSpeech().

### Issue: Voices don't load after 24 hours

**Solution**: Cache expired (expected). Verify API call succeeds and cache updates.

### Issue: Console error "chrome.storage.local is undefined"

**Solution**: Verify "storage" permission in manifest.json.

---

## Next Steps

After successful testing:

1. Run `/speckit.tasks` to generate task breakdown
2. Implement tasks in order
3. Test each task completion
4. Create pull request for review

---

## Quick Reference

**Key Files Modified**:
- `src/utils/storage.js` - Add 4 functions
- `src/api/elevenlabs.js` - Add 1 function
- `background.js` - Add 2 message handlers, modify playback handler
- `offscreen.js` - Add 1 preview handler
- `popup.html` - Add voice selector UI
- `popup.css` - Add voice selector styles
- `popup.js` - Add voice initialization and event handlers

**Key Storage Keys**:
- `selectedVoiceId` - User's voice preference
- `voiceCache` - Cached voice list with 24-hour TTL

**Key Messages**:
- `GET_VOICES` - Popup → Background (get voice list)
- `PREVIEW_VOICE` - Popup → Background (preview voice)
- `PLAY_PREVIEW` - Background → Offscreen (play preview audio)

**Default Voice**: `nPczCjzI2devNBz1zQrb` (Brian) - from elevenlabs.js

---

## Summary

**Total Estimated Time**: 2-3 hours

**Files Modified**: 7
**Functions Added**: ~15
**Lines of Code**: ~250

This quickstart provides a streamlined implementation path. For detailed design decisions, see `research.md`. For data structures, see `data-model.md`. For API contracts, see `contracts/elevenlabs-voices-api.md`.
