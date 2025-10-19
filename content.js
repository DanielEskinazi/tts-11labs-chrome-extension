// content.js - Content Script for ElevenLabs TTS Chrome Extension
// Captures selected text and displays toast notifications

console.log('ElevenLabs TTS content script loaded');

// Track if audio is playing
let isAudioPlaying = false;

// Control panel state
let controlPanelContainer = null;
let controlPanelShadow = null;
let isActionPending = false;

// Keyboard shortcuts for audio control
document.addEventListener('keydown', (event) => {
  // Ctrl+Shift+P = Pause/Resume audio
  if (event.ctrlKey && event.shiftKey && event.key === 'P') {
    event.preventDefault();
    toggleAudioPlayback();
  }
  // Ctrl+Shift+S = Stop audio
  if (event.ctrlKey && event.shiftKey && event.key === 'S') {
    event.preventDefault();
    stopAudioPlayback();
  }
});

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.type);

  // Validate message structure (T038: defensive checks)
  if (!message || !message.type || !message.timestamp) {
    console.warn('Invalid message structure received:', message);
    sendResponse({ success: false, error: 'Invalid message structure' });
    return false;
  }

  if (message.type === 'CAPTURE_TEXT') {
    captureSelectedText();
  } else if (message.type === 'SHOW_TOAST') {
    showToast(message.payload);
  } else if (message.type === 'AUTOPLAY_BLOCKED') {
    // Show toast with play button for autoplay blocked
    showToast({
      message: 'Click to play audio (autoplay blocked)',
      type: 'warning',
      action: 'PLAY_AUDIO'
    });
  } else if (message.type === 'AUDIO_PLAYBACK_STARTED') {
    // Show control panel when audio starts
    showControlPanel();
  } else if (message.type === 'AUDIO_PLAYBACK_PAUSED') {
    // Update button to play icon
    updateButtonState('paused');
  } else if (message.type === 'AUDIO_PLAYBACK_RESUMED') {
    // Update button to pause icon
    updateButtonState('playing');
  } else if (message.type === 'AUDIO_PLAYBACK_STOPPED') {
    // Hide control panel when audio stops
    hideControlPanel();
    isAudioPlaying = false;
  } else {
    // T039: Graceful degradation for unknown message types
    console.warn('Unknown message type received:', message.type);
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

      // After text is captured, trigger TTS request
      return triggerTTSRequest(trimmedText);
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
  const { message, type = 'success', action = null } = config;

  // Validate message
  if (!message || message.trim().length === 0) {
    console.error('Toast message is required');
    return;
  }

  // T033: Check if document.body is available
  if (!document.body) {
    console.error('Cannot show toast: document.body is not available');
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      console.log('Waiting for document.body to be available');
      document.addEventListener('DOMContentLoaded', () => showToast(config));
      return;
    }
    return;
  }

  try {
    // Create host element for shadow DOM
    const container = document.createElement('div');
    container.className = 'elevenlabs-tts-toast-host';

    // T034: Add error handling for Shadow DOM creation
    // Attach shadow root in closed mode (prevents page JS access)
    // T032: CSP compliance - Shadow DOM with inline styles is CSP-compliant
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
          ${action ? 'cursor: pointer;' : ''}
        }

        .toast:hover {
          ${action ? 'opacity: 0.9;' : ''}
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

    // Add click handler if action is provided
    if (action) {
      const toastElement = shadow.querySelector('.toast');
      toastElement.addEventListener('click', () => {
        if (action === 'PLAY_AUDIO') {
          // Send message to background to resume/play audio
          chrome.runtime.sendMessage({
            type: 'RESUME_AUDIO',
            payload: {},
            timestamp: Date.now()
          }).then(response => {
            console.log('Play audio request sent:', response);
            container.remove(); // Remove toast after click
          }).catch(error => {
            console.error('Failed to send play audio message:', error);
          });
        }
      });
    }

    // Append to page
    document.body.appendChild(container);

    console.log('Toast displayed:', message);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      container.remove();
      console.log('Toast removed');
    }, 3000);

  } catch (error) {
    // T034: Enhanced error handling for Shadow DOM creation failures
    console.error('Error showing toast:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    // Fallback: Try to log to console at least
    console.warn('Toast message (failed to display):', message);
  }
}

// HTML escape utility to prevent XSS
// T037: Unicode and emoji support - textContent handles UTF-8 correctly
function escapeHtml(text) {
  const div = document.createElement('div');
  // textContent assignment automatically handles UTF-8, emojis, and special characters
  div.textContent = text;
  return div.innerHTML;
}

// Toggle audio playback (pause/resume)
function toggleAudioPlayback() {
  if (!isAudioPlaying) {
    console.log('No audio playing to toggle');
    showToast({
      message: 'No audio playing',
      type: 'warning'
    });
    return;
  }

  chrome.runtime.sendMessage({
    type: 'PAUSE_AUDIO',
    payload: {},
    timestamp: Date.now()
  }).then(response => {
    if (response.success) {
      console.log('Audio paused');
      showToast({
        message: 'Audio paused (Ctrl+Shift+P to resume)',
        type: 'success'
      });
    } else {
      // Try resume instead
      return chrome.runtime.sendMessage({
        type: 'RESUME_AUDIO',
        payload: {},
        timestamp: Date.now()
      });
    }
  }).then(response => {
    if (response && response.success) {
      console.log('Audio resumed');
      showToast({
        message: 'Audio resumed',
        type: 'success'
      });
    }
  }).catch(error => {
    console.error('Failed to toggle audio:', error);
  });
}

// Stop audio playback
function stopAudioPlayback() {
  if (!isAudioPlaying) {
    console.log('No audio playing to stop');
    return;
  }

  chrome.runtime.sendMessage({
    type: 'STOP_AUDIO',
    payload: {},
    timestamp: Date.now()
  }).then(response => {
    if (response.success) {
      isAudioPlaying = false;
      console.log('Audio stopped');
      showToast({
        message: 'Audio stopped',
        type: 'success'
      });
    }
  }).catch(error => {
    console.error('Failed to stop audio:', error);
  });
}

// Trigger TTS request to background service worker
async function triggerTTSRequest(text) {
  try {
    console.log(`Triggering TTS request for ${text.length} characters`);

    // Show loading toast
    showToast({
      message: 'Converting text to speech...',
      type: 'success'
    });

    // Send TTS request to background
    const response = await chrome.runtime.sendMessage({
      type: 'TTS_REQUEST',
      payload: {
        text: text
      },
      timestamp: Date.now()
    });

    if (response.success) {
      console.log('TTS request successful:', response.payload);

      // Track audio is now playing
      isAudioPlaying = true;

      // Show success toast with controls hint
      showToast({
        message: 'Audio ready (Ctrl+Shift+P to pause/resume)',
        type: 'success'
      });
    } else {
      console.error('TTS request failed:', response.error);
      // Error handling will be in Task T018
      showToast({
        message: response.error || 'TTS request failed',
        type: 'error'
      });
    }

  } catch (error) {
    console.error('Error triggering TTS request:', error);
    showToast({
      message: 'Failed to process text-to-speech request',
      type: 'error'
    });
  }
}

// ========================================
// CONTROL PANEL FUNCTIONS
// ========================================

/**
 * Show audio playback control panel
 * Creates a floating Shadow DOM control panel with pause/play and stop buttons
 */
function showControlPanel() {
  console.log('Showing control panel');

  // Check if document.body is available
  if (!document.body) {
    console.error('Cannot show control panel: document.body is not available');
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      console.log('Waiting for document.body to be available');
      document.addEventListener('DOMContentLoaded', () => showControlPanel());
      return;
    }
    return;
  }

  try {
    // Remove any existing control panel first
    const existingPanel = document.querySelector('.elevenlabs-tts-controls-host');
    if (existingPanel) {
      existingPanel.remove();
      console.log('Removed old control panel');
    }

    // Create host element for shadow DOM
    controlPanelContainer = document.createElement('div');
    controlPanelContainer.className = 'elevenlabs-tts-controls-host';

    // Attach shadow root in closed mode (prevents page JS access)
    controlPanelShadow = controlPanelContainer.attachShadow({ mode: 'closed' });

    // Inject styles and content into shadow root
    controlPanelShadow.innerHTML = `
      <style>
        .control-panel {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 2147483647; /* Max z-index */

          display: flex;
          gap: 12px;
          padding: 12px 16px;

          background: rgba(0, 0, 0, 0.85);
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2),
                      0 0 0 1px rgba(255, 255, 255, 0.1);

          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          animation: slideInFromRight 0.3s ease-out;
        }

        .control-panel button {
          width: 44px;
          height: 44px;
          border: none;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.15);
          color: white;
          font-size: 20px;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .control-panel button:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .control-panel button:active {
          transform: scale(0.95);
        }

        .control-panel button:focus {
          outline: 2px solid white;
          outline-offset: 2px;
        }

        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .control-panel {
            right: auto;
            left: 50%;
            transform: translateX(-50%);
            bottom: 16px;
            padding: 10px 14px;
            gap: 10px;
          }
        }
      </style>
      <div class="control-panel" role="region" aria-label="Audio playback controls">
        <button id="pause-btn" aria-label="Pause">⏸</button>
        <button id="stop-btn" aria-label="Stop">⏹</button>
      </div>
    `;

    // Attach event listeners to buttons
    const pauseBtn = controlPanelShadow.querySelector('#pause-btn');
    const stopBtn = controlPanelShadow.querySelector('#stop-btn');

    pauseBtn.addEventListener('click', handleControlPauseClicked);
    stopBtn.addEventListener('click', handleControlStopClicked);

    // Append to page
    document.body.appendChild(controlPanelContainer);

    console.log('Control panel displayed');

  } catch (error) {
    console.error('Error showing control panel:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
  }
}

/**
 * Hide audio playback control panel
 * Removes the control panel from the page
 */
function hideControlPanel() {
  console.log('Hiding control panel');

  if (controlPanelContainer && controlPanelContainer.parentNode) {
    controlPanelContainer.remove();
    controlPanelContainer = null;
    controlPanelShadow = null;
    console.log('Control panel removed');
  } else {
    console.log('No control panel to remove');
  }
}

/**
 * Handle pause button click
 * Implements optimistic UI update with confirmation
 */
async function handleControlPauseClicked() {
  console.log('Pause button clicked');

  // Prevent rapid clicking
  if (isActionPending) {
    console.log('Control action already pending, ignoring click');
    return;
  }

  isActionPending = true;

  try {
    // Send pause message to background
    const response = await chrome.runtime.sendMessage({
      type: 'CONTROL_PAUSE_CLICKED',
      payload: {},
      timestamp: Date.now()
    });

    if (!response.success) {
      console.error('Pause failed:', response.error);
    }
  } catch (error) {
    console.error('Failed to send pause message:', error);
  } finally {
    isActionPending = false;
  }
}

/**
 * Handle resume button click
 * Implements optimistic UI update with confirmation
 */
async function handleControlResumeClicked() {
  console.log('Resume button clicked');

  // Prevent rapid clicking
  if (isActionPending) {
    console.log('Control action already pending, ignoring click');
    return;
  }

  isActionPending = true;

  try {
    // Send resume message to background
    const response = await chrome.runtime.sendMessage({
      type: 'CONTROL_RESUME_CLICKED',
      payload: {},
      timestamp: Date.now()
    });

    if (!response.success) {
      console.error('Resume failed:', response.error);
    }
  } catch (error) {
    console.error('Failed to send resume message:', error);
  } finally {
    isActionPending = false;
  }
}

/**
 * Handle stop button click
 */
async function handleControlStopClicked() {
  console.log('Stop button clicked');

  // Prevent rapid clicking
  if (isActionPending) {
    console.log('Control action already pending, ignoring click');
    return;
  }

  isActionPending = true;

  try {
    // Send stop message to background
    const response = await chrome.runtime.sendMessage({
      type: 'CONTROL_STOP_CLICKED',
      payload: {},
      timestamp: Date.now()
    });

    if (!response.success) {
      console.error('Stop failed:', response.error);
    }
  } catch (error) {
    console.error('Failed to send stop message:', error);
  } finally {
    isActionPending = false;
  }
}

/**
 * Update button state (pause ↔ play toggle)
 * @param {string} newState - 'playing' or 'paused'
 */
function updateButtonState(newState) {
  if (!controlPanelShadow) {
    console.warn('No control panel shadow DOM to update');
    return;
  }

  const pauseBtn = controlPanelShadow.querySelector('#pause-btn');
  if (!pauseBtn) {
    console.error('Pause button not found in shadow DOM');
    return;
  }

  if (newState === 'paused') {
    // Show play button
    pauseBtn.textContent = '▶';
    pauseBtn.setAttribute('aria-label', 'Play');
    pauseBtn.removeEventListener('click', handleControlPauseClicked);
    pauseBtn.addEventListener('click', handleControlResumeClicked);
    console.log('Button state updated to Play');
  } else if (newState === 'playing') {
    // Show pause button
    pauseBtn.textContent = '⏸';
    pauseBtn.setAttribute('aria-label', 'Pause');
    pauseBtn.removeEventListener('click', handleControlResumeClicked);
    pauseBtn.addEventListener('click', handleControlPauseClicked);
    console.log('Button state updated to Pause');
  } else {
    console.warn('Unknown button state:', newState);
  }
}
