# Quickstart Guide: Basic Extension Setup

**Feature**: Basic Extension Setup (Phase 1)
**Date**: 2025-10-17
**Target Audience**: Developers implementing Phase 1

## Overview

This quickstart guide provides step-by-step instructions for implementing Phase 1 of the ElevenLabs TTS Chrome Extension. Follow these steps to create a working Manifest V3 extension with popup UI and secure API key storage.

**Estimated Time**: 2-3 hours

**Prerequisites**:
- Chrome browser 88+ installed
- Text editor or IDE
- Basic knowledge of HTML, CSS, JavaScript
- Basic understanding of Chrome Extension architecture

## File Creation Order

Follow this order to minimize back-and-forth:

1. Create project structure
2. Implement manifest.json (defines extension)
3. Create popup.html (UI structure)
4. Style with popup.css (visual design)
5. Implement popup.js (logic and storage)
6. Add icon files
7. Test in Chrome

## Step 1: Project Structure

Create the following directory structure:

```bash
mkdir -p icons
touch manifest.json popup.html popup.js popup.css
```

**Expected Result**:
```
/
├── manifest.json
├── popup.html
├── popup.js
├── popup.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Step 2: manifest.json (Foundation)

Create `manifest.json` with Manifest V3 configuration:

```json
{
  "manifest_version": 3,
  "name": "ElevenLabs Reader",
  "version": "1.0.0",
  "description": "Convert text to speech using ElevenLabs AI voices",
  "permissions": ["storage"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "ElevenLabs Reader"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Key Points**:
- `manifest_version: 3` is NON-NEGOTIABLE (constitution requirement)
- Only `storage` permission requested (minimal permissions principle)
- No background scripts in Phase 1 (only popup)

**Test**: Load extension in chrome://extensions (will fail until popup.html exists, but validates JSON syntax)

## Step 3: popup.html (UI Structure)

Create `popup.html` with form structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ElevenLabs Reader Settings</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>ElevenLabs Reader</h1>
      <p id="status-message" class="status">Checking configuration...</p>
    </header>

    <main>
      <form id="api-key-form">
        <div class="form-group">
          <label for="api-key-input">API Key</label>
          <input
            type="text"
            id="api-key-input"
            placeholder="Enter your ElevenLabs API key"
            autocomplete="off"
            spellcheck="false"
          >
          <small class="help-text">
            Get your API key from
            <a href="https://elevenlabs.io/subscription" target="_blank">ElevenLabs</a>
          </small>
          <p id="error-message" class="error hidden"></p>
        </div>

        <div class="button-group">
          <button type="submit" id="save-button">Save API Key</button>
          <button type="button" id="clear-button" class="secondary">Clear</button>
        </div>
      </form>
    </main>

    <footer>
      <p class="version">Version 1.0.0</p>
    </footer>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

**Key Points**:
- No inline scripts (CSP compliance)
- External CSS and JS files
- Accessible form elements with labels
- Status message for configuration state
- Error message placeholder

**Test**: Load extension, click icon. Popup should open with unstyled form.

## Step 4: popup.css (Visual Design)

Create `popup.css` for clean, professional styling:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  background: #f5f5f5;
  width: 400px;
  min-height: 300px;
}

.container {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

header h1 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.status {
  font-size: 13px;
  color: #666;
  margin-bottom: 20px;
}

.status.configured {
  color: #22c55e;
}

.status.not-configured {
  color: #ef4444;
}

.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  font-weight: 500;
  margin-bottom: 6px;
  color: #374151;
}

input[type="text"] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  transition: border-color 0.2s;
}

input[type="text"]:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.help-text {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-top: 6px;
}

.help-text a {
  color: #3b82f6;
  text-decoration: none;
}

.help-text a:hover {
  text-decoration: underline;
}

.error {
  font-size: 13px;
  color: #ef4444;
  margin-top: 8px;
}

.hidden {
  display: none;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

button {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

button[type="submit"] {
  background-color: #3b82f6;
  color: white;
}

button[type="submit"]:hover {
  background-color: #2563eb;
}

button[type="submit"]:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

button.secondary {
  background-color: #e5e7eb;
  color: #374151;
}

button.secondary:hover {
  background-color: #d1d5db;
}

footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.version {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
}
```

**Test**: Popup should now have professional appearance with proper spacing and colors.

## Step 5: popup.js (Core Logic)

Create `popup.js` with storage and validation logic:

```javascript
// DOM element references
const form = document.getElementById('api-key-form');
const input = document.getElementById('api-key-input');
const saveButton = document.getElementById('save-button');
const clearButton = document.getElementById('clear-button');
const statusMessage = document.getElementById('status-message');
const errorMessage = document.getElementById('error-message');

// Constants
const STORAGE_KEY = 'elevenlabs_api_key_config';
const API_KEY_REGEX = /^[a-fA-F0-9]{32}$/;

// Initialize popup on load
document.addEventListener('DOMContentLoaded', () => {
  loadApiKey();
});

// Form submit handler
form.addEventListener('submit', (e) => {
  e.preventDefault();
  saveApiKey();
});

// Clear button handler
clearButton.addEventListener('click', () => {
  clearApiKey();
});

/**
 * Load API key from storage and update UI
 */
function loadApiKey() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (chrome.runtime.lastError) {
      showError('Failed to load API key: ' + chrome.runtime.lastError.message);
      updateStatus(false);
      return;
    }

    const config = result[STORAGE_KEY];
    if (config && config.apiKey) {
      input.value = maskApiKey(config.apiKey);
      updateStatus(true);
    } else {
      updateStatus(false);
    }
  });
}

/**
 * Save API key to storage
 */
function saveApiKey() {
  const apiKey = input.value.trim();

  // Validate API key format
  const validation = validateApiKey(apiKey);
  if (!validation.valid) {
    showError(validation.error);
    return;
  }

  // Create/update configuration object
  const config = {
    apiKey: validation.value,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Check if updating existing key (preserve createdAt)
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (result[STORAGE_KEY] && result[STORAGE_KEY].createdAt) {
      config.createdAt = result[STORAGE_KEY].createdAt;
    }

    // Save to storage
    chrome.storage.local.set({ [STORAGE_KEY]: config }, () => {
      if (chrome.runtime.lastError) {
        showError('Failed to save API key: ' + chrome.runtime.lastError.message);
        return;
      }

      // Update UI
      input.value = maskApiKey(config.apiKey);
      updateStatus(true);
      hideError();
    });
  });
}

/**
 * Clear API key from storage
 */
function clearApiKey() {
  chrome.storage.local.remove([STORAGE_KEY], () => {
    if (chrome.runtime.lastError) {
      showError('Failed to clear API key: ' + chrome.runtime.lastError.message);
      return;
    }

    input.value = '';
    updateStatus(false);
    hideError();
  });
}

/**
 * Validate API key format
 * @param {string} key - API key to validate
 * @returns {{valid: boolean, error?: string, value?: string}}
 */
function validateApiKey(key) {
  if (!key || key.length === 0) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  if (!API_KEY_REGEX.test(key)) {
    return {
      valid: false,
      error: 'Invalid API key format. Expected 32-character hexadecimal string.'
    };
  }

  return { valid: true, value: key };
}

/**
 * Mask API key for display (show last 4 characters)
 * @param {string} key - Full API key
 * @returns {string} Masked API key
 */
function maskApiKey(key) {
  if (!key || key.length < 4) return key;
  const lastFour = key.slice(-4);
  const dots = '•'.repeat(key.length - 4);
  return dots + lastFour;
}

/**
 * Update status message based on configuration state
 * @param {boolean} isConfigured - Whether API key is configured
 */
function updateStatus(isConfigured) {
  statusMessage.className = 'status ' + (isConfigured ? 'configured' : 'not-configured');
  statusMessage.textContent = isConfigured
    ? '✓ Configured and ready'
    : '⚠ API key required';
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.classList.add('hidden');
  errorMessage.textContent = '';
}
```

**Key Points**:
- Uses `chrome.storage.local` API (not localStorage)
- Validates API key format client-side
- Masks API key in UI (last 4 chars visible)
- Handles errors gracefully
- Clean separation of concerns (functions for each operation)

**Test**: Full functionality should work now. Try saving, clearing, and persistence.

## Step 6: Icon Files

Create or add icon files to `icons/` directory:

**Option 1: Placeholder Icons (Quick Testing)**
- Use any PNG images at correct sizes (16x16, 48x48, 128x128)
- Name them `icon16.png`, `icon48.png`, `icon128.png`
- Can use solid color squares for initial testing

**Option 2: Generate Icons (Production Quality)**
1. Use Figma, Canva, or online icon generator
2. Create design with "EL" text or speaker icon
3. Export at 16x16, 48x48, and 128x128 pixels
4. Save as PNG format

**Free Tools**:
- [Favicon.io](https://favicon.io/) - Text to icon generator
- [Figma](https://www.figma.com/) - Free design tool
- [Canva](https://www.canva.com/) - Icon templates

## Step 7: Testing Workflow

### Initial Load Test

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select your project directory
5. Verify: Extension appears in list without errors
6. Check: Extension icon appears in Chrome toolbar

### Functional Testing

Test each user story from specification:

**User Story 1: Install and Configure (P1)**
- [ ] Click extension icon → popup opens
- [ ] Popup displays "API key required" status
- [ ] Enter invalid API key → error message appears
- [ ] Enter valid API key (32 hex chars) → saves successfully
- [ ] Close and reopen popup → API key still present (masked)
- [ ] Status shows "Configured and ready"

**User Story 2: View Extension Status (P2)**
- [ ] With no API key: Status shows "API key required"
- [ ] With API key: Status shows "Configured and ready"
- [ ] Can update existing API key
- [ ] Can clear API key

**User Story 3: Visual Brand Recognition (P3)**
- [ ] Extension icon visible in toolbar
- [ ] Icons display correctly in chrome://extensions
- [ ] Popup UI is professional and clean

### Edge Case Testing

- [ ] API key with leading/trailing whitespace → trimmed before save
- [ ] Empty API key → validation error
- [ ] Whitespace-only API key → validation error
- [ ] Close Chrome, reopen, check persistence → API key remains
- [ ] Reload extension (click reload icon) → API key persists

### Browser Console Check

1. Open popup
2. Press F12 to open DevTools
3. Check Console tab for errors
4. Should see no errors or warnings

**Expected Console**: Empty (no errors)

## Troubleshooting

### Extension Won't Load

**Symptom**: Error when loading unpacked extension

**Solutions**:
- Verify `manifest.json` is valid JSON (use online validator)
- Check all file paths exist (popup.html, popup.js, popup.css, icons/)
- Ensure manifest_version is 3 (not 2)

### Popup Won't Open

**Symptom**: Clicking icon does nothing

**Solutions**:
- Check `default_popup` path in manifest.json matches actual file
- Open chrome://extensions and check for errors
- Look for errors in popup console (right-click icon → Inspect popup)

### Storage Not Persisting

**Symptom**: API key disappears after closing popup

**Solutions**:
- Verify using `chrome.storage.local` (not localStorage)
- Check storage permission in manifest.json
- Look for chrome.runtime.lastError in callbacks

### Validation Not Working

**Symptom**: Can save invalid API keys

**Solutions**:
- Check API_KEY_REGEX pattern
- Verify trim() is called on input
- Ensure validateApiKey() function is called before save

## Success Criteria Verification

After completing implementation, verify all success criteria:

- ✅ **SC-001**: Can install and configure within 2 minutes
- ✅ **SC-002**: Popup loads in < 1 second
- ✅ **SC-003**: API key persists across browser restarts
- ✅ **SC-004**: No manifest violations (check chrome://extensions for warnings)
- ✅ **SC-005**: Saving API key works first time without errors
- ✅ **SC-006**: No storage errors under normal operation
- ✅ **SC-007**: Extension icon clearly visible and recognizable
- ✅ **SC-008**: Validation feedback appears within 500ms

## Next Steps

After Phase 1 is complete and tested:

1. **Manual Testing**: Test on 3 different websites (per constitution)
2. **Phase 1 Completion**: Mark phase complete after all tests pass
3. **Phase 2 Planning**: Begin planning for text selection and context menu integration
4. **Git Commit**: Commit Phase 1 implementation with descriptive message

## Additional Resources

- [Chrome Extension Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [chrome.storage API Reference](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)
- Feature Specification: `specs/001-feature-name/spec.md`
- Data Model: `specs/001-feature-name/data-model.md`
- Storage Schema: `specs/001-feature-name/contracts/storage-schema.json`

## Appendix: Complete File Sizes

Estimated file sizes (actual may vary):

- `manifest.json`: ~300 bytes
- `popup.html`: ~1.2 KB
- `popup.js`: ~4 KB
- `popup.css`: ~2 KB
- `icon16.png`: ~1 KB
- `icon48.png`: ~4 KB
- `icon128.png`: ~10 KB

**Total**: ~22 KB (well under 5MB constraint)
