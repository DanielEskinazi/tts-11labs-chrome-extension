// background.js - Background Service Worker for ElevenLabs TTS Chrome Extension
// Handles context menu creation, message passing, and captured text storage

// Import API utilities
import { textToSpeech, validateApiKey, validateTextLength } from './src/api/elevenlabs.js';
import { getApiKey } from './src/utils/storage.js';
import { mapApiErrorToUserMessage } from './src/utils/errors.js';

// In-memory cache for captured text (fast access during active period)
let capturedTextCache = null;

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Service worker startup log
console.log('Background service worker started');

// Offscreen document management
async function setupOffscreenDocument() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });

  if (existingContexts.length > 0) {
    console.log('Offscreen document already exists');
    return;
  }

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Playing text-to-speech audio from ElevenLabs API'
  });

  console.log('Offscreen document created for audio playback');
}

async function closeOffscreenDocument() {
  // Check if offscreen document exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });

  if (existingContexts.length === 0) {
    return;
  }

  // Close offscreen document
  await chrome.offscreen.closeDocument();
  console.log('Offscreen document closed');
}

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
  } else if (message.type === 'TTS_REQUEST') {
    // Handle TTS request asynchronously
    handleTTSRequest(message.payload, sender.tab.id)
      .then(result => sendResponse({ success: true, payload: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.type === 'PAUSE_AUDIO') {
    // Forward to offscreen document
    chrome.runtime.sendMessage({
      type: 'PAUSE_AUDIO',
      payload: {},
      timestamp: Date.now()
    })
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.type === 'RESUME_AUDIO') {
    // Forward to offscreen document
    chrome.runtime.sendMessage({
      type: 'RESUME_AUDIO',
      payload: {},
      timestamp: Date.now()
    })
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.type === 'STOP_AUDIO') {
    // Forward to offscreen document
    chrome.runtime.sendMessage({
      type: 'STOP_AUDIO',
      payload: {},
      timestamp: Date.now()
    })
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.type === 'AUDIO_PLAYBACK_ENDED') {
    // Audio playback completed in offscreen document
    console.log('Audio playback completed');
    sendResponse({ success: true });
    return false;
  } else if (message.type === 'AUDIO_PLAYBACK_ERROR') {
    // Audio playback error in offscreen document
    console.error('Audio playback error from offscreen:', message.payload?.error);
    sendResponse({ success: true });
    return false;
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

// Handle TTS request from content script
async function handleTTSRequest(payload, tabId) {
  const startTime = Date.now();
  const { text } = payload;

  console.log(`TTS request received for ${text.length} characters`);

  try {
    // Retrieve API key from storage
    const apiKey = await getApiKey();

    // Validate API key
    if (!validateApiKey(apiKey)) {
      throw new Error('API_KEY_MISSING');
    }

    // Validate text length
    if (!validateTextLength(text)) {
      if (text.length > 5000) {
        throw new Error('TEXT_TOO_LONG');
      } else {
        throw new Error('INVALID_TEXT');
      }
    }

    // Call ElevenLabs API
    const audioBlob = await textToSpeech(text, apiKey);

    const responseTime = Date.now() - startTime;
    console.log(`TTS API request successful in ${responseTime}ms, audio size: ${audioBlob.size} bytes`);

    // Ensure offscreen document exists
    await setupOffscreenDocument();

    // Convert blob to base64 for safe messaging
    const audioArrayBuffer = await audioBlob.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioArrayBuffer);
    console.log(`Audio converted to base64: ${audioBase64.length} characters`);

    // Send audio to offscreen document to load
    const loadResult = await chrome.runtime.sendMessage({
      type: 'LOAD_AUDIO',
      payload: {
        audioData: audioBase64,
        format: 'base64'
      },
      timestamp: Date.now()
    });

    if (!loadResult.success) {
      throw new Error(loadResult.error || 'Failed to load audio in offscreen document');
    }

    console.log('Audio loaded in offscreen document');

    // Automatically start playback
    try {
      const playResult = await chrome.runtime.sendMessage({
        type: 'PLAY_AUDIO',
        payload: {},
        timestamp: Date.now()
      });

      if (!playResult.success) {
        throw new Error(playResult.error || 'Failed to play audio');
      }

      console.log('Automatic playback started in offscreen document');
    } catch (playError) {
      // Handle autoplay blocking
      if (playError.message && playError.message.includes('AUTOPLAY_BLOCKED')) {
        console.warn('Autoplay blocked - user interaction required');
        // Send message to content script about autoplay block
        chrome.tabs.sendMessage(tabId, {
          type: 'AUTOPLAY_BLOCKED',
          payload: {},
          timestamp: Date.now()
        }).catch(err => console.error('Failed to send AUTOPLAY_BLOCKED message:', err));
      } else {
        throw playError;
      }
    }

    // Return success (audio is now loaded and playing)
    return {
      success: true,
      responseTime: responseTime,
      audioSize: audioBlob.size
    };

  } catch (error) {
    console.error('TTS request failed:', error);

    // Map error to user-friendly message
    let errorResponse;
    if (error.message === 'API_KEY_MISSING') {
      errorResponse = {
        type: 'API_KEY_MISSING',
        message: 'No API key configured. Please add your ElevenLabs API key in extension settings.'
      };
    } else if (error.message === 'TEXT_TOO_LONG') {
      errorResponse = {
        type: 'TEXT_TOO_LONG',
        message: 'Text too long. Maximum 5000 characters supported.'
      };
    } else {
      // Use error mapping utility for API errors
      const statusCode = error.message.match(/status (\d+)/)?.[1];
      errorResponse = mapApiErrorToUserMessage(error, statusCode ? parseInt(statusCode) : null);
    }

    // Throw error to be caught by message handler
    throw new Error(errorResponse.message);
  }
}
