// background.js - Background Service Worker for ElevenLabs TTS Chrome Extension
// Handles context menu creation, message passing, and captured text storage

// In-memory cache for captured text (fast access during active period)
let capturedTextCache = null;

// Service worker startup log
console.log('Background service worker started');

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
      // T035: Handle tabs without content script loaded
      if (error.message && error.message.includes('Receiving end does not exist')) {
        console.error('Content script not loaded on this tab. This may be a restricted page (chrome://, chrome-extension://, etc.)');
      } else {
        console.error('Failed to send CAPTURE_TEXT message:', error);
      }
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type, 'from tab:', sender.tab?.id);

  // T038: Validate message structure
  if (!message || !message.type || !message.timestamp) {
    console.warn('Invalid message structure received:', message);
    sendResponse({ success: false, error: 'Invalid message structure' });
    return false;
  }

  if (message.type === 'TEXT_CAPTURED') {
    handleTextCaptured(message.payload, sender.tab.id);
    sendResponse({ success: true });
  } else {
    // T039: Graceful degradation for unknown message types
    console.warn('Unknown message type received:', message.type);
    sendResponse({ success: false, error: 'Unknown message type' });
  }

  // Return false for synchronous response
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
