# Quickstart Guide: Text Selection and Context Menu Integration

**Feature**: Phase 2 - Text Selection and Context Menu Integration
**Date**: 2025-10-17
**Status**: Complete
**Related**: [spec.md](./spec.md) | [plan.md](./plan.md) | [research.md](./research.md) | [data-model.md](./data-model.md)

## Overview

This quickstart guide provides step-by-step instructions for implementing Phase 2 of the ElevenLabs TTS Chrome Extension. Follow these steps in order to build the text selection and context menu integration feature from scratch.

**Estimated Time**: 2-3 hours for experienced developer, 4-6 hours for beginner

**Prerequisites**:
- Phase 1 completed (basic extension setup, manifest.json, popup UI, API key storage)
- Chrome 88+ installed
- Code editor (VS Code, Sublime, etc.)
- Basic understanding of JavaScript ES2020+, Chrome Extension APIs

---

## Step 1: Update manifest.json

**Time**: 5 minutes

Add the new permissions, background service worker, and content script configuration to your existing `manifest.json`.

**File**: `/manifest.json` (at repository root)

**Changes to make**:

1. Update version from `1.0.0` to `1.1.0`
2. Add new permissions: `contextMenus`, `activeTab`, `scripting`
3. Add background service worker
4. Add content scripts configuration

**Updated manifest.json**:

```json
{
  "manifest_version": 3,
  "name": "ElevenLabs TTS Reader",
  "version": "1.1.0",
  "description": "Convert selected text to speech using ElevenLabs API",
  "permissions": [
    "storage",
    "contextMenus",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "http://*/*",
    "https://*/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["toast.css"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**What changed**:
- Added `"contextMenus"` permission (for right-click menu)
- Added `"activeTab"` permission (for accessing current tab)
- Added `"scripting"` permission (for content script injection)
- Added `host_permissions` for all HTTP/HTTPS pages
- Added `background.service_worker` pointing to `background.js`
- Added `content_scripts` configuration to inject `content.js` and `toast.css`

**Validation**:
- JSON is valid (no syntax errors)
- All required fields are present
- Version is updated to 1.1.0

---

## Step 2: Create background.js (Service Worker)

**Time**: 20-30 minutes

Create the background service worker that manages the context menu and handles message passing.

**File**: `/background.js` (create new file at repository root)

**Full code**:

```javascript
// background.js - Background Service Worker for ElevenLabs TTS Chrome Extension
// Handles context menu creation, message passing, and captured text storage

// In-memory cache for captured text (fast access during active period)
let capturedTextCache = null;

// Initialize extension: create context menu
chrome.runtime.onInstalled.addListener(() => {
  console.log('ElevenLabs TTS Extension installed/updated');

  // Create context menu item (appears when text is selected)
  chrome.contextMenus.create({
    id: 'read-with-elevenlabs',
    title: 'Read with ElevenLabs',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'read-with-elevenlabs') {
    console.log('Context menu clicked, sending CAPTURE_TEXT message to tab:', tab.id);

    // Send message to content script to capture selected text
    chrome.tabs.sendMessage(tab.id, {
      type: 'CAPTURE_TEXT',
      payload: null,
      timestamp: Date.now()
    }).catch(error => {
      console.error('Failed to send CAPTURE_TEXT message:', error);
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type, 'from tab:', sender.tab?.id);

  if (message.type === 'TEXT_CAPTURED') {
    handleTextCaptured(message.payload, sender.tab.id);
    sendResponse({ success: true });
  }

  // Return true to indicate we'll call sendResponse asynchronously (if needed)
  // Not strictly necessary for synchronous handlers, but good practice
  return false;
});

// Handle captured text from content script
async function handleTextCaptured(payload, tabId) {
  const { text, url, length } = payload;

  console.log(`Text captured from ${url}: ${length} characters`);
  console.log('Text preview:', text.substring(0, 100));

  // Store in in-memory cache
  capturedTextCache = {
    text: text,
    url: url,
    length: length,
    timestamp: Date.now()
  };

  // Persist to session storage (survives service worker restarts)
  try {
    await chrome.storage.session.set({
      lastCapturedText: capturedTextCache
    });
    console.log('Captured text stored in session storage');
  } catch (error) {
    console.error('Failed to store captured text:', error);
  }

  // Determine toast message and type
  let toastMessage;
  let toastType;

  if (length > 5000) {
    // Warning for very long text
    toastMessage = `Text is very long (${length.toLocaleString()} chars), this may take a while`;
    toastType = 'warning';
  } else {
    // Success message with text preview (first 30 chars)
    const preview = text.substring(0, 30);
    const suffix = text.length > 30 ? '...' : '';
    toastMessage = `Text captured: ${preview}${suffix}`;
    toastType = 'success';
  }

  // Send message to content script to show toast
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_TOAST',
      payload: {
        message: toastMessage,
        type: toastType
      },
      timestamp: Date.now()
    });
    console.log('Toast notification sent to content script');
  } catch (error) {
    console.error('Failed to send SHOW_TOAST message:', error);
  }
}

// Retrieve captured text (for Phase 3 API integration)
async function getCapturedText() {
  // Check in-memory cache first (fast)
  if (capturedTextCache) {
    return capturedTextCache;
  }

  // Fallback to session storage (if service worker restarted)
  try {
    const result = await chrome.storage.session.get(['lastCapturedText']);
    capturedTextCache = result.lastCapturedText || null;
    return capturedTextCache;
  } catch (error) {
    console.error('Failed to retrieve captured text:', error);
    return null;
  }
}

// Service worker startup log
console.log('Background service worker started');
```

**Key implementation points**:

1. **chrome.runtime.onInstalled**: Creates context menu when extension installs/updates
2. **chrome.contextMenus.onClicked**: Listens for context menu clicks, sends CAPTURE_TEXT message to content script
3. **chrome.runtime.onMessage**: Listens for TEXT_CAPTURED messages from content script
4. **handleTextCaptured**: Stores text in memory and chrome.storage.session, sends SHOW_TOAST message back to content script
5. **getCapturedText**: Helper function for Phase 3 (retrieves stored text)

**Testing checklist** (after completing all steps):
- [ ] Context menu appears when text is selected
- [ ] Clicking menu triggers message to content script
- [ ] Service worker logs appear in extension DevTools
- [ ] No console errors

---

## Step 3: Create content.js (Content Script)

**Time**: 30-40 minutes

Create the content script that captures selected text and displays toast notifications.

**File**: `/content.js` (create new file at repository root)

**Full code**:

```javascript
// content.js - Content Script for ElevenLabs TTS Chrome Extension
// Captures selected text and displays toast notifications

console.log('ElevenLabs TTS content script loaded');

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.type);

  if (message.type === 'CAPTURE_TEXT') {
    captureSelectedText();
  } else if (message.type === 'SHOW_TOAST') {
    showToast(message.payload);
  }

  // Acknowledge message receipt
  sendResponse({ success: true });
  return false; // Synchronous response
});

// Capture currently selected text
function captureSelectedText() {
  try {
    // Get current selection
    const selection = window.getSelection();
    const text = selection.toString();

    // Validate text
    if (!text || text.trim().length === 0) {
      console.warn('No text selected or text is empty');
      showToast({
        message: 'No text selected',
        type: 'error'
      });
      return;
    }

    // Trim whitespace
    const trimmedText = text.trim();

    // Get current page URL
    const url = window.location.href;

    console.log(`Captured ${trimmedText.length} characters from ${url}`);

    // Send captured text to background service worker
    chrome.runtime.sendMessage({
      type: 'TEXT_CAPTURED',
      payload: {
        text: trimmedText,
        url: url,
        length: trimmedText.length
      },
      timestamp: Date.now()
    }).then(response => {
      console.log('Text capture acknowledged by service worker:', response);
    }).catch(error => {
      console.error('Failed to send TEXT_CAPTURED message:', error);
      showToast({
        message: 'Failed to capture text. Please try again.',
        type: 'error'
      });
    });

  } catch (error) {
    console.error('Error capturing text:', error);
    showToast({
      message: 'Error capturing text. Please try again.',
      type: 'error'
    });
  }
}

// Show toast notification
function showToast(config) {
  const { message, type = 'success' } = config;

  // Validate message
  if (!message || message.trim().length === 0) {
    console.error('Toast message is required');
    return;
  }

  // Check if document.body is available
  if (!document.body) {
    console.error('Cannot show toast: document.body is not available');
    return;
  }

  try {
    // Create host element for shadow DOM
    const container = document.createElement('div');
    container.className = 'elevenlabs-tts-toast-host';

    // Attach shadow root in closed mode (prevents page JS access)
    const shadow = container.attachShadow({ mode: 'closed' });

    // Determine background color based on type
    let backgroundColor;
    if (type === 'success') {
      backgroundColor = '#10b981'; // Green
    } else if (type === 'warning') {
      backgroundColor = '#f59e0b'; // Yellow
    } else if (type === 'error') {
      backgroundColor = '#ef4444'; // Red
    } else {
      backgroundColor = '#10b981'; // Default to green
    }

    // HTML-escape the message to prevent XSS
    const escapedMessage = escapeHtml(message);

    // Inject styles and content into shadow root
    shadow.innerHTML = `
      <style>
        .toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: ${backgroundColor};
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 2147483647;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          font-weight: 500;
          max-width: 400px;
          word-wrap: break-word;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      </style>
      <div class="toast" role="alert" aria-live="polite">
        ${escapedMessage}
      </div>
    `;

    // Append to page
    document.body.appendChild(container);

    console.log('Toast displayed:', message);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      container.remove();
      console.log('Toast removed');
    }, 3000);

  } catch (error) {
    console.error('Error showing toast:', error);
  }
}

// HTML escape utility to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

**Key implementation points**:

1. **chrome.runtime.onMessage**: Listens for CAPTURE_TEXT and SHOW_TOAST messages
2. **captureSelectedText**: Gets window.getSelection(), validates, trims, sends to service worker
3. **showToast**: Creates Shadow DOM, injects styles, displays toast for 3 seconds
4. **escapeHtml**: Prevents XSS by HTML-escaping toast message

**Testing checklist** (after completing all steps):
- [ ] Selected text is captured correctly
- [ ] Toast appears after clicking context menu
- [ ] Toast auto-removes after 3 seconds
- [ ] Content script logs appear in page DevTools (not extension DevTools!)

---

## Step 4: Create toast.css

**Time**: 10 minutes

Create the CSS file for toast notifications. This file will be injected via manifest.json but is also embedded inline in the Shadow DOM for complete isolation.

**File**: `/toast.css` (create new file at repository root)

**Full code**:

```css
/* toast.css - Toast Notification Styles for ElevenLabs TTS Chrome Extension */
/* Note: These styles are also embedded inline in content.js Shadow DOM */
/* This file is here for organization and potential future external injection */

/* Base toast styles */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 16px 24px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 2147483647; /* Max z-index to appear above all content */

  /* Typography */
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  color: white;

  /* Layout */
  max-width: 400px;
  word-wrap: break-word;

  /* Animation */
  animation: slideIn 0.3s ease-out;
}

/* Toast type variants */
.toast.success {
  background: #10b981; /* Tailwind green-500 */
}

.toast.warning {
  background: #f59e0b; /* Tailwind yellow-500 */
}

.toast.error {
  background: #ef4444; /* Tailwind red-500 */
}

/* Slide-in animation */
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Accessibility: Focus outline for keyboard navigation (future enhancement) */
.toast:focus {
  outline: 2px solid white;
  outline-offset: 2px;
}
```

**Note**: In Phase 2, these styles are embedded inline in `content.js` within the Shadow DOM for maximum isolation. This separate file exists for organization and future use.

**Key styling points**:
- Fixed positioning in top-right corner
- Maximum z-index ensures visibility above all page content
- System font stack for consistent appearance
- Smooth slide-in animation
- Color variants for success, warning, error types

---

## Step 5: Load Extension in Chrome

**Time**: 5 minutes

Load the updated extension in Chrome to test Phase 2 functionality.

**Steps**:

1. **Open Chrome Extensions Page**:
   - Navigate to `chrome://extensions/`
   - Or: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**:
   - Toggle "Developer mode" switch in top-right corner

3. **Reload Extension** (if already loaded from Phase 1):
   - Find your extension in the list
   - Click the reload icon (🔄) button
   - This reloads the updated manifest.json and new files

   **OR Load Unpacked** (if not already loaded):
   - Click "Load unpacked" button
   - Navigate to your extension directory (repository root)
   - Select the folder containing manifest.json
   - Click "Select Folder"

4. **Verify Extension Loaded**:
   - Extension should appear in the list with version 1.1.0
   - No errors should be shown
   - Extension icon should appear in Chrome toolbar

5. **Check Permissions**:
   - Click "Details" on your extension
   - Scroll to "Permissions" section
   - Verify permissions include: Storage, Context Menus, Access active tab, and host permissions for all sites

**Troubleshooting**:
- **Error: "Manifest file is missing or unreadable"**: Check that manifest.json is in the selected folder and has valid JSON syntax
- **Error: "Could not load background script"**: Check that background.js exists and has no syntax errors
- **Error: "Could not load content script"**: Check that content.js exists and has no syntax errors
- **Warning about permissions**: Click "Accept" to grant new permissions (contextMenus, activeTab, scripting)

---

## Step 6: Test Basic Functionality

**Time**: 10-15 minutes

Test that the extension works on a simple web page.

**Test 1: Context Menu Appears**

1. Open a new tab
2. Navigate to any website (e.g., https://example.com)
3. Select some text on the page (click and drag)
4. Right-click on the selected text
5. **Expected**: Context menu appears with "Read with ElevenLabs" option near the bottom

**Test 2: Toast Notification Shows**

1. With text still selected, click "Read with ElevenLabs" in context menu
2. **Expected**:
   - Green toast appears in top-right corner
   - Toast shows message: "Text captured: [first 30 chars]..."
   - Toast automatically disappears after 3 seconds

**Test 3: Console Logs**

1. Open Chrome DevTools (F12 or Right-click → Inspect)
2. **For Service Worker Logs**:
   - Go to `chrome://extensions/`
   - Find your extension
   - Click "service worker" link (it may say "Inspect views: service worker")
   - This opens DevTools for the service worker
   - Expected logs:
     ```
     Background service worker started
     ElevenLabs TTS Extension installed/updated
     Context menu clicked, sending CAPTURE_TEXT message to tab: <ID>
     Received message: TEXT_CAPTURED from tab: <ID>
     Text captured from https://example.com: XX characters
     Captured text stored in session storage
     Toast notification sent to content script
     ```

3. **For Content Script Logs**:
   - Open DevTools on the test page (F12)
   - Go to Console tab
   - Expected logs:
     ```
     ElevenLabs TTS content script loaded
     Content script received message: CAPTURE_TEXT
     Captured XX characters from https://example.com
     Text capture acknowledged by service worker: {success: true}
     Content script received message: SHOW_TOAST
     Toast displayed: Text captured: ...
     Toast removed
     ```

**Test 4: Storage Verification**

1. In service worker DevTools console (from Test 3), run:
   ```javascript
   chrome.storage.session.get(['lastCapturedText'], (result) => {
     console.log(result);
   });
   ```
2. **Expected**: Console shows object with lastCapturedText containing your selected text

**Pass Criteria**:
- ✅ Context menu appears only when text is selected
- ✅ Context menu does NOT appear when no text is selected
- ✅ Toast appears within 1 second of clicking menu item
- ✅ Toast auto-removes after ~3 seconds
- ✅ No console errors in either DevTools
- ✅ Storage contains captured text

---

## Step 7: Test on Multiple Websites

**Time**: 20-30 minutes

Test the extension on various websites to ensure compatibility.

**Test Sites** (test at least 5):

1. **Static Content Sites**:
   - https://example.com
   - https://wikipedia.org (article page)
   - https://news.ycombinator.com

2. **Rich Text / Dynamic Sites**:
   - https://medium.com (any article)
   - https://reddit.com (comments section)
   - https://twitter.com (tweet text)

3. **Web Apps**:
   - https://docs.google.com (create a test document)
   - https://github.com (README content)
   - https://stackoverflow.com (question/answer)

**For Each Site**:

1. Navigate to the site
2. Select text (try different types: headlines, paragraphs, code blocks)
3. Right-click and select "Read with ElevenLabs"
4. Verify toast appears and shows correct preview
5. Check console for errors (F12)

**Edge Cases to Test**:

- **Short text**: Select 1-2 words
  - Expected: Toast shows full text (no ellipsis)

- **Long text**: Select 100+ words (multiple paragraphs)
  - Expected: Toast shows "Text captured: [first 30 chars]..."

- **Very long text**: Copy a large article (5,000+ characters)
  - Expected: Toast shows warning "Text is very long (X chars), this may take a while"

- **Special characters**: Select text with emojis, unicode (e.g., "Hello 世界! 🌍")
  - Expected: Toast displays correctly, no garbled characters

- **Text with line breaks**: Select multiple paragraphs
  - Expected: Toast shows first 30 chars of first line

**Success Criteria**:
- ✅ Works on at least 5 different websites
- ✅ No console errors on any site
- ✅ Toast appears correctly on all sites (not hidden, not mispositioned)
- ✅ Text capture works for all tested edge cases

---

## Step 8: Test Service Worker Lifecycle

**Time**: 10 minutes

Verify that the service worker wakes properly and state persists across restarts.

**Test 1: Service Worker Termination and Wake**

1. Open service worker DevTools (chrome://extensions/ → service worker link)
2. In the service worker DevTools, click "Terminate" button (or wait 30 seconds of inactivity)
3. Service worker should show as "inactive" on chrome://extensions/
4. Go to any website and select text
5. Right-click and select "Read with ElevenLabs"
6. **Expected**:
   - Service worker automatically wakes (shows as "active")
   - Context menu click is handled
   - Toast appears normally
   - No errors

**Test 2: State Persistence**

1. Capture some text using the extension
2. Verify in service worker console that text is stored:
   ```javascript
   chrome.storage.session.get(['lastCapturedText'], console.log);
   ```
3. Terminate service worker (click "Terminate" in DevTools)
4. In service worker console (which reconnects), retrieve stored text:
   ```javascript
   chrome.storage.session.get(['lastCapturedText'], console.log);
   ```
5. **Expected**: Text is still present (not lost on service worker restart)

**Success Criteria**:
- ✅ Service worker wakes automatically on context menu click
- ✅ Captured text survives service worker termination
- ✅ No errors during wake/termination cycles

---

## Step 9: Performance Validation

**Time**: 15 minutes

Ensure the extension meets performance requirements from the specification.

**Test 1: Page Load Impact**

1. Open Chrome DevTools
2. Go to Performance tab
3. Click "Record" (circle icon)
4. Navigate to https://example.com
5. Wait for page to fully load
6. Stop recording
7. Note the page load time
8. Disable the extension (chrome://extensions/ → toggle off)
9. Repeat steps 2-7
10. Compare load times

**Expected**: Extension adds <50ms to page load time

**Test 2: Memory Usage**

1. Open Chrome Task Manager (Menu → More tools → Task Manager)
2. Find your extension in the list (both "Extension: ElevenLabs TTS Reader" entries)
3. Note memory usage for:
   - Background service worker (should be <2MB)
   - Content script (one per tab, should be <5MB per tab)

**Test 3: Context Menu Response Time**

1. Select text on a page
2. Right-click to open context menu
3. Note how quickly menu appears
4. Click "Read with ElevenLabs"
5. Note how quickly toast appears

**Expected**:
- Context menu appears within 100ms of right-click
- Toast appears within 200ms of menu click

**Success Criteria**:
- ✅ Page load impact <50ms
- ✅ Memory usage: service worker <2MB, content script <5MB per tab
- ✅ Context menu appears within 100ms
- ✅ Toast appears within 200ms

---

## Common Issues and Solutions

### Issue 1: Context Menu Doesn't Appear

**Symptoms**: Right-clicking on selected text shows browser's default context menu, but "Read with ElevenLabs" option is missing.

**Possible Causes**:
1. Extension not loaded properly
2. Content script failed to inject
3. Context menu not created in background.js

**Solutions**:
1. Check chrome://extensions/ → verify extension is enabled and shows no errors
2. Open service worker DevTools → check console for context menu creation log
3. Reload extension (click reload icon on chrome://extensions/)
4. Check manifest.json has correct permissions: `contextMenus`, `activeTab`
5. Verify background.js has `chrome.contextMenus.create()` in `onInstalled` listener

### Issue 2: Toast Doesn't Appear

**Symptoms**: Context menu appears and clicking it does nothing, or toast appears but is invisible.

**Possible Causes**:
1. Content script not receiving message from service worker
2. Shadow DOM creation failed
3. Toast z-index too low (hidden behind page content)

**Solutions**:
1. Open page DevTools (F12) → Console tab → check for content script logs
2. Look for error: "Cannot show toast: document.body is not available" → wait for page to load
3. Check shadow DOM is created: Inspect page → Elements tab → look for `.elevenlabs-tts-toast-host` div
4. Verify toast.css z-index is 2147483647
5. Test on simpler page (example.com) to rule out page-specific CSS conflicts

### Issue 3: "Receiving end does not exist" Error

**Symptoms**: Console shows error: `Error: Could not establish connection. Receiving end does not exist.`

**Possible Causes**:
1. Service worker terminated and didn't wake properly
2. Content script not injected on the page
3. Tab ID mismatch

**Solutions**:
1. Reload extension (chrome://extensions/)
2. Reload the test page (F5)
3. Check manifest.json has correct `content_scripts` configuration
4. Verify page URL matches patterns in manifest (`http://*/*` or `https://*/*`)
5. Some pages block extensions (chrome://, chrome-extension://) - test on regular website

### Issue 4: Selected Text Not Captured Correctly

**Symptoms**: Toast shows but text is empty, truncated, or garbled.

**Possible Causes**:
1. window.getSelection() returned empty selection
2. Text contains special characters not handled properly
3. Selection lost before capture

**Solutions**:
1. Check console logs in page DevTools → verify text length is >0
2. Verify `captureSelectedText()` trims whitespace: `text.trim()`
3. Test with simple ASCII text first, then test Unicode
4. Ensure text is selected when clicking context menu (don't deselect before clicking)

### Issue 5: Service Worker Keeps Terminating

**Symptoms**: Service worker DevTools shows "inactive" frequently, messages fail.

**Possible Causes**:
1. This is normal behavior! Service workers terminate after 30 seconds of inactivity
2. Event listeners not registered at top level

**Solutions**:
1. This is expected - service worker should wake automatically on events
2. Verify listeners are registered synchronously at top level (not in async functions)
3. Use chrome.storage.session to persist state across restarts
4. Don't try to keep service worker alive with setInterval (anti-pattern)

### Issue 6: Extension Works on Some Sites But Not Others

**Symptoms**: Extension works on example.com but fails on other sites.

**Possible Causes**:
1. Content Security Policy (CSP) blocking extension
2. Shadow DOM not supported (unlikely on modern browsers)
3. Page JavaScript interfering with text selection

**Solutions**:
1. Check console for CSP errors: `Refused to load...`
2. Verify Shadow DOM support: `document.createElement('div').attachShadow` should exist
3. Test on sites with known strict CSP: GitHub, banking sites
4. Document incompatible sites (this is acceptable for some high-security sites)

---

## Verification Checklist

Before marking Phase 2 as complete, verify all requirements are met:

**Functional Requirements (FR)**:
- [ ] FR-001: Content script injects on all HTTP/HTTPS pages
- [ ] FR-002: Context menu appears only when text is selected
- [ ] FR-003: Selected text is captured correctly
- [ ] FR-004: Text sent to service worker via sendMessage
- [ ] FR-005: Service worker receives and acknowledges messages
- [ ] FR-006: Toast shows confirmation with text preview
- [ ] FR-007: Toast auto-removes after 3 seconds
- [ ] FR-008: Toast uses fixed positioning with high z-index
- [ ] FR-009: Empty selections handled gracefully
- [ ] FR-010: Text trimmed before sending
- [ ] FR-011: Line breaks preserved in captured text
- [ ] FR-012: Special characters (Unicode, emoji) handled correctly
- [ ] FR-013: Text stored in chrome.storage.session
- [ ] FR-014: Extension doesn't break page functionality
- [ ] FR-015: Content script loads asynchronously (document_idle)
- [ ] FR-016: Works on SPAs and dynamic content
- [ ] FR-017: Context menu uses extension icon
- [ ] FR-018: No CSP violations (test on GitHub, etc.)
- [ ] FR-019: Works on both HTTP and HTTPS
- [ ] FR-020: Service worker logs text length and timestamp

**Success Criteria (SC)**:
- [ ] SC-001: Context menu appears within 100ms of right-click
- [ ] SC-003: Extension adds <50ms to page load time
- [ ] SC-004: Works on 10+ popular websites (test completed)
- [ ] SC-005: Text captured exactly matches selection
- [ ] SC-006: No console errors during normal usage
- [ ] SC-007: Memory usage <5MB per tab
- [ ] SC-008: Toast appears within 200ms and visible for ~3 seconds
- [ ] SC-010: Handles text from 1 to 10,000 characters

**User Stories**:
- [ ] User Story 1: Select text, right-click, see context menu, click, see toast
- [ ] User Story 2: Works consistently across 10+ websites
- [ ] User Story 3: Fast and lightweight (no perceptible slowdown)

---

## Next Steps

After completing Phase 2:

1. **Test thoroughly** using the verification checklist above
2. **Document any issues** found during testing
3. **Create git commit** for Phase 2 implementation:
   ```bash
   git add .
   git commit -m "feat: Add text selection and context menu integration (Phase 2)

   - Add background service worker for context menu and message handling
   - Add content script for text capture and toast notifications
   - Implement message passing between content script and service worker
   - Store captured text in chrome.storage.session
   - Display toast confirmation with Shadow DOM
   - Update manifest.json with new permissions and configurations

   Generated with Claude Code
   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

4. **Proceed to Phase 3**: ElevenLabs API Integration
   - Use captured text from chrome.storage.session
   - Implement API calls to ElevenLabs text-to-speech API
   - Add audio playback functionality
   - Handle API errors and rate limiting

---

## Helpful Resources

**Chrome Extension Documentation**:
- [Content Scripts Guide](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Service Workers in Extensions](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Context Menus API](https://developer.chrome.com/docs/extensions/reference/contextMenus/)

**Debugging Tools**:
- Service Worker DevTools: chrome://extensions/ → "service worker" link
- Content Script DevTools: F12 on test page → Console tab
- Storage Inspector: chrome://extensions/ → Details → "Inspect views: service worker" → Application tab → Storage

**Testing Sites**:
- Simple: https://example.com
- Article: https://en.wikipedia.org/wiki/Main_Page
- Web App: https://docs.google.com
- Code: https://github.com
- Social: https://twitter.com

---

**Document Status**: ✅ Complete
**Last Updated**: 2025-10-17
**Estimated Implementation Time**: 2-6 hours (depending on experience level)
**Next Phase**: Phase 3 - ElevenLabs API Integration
