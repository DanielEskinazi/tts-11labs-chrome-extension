// content.js - Content Script for ElevenLabs TTS Chrome Extension
// Captures selected text and displays toast notifications

console.log('ElevenLabs TTS content script loaded');

// ========================================
// TEXT PARSING UTILITIES (inlined from textUtils.js)
// ========================================

/**
 * Split text into sentences using punctuation detection
 * Uses regex pattern to match sentence-ending punctuation (. ! ?) followed by whitespace
 *
 * @param {string} text - The text to split into sentences
 * @returns {Array<{text: string, startOffset: number, endOffset: number, index: number}>}
 */
function splitIntoSentences(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.warn('splitIntoSentences: Invalid or empty text provided');
    return [];
  }

  // Split on sentence-ending punctuation followed by whitespace
  // Pattern captures: one or more [.!?] followed by one or more whitespace
  const parts = text.split(/([.!?]+\s+)/);

  const sentences = [];
  let currentOffset = 0;

  // Process pairs: sentence text + punctuation+whitespace
  for (let i = 0; i < parts.length; i += 2) {
    const sentenceText = parts[i];
    const punctuation = parts[i + 1] || '';

    // Combine sentence with its punctuation
    const fullText = (sentenceText + punctuation).trim();

    if (fullText.length === 0) continue;

    sentences.push({
      text: fullText,
      startOffset: currentOffset,
      endOffset: currentOffset + fullText.length,
      index: sentences.length
    });

    currentOffset += fullText.length + 1; // +1 for space between sentences
  }

  console.log(`splitIntoSentences: Parsed ${sentences.length} sentences from ${text.length} characters`);
  return sentences;
}

/**
 * Calculate sentence timings based on proportional character count
 * Each sentence gets a duration proportional to its character count relative to total text
 * Timing adjusts automatically for playback speed changes
 *
 * @param {Array<{text: string, index: number}>} sentences - Array of sentence objects
 * @param {number} totalAudioDuration - Total audio duration in milliseconds
 * @param {number} playbackSpeed - Current playback speed (0.5 - 2.0), defaults to 1.0
 * @returns {Array<{sentenceIndex: number, startTime: number, endTime: number, duration: number}>}
 */
function calculateSentenceTimings(sentences, totalAudioDuration, playbackSpeed = 1.0) {
  if (!Array.isArray(sentences) || sentences.length === 0) {
    console.warn('calculateSentenceTimings: Invalid or empty sentences array');
    return [];
  }

  if (!totalAudioDuration || totalAudioDuration <= 0) {
    console.error('calculateSentenceTimings: Invalid audio duration:', totalAudioDuration);
    return [];
  }

  if (!playbackSpeed || playbackSpeed < 0.5 || playbackSpeed > 2.0) {
    console.warn('calculateSentenceTimings: Invalid playback speed, using 1.0:', playbackSpeed);
    playbackSpeed = 1.0;
  }

  // Calculate total character count across all sentences
  const totalChars = sentences.reduce((sum, sentence) => {
    return sum + (sentence.text ? sentence.text.length : 0);
  }, 0);

  if (totalChars === 0) {
    console.error('calculateSentenceTimings: Total character count is 0');
    return [];
  }

  const timings = [];
  let currentTime = 0;

  for (const sentence of sentences) {
    // Calculate proportion of total text this sentence represents
    const proportion = sentence.text.length / totalChars;

    // Calculate duration for this sentence, adjusted for playback speed
    // Higher speed = shorter duration (divide by speed)
    const duration = (proportion * totalAudioDuration) / playbackSpeed;

    timings.push({
      sentenceIndex: sentence.index,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration: duration
    });

    currentTime += duration;
  }

  console.log(`calculateSentenceTimings: Generated ${timings.length} timings for ${totalAudioDuration}ms audio at ${playbackSpeed}x speed`);
  return timings;
}

// Track if audio is playing
let isAudioPlaying = false;

// Control panel state
let controlPanelContainer = null;
let controlPanelShadow = null;
let isActionPending = false;
let speedDropdownCloseHandler = null; // Store the event listener reference for cleanup

// Speed control constants
const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

// ========================================
// HIGHLIGHTING STATE AND UTILITIES
// ========================================

/**
 * Highlight state for sentence-by-sentence highlighting
 * Tracks current highlighting session state during playback
 */
let highlightState = {
  sentences: [],                    // Array of Sentence objects from text parsing
  timings: [],                      // Array of SentenceTiming objects (proportional to audio)
  currentSentenceIndex: null,       // Index of currently highlighted sentence (null if not playing)
  audioDuration: 0,                 // Total audio duration in milliseconds
  playbackSpeed: 1.0,               // Current playback speed (0.5 - 2.0)
  isPlaying: false,                 // Whether audio is actively playing
  isPaused: false,                  // Whether audio is paused
  activeHighlight: null,            // Currently active Highlight object {spanElement, sentenceIndex, isActive}
  originalSelection: null,          // Original DOM range (for finding text nodes)
  selectionContainer: null          // Container element where text was selected
};

/**
 * Inject CSS styles for text highlighting
 * Creates a style element in document head with highlight class
 * Only injects once (checks for existing style element)
 */
function injectHighlightStyles() {
  // Check if styles already injected
  if (document.getElementById('tts-highlight-styles')) {
    console.log('Highlight styles already injected');
    return;
  }

  const style = document.createElement('style');
  style.id = 'tts-highlight-styles';
  style.textContent = `
    .tts-highlight {
      background-color: rgba(255, 255, 0, 0.3) !important;
      transition: background-color 0.2s ease;
      border-radius: 2px;
    }
  `;

  document.head.appendChild(style);
  console.log('Highlight styles injected into document');
}

/**
 * Check if an element is visible in the viewport
 * @param {HTMLElement} element - Element to check visibility
 * @returns {boolean} True if element is fully visible in viewport
 */
function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Auto-scroll to keep highlighted element visible in viewport
 * Only scrolls if element is outside viewport (avoids unnecessary scrolling)
 * @param {HTMLElement} element - Element to scroll into view
 */
function scrollToHighlightIfNeeded(element) {
  if (!element) {
    return;
  }

  // Check if element is already visible
  if (isElementInViewport(element)) {
    // Element already visible, no need to scroll
    return;
  }

  // Scroll element into view with smooth animation, centered in viewport
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'nearest'
  });

  console.log('Auto-scrolled to highlighted sentence');
}

/**
 * Find text within a container and create a highlight span
 * Searches for the exact sentence text and wraps it
 * @param {Element} container - Container element to search within
 * @param {string} searchText - The text to find and highlight
 * @returns {HTMLElement|null} The created highlight span or null if not found
 */
function findAndHighlightText(container, searchText) {
  if (!container) {
    console.error('No container element provided');
    return null;
  }

  // Helper function to get all text content with positions
  function getTextNodes(node) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      node,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      if (currentNode.textContent.trim().length > 0) {
        textNodes.push(currentNode);
      }
    }

    return textNodes;
  }

  // Get all text nodes in container
  const textNodes = getTextNodes(container);

  // Build the full text and track node positions
  let fullText = '';
  const nodePositions = [];

  for (const node of textNodes) {
    const startPos = fullText.length;
    fullText += node.textContent;
    nodePositions.push({
      node: node,
      startPos: startPos,
      endPos: fullText.length,
      text: node.textContent
    });
  }

  // Find the search text in the full text
  const searchIndex = fullText.indexOf(searchText);

  if (searchIndex === -1) {
    // Debug: Show what we're searching for vs what's in container
    console.warn('Could not find text in container.');
    console.warn('  Searching for:', searchText.substring(0, 80) + (searchText.length > 80 ? '...' : ''));
    console.warn('  Container has:', fullText.substring(0, 200) + (fullText.length > 200 ? '...' : ''));
    return null;
  }

  const searchEndIndex = searchIndex + searchText.length;

  // Find which text nodes contain our search text
  const range = document.createRange();
  let startNode = null, startOffset = 0;
  let endNode = null, endOffset = 0;

  for (const nodePos of nodePositions) {
    // Check if this node contains the start of our search text
    if (searchIndex >= nodePos.startPos && searchIndex < nodePos.endPos) {
      startNode = nodePos.node;
      startOffset = searchIndex - nodePos.startPos;
    }

    // Check if this node contains the end of our search text
    if (searchEndIndex > nodePos.startPos && searchEndIndex <= nodePos.endPos) {
      endNode = nodePos.node;
      endOffset = searchEndIndex - nodePos.startPos;
    }
  }

  if (!startNode || !endNode) {
    console.warn('Could not determine text node positions');
    return null;
  }

  try {
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    // Create span to wrap the selection
    const span = document.createElement('span');
    span.className = 'tts-highlight';

    // Use surroundContents if the range is simple (same node)
    if (startNode === endNode) {
      range.surroundContents(span);
    } else {
      // For complex ranges spanning multiple nodes, extract and wrap
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }

    return span;
  } catch (error) {
    console.error('Failed to create highlight span:', error);
    return null;
  }
}

/**
 * Highlight a specific sentence by wrapping it in a <span> with highlight class
 * @param {number} sentenceIndex - Index of sentence to highlight
 */
function highlightSentence(sentenceIndex) {
  // T026: Defensive check for invalid sentence index
  if (typeof sentenceIndex !== 'number' || sentenceIndex < 0 || sentenceIndex >= highlightState.sentences.length) {
    console.warn('highlightSentence: Invalid sentence index:', sentenceIndex);
    return;
  }

  // Remove previous highlight first
  if (highlightState.activeHighlight) {
    removeHighlight(highlightState.activeHighlight);
  }

  const sentence = highlightState.sentences[sentenceIndex];
  if (!sentence) {
    console.warn('highlightSentence: Sentence not found at index:', sentenceIndex);
    return;
  }

  console.log(`Highlighting sentence ${sentenceIndex}:`, sentence.text.substring(0, 50));

  try {
    // Find and highlight the sentence text within the selection container
    const container = highlightState.selectionContainer;
    if (!container) {
      console.error('No selection container available');
      return;
    }

    let span = findAndHighlightText(container, sentence.text);

    // Fallback: If not found in container, try searching entire document
    if (!span) {
      console.warn('Text not found in container, searching entire document...');
      span = findAndHighlightText(document.body, sentence.text);
    }

    if (!span) {
      console.warn('Skipping highlight for sentence', sentenceIndex, '- text not found in DOM (may contain special elements like images)');
      // Don't throw error - just skip this sentence and continue with others
      // This is graceful degradation - playback continues even if highlighting fails
      return;
    }

    // Store as active highlight
    highlightState.activeHighlight = {
      spanElement: span,
      sentenceIndex: sentenceIndex,
      isActive: true
    };

    // Auto-scroll to keep highlighted sentence visible
    scrollToHighlightIfNeeded(span);

    console.log('Sentence highlighted successfully');
  } catch (error) {
    // T025: Error handling for DOM mutation scenarios (graceful degradation)
    console.error('Failed to highlight sentence (DOM may have been modified):', error);
    // Continue playback without highlighting - don't throw error
    // User will still hear audio even if highlighting fails
  }
}

/**
 * Remove highlight by unwrapping the span and restoring original text
 * @param {object} highlight - Highlight object with spanElement property
 */
function removeHighlight(highlight) {
  if (!highlight || !highlight.spanElement) {
    return;
  }

  try {
    const span = highlight.spanElement;
    const parent = span.parentNode;

    if (!parent) {
      console.warn('removeHighlight: Span has no parent node');
      return;
    }

    // Move all child nodes out of span before removing it
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }

    // Remove the now-empty span
    parent.removeChild(span);

    highlight.isActive = false;
    console.log('Highlight removed');
  } catch (error) {
    console.error('Failed to remove highlight:', error);
  }
}

/**
 * Cleanup all highlights and reset state
 * Called when playback stops or errors occur
 * T032: Properly unwraps all spans and restores original DOM
 */
function cleanupHighlights() {
  console.log('Cleaning up highlights');

  try {
    // Remove active highlight
    if (highlightState.activeHighlight) {
      removeHighlight(highlightState.activeHighlight);
      highlightState.activeHighlight = null;
    }

    // T032: Find and remove any orphaned highlight spans (defensive cleanup)
    const orphanedHighlights = document.querySelectorAll('.tts-highlight');
    if (orphanedHighlights.length > 0) {
      console.warn(`Found ${orphanedHighlights.length} orphaned highlight spans, cleaning up`);
      orphanedHighlights.forEach(span => {
        try {
          const parent = span.parentNode;
          if (parent) {
            while (span.firstChild) {
              parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
          }
        } catch (error) {
          console.error('Failed to remove orphaned highlight:', error);
        }
      });
    }

    // Remove selection container marker
    if (highlightState.selectionContainer) {
      highlightState.selectionContainer.removeAttribute('data-tts-selection');
    }

    // Reset state
    highlightState.sentences = [];
    highlightState.timings = [];
    highlightState.currentSentenceIndex = null;
    highlightState.audioDuration = 0;
    highlightState.isPlaying = false;
    highlightState.isPaused = false;
    highlightState.originalSelection = null;
    highlightState.selectionContainer = null;

    console.log('Highlights cleaned up, state reset');
  } catch (error) {
    console.error('Error during highlight cleanup:', error);
    // Force reset state even if cleanup fails
    highlightState = {
      sentences: [],
      timings: [],
      currentSentenceIndex: null,
      audioDuration: 0,
      playbackSpeed: 1.0,
      isPlaying: false,
      isPaused: false,
      activeHighlight: null,
      originalSelection: null
    };
  }
}

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

  // Handle highlighting messages first
  if (message.type === 'START_HIGHLIGHTING') {
    handleStartHighlighting(message.payload, sendResponse)
      .catch(error => {
        console.error('Error in handleStartHighlighting:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Async response
  } else if (message.type === 'UPDATE_HIGHLIGHT_PROGRESS') {
    handleUpdateProgress(message.payload);
    sendResponse({ success: true });
    return false;
  } else if (message.type === 'PLAYBACK_PAUSED') {
    handlePlaybackPaused(message.payload);
    sendResponse({ success: true });
    return false;
  } else if (message.type === 'PLAYBACK_RESUMED') {
    handlePlaybackResumed(message.payload);
    sendResponse({ success: true });
    return false;
  } else if (message.type === 'PLAYBACK_STOPPED') {
    handlePlaybackStopped(message.payload);
    sendResponse({ success: true });
    return false;
  } else if (message.type === 'SPEED_CHANGED') {
    handleSpeedChanged(message.payload, sendResponse);
    return true; // Async response
  }
  // Handle other existing message types
  else if (message.type === 'CAPTURE_TEXT') {
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

    // CRITICAL: Store the selection range NOW before it gets cleared
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0).cloneRange();
      const container = range.commonAncestorContainer;
      const containerElement = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;

      if (containerElement) {
        // Mark and store the container for highlighting
        containerElement.setAttribute('data-tts-selection', 'active');
        highlightState.selectionContainer = containerElement;
        highlightState.originalSelection = range;
        console.log('Selection range stored for highlighting, container:', containerElement.tagName);
      }
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
// HIGHLIGHTING MESSAGE HANDLERS
// ========================================

/**
 * Handle START_HIGHLIGHTING message from background script
 * Initializes highlighting when playback starts
 */
async function handleStartHighlighting(payload, sendResponse) {
  try {
    console.log('START_HIGHLIGHTING received:', payload);

    // Check if highlighting is enabled in user preferences
    const highlightingEnabled = await new Promise((resolve) => {
      chrome.storage.local.get(['highlightingEnabled'], (result) => {
        // Default to enabled if not set
        resolve(result.highlightingEnabled !== undefined ? result.highlightingEnabled : true);
      });
    });

    console.log('Highlighting preference:', highlightingEnabled);

    if (!highlightingEnabled) {
      console.log('Highlighting disabled by user preference - skipping');
      sendResponse({
        success: true,
        skipped: true,
        reason: 'User preference: highlighting disabled'
      });
      return;
    }

    console.log('Payload text length:', payload.text.length);
    console.log('Audio duration:', payload.audioDuration, 'ms');
    console.log('Playback speed:', payload.playbackSpeed);

    // Inject CSS styles for highlighting
    injectHighlightStyles();

    // Check if we have a stored selection from when text was captured
    if (!highlightState.selectionContainer || !highlightState.originalSelection) {
      throw new Error('No stored selection range found (selection was cleared after capture)');
    }

    console.log('Using stored selection, container:',
                highlightState.selectionContainer.tagName,
                highlightState.selectionContainer.className || '(no class)');

    // Parse sentences from text
    highlightState.sentences = splitIntoSentences(payload.text);
    if (highlightState.sentences.length === 0) {
      throw new Error('Failed to parse sentences from text');
    }

    console.log(`Parsed ${highlightState.sentences.length} sentences`);
    highlightState.sentences.forEach((s, i) => {
      console.log(`  Sentence ${i}: "${s.text.substring(0, 60)}${s.text.length > 60 ? '...' : ''}"`);
    });

    // Store audio duration and playback speed
    highlightState.audioDuration = payload.audioDuration;
    highlightState.playbackSpeed = payload.playbackSpeed || 1.0;

    // Calculate sentence timings
    highlightState.timings = calculateSentenceTimings(
      highlightState.sentences,
      payload.audioDuration,
      highlightState.playbackSpeed
    );

    console.log(`Generated ${highlightState.timings.length} timing entries`);
    highlightState.timings.forEach((t, i) => {
      console.log(`  Timing ${i}: ${t.startTime.toFixed(0)}-${t.endTime.toFixed(0)}ms (${t.duration.toFixed(0)}ms)`);
    });

    // Set playing state
    highlightState.isPlaying = true;
    highlightState.isPaused = false;
    highlightState.currentSentenceIndex = 0;

    // Highlight first sentence immediately
    highlightSentence(0);

    sendResponse({
      success: true,
      sentenceCount: highlightState.sentences.length
    });
  } catch (error) {
    console.error('Failed to start highlighting:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle UPDATE_HIGHLIGHT_PROGRESS message from offscreen script
 * Updates current sentence based on playback time
 */
function handleUpdateProgress(payload) {
  // Only update if playing and not paused
  if (!highlightState.isPlaying || highlightState.isPaused) {
    return;
  }

  const currentTime = payload.currentTime;

  // Find which sentence should be highlighted based on current time
  for (let i = 0; i < highlightState.timings.length; i++) {
    const timing = highlightState.timings[i];

    if (currentTime >= timing.startTime && currentTime < timing.endTime) {
      // Check if this is a new sentence (different from current)
      if (highlightState.currentSentenceIndex !== i) {
        console.log(`Switching to sentence ${i} at ${currentTime}ms (timing: ${timing.startTime}-${timing.endTime}ms)`);
        highlightState.currentSentenceIndex = i;
        highlightSentence(i);
      }
      break;
    }
  }
}

/**
 * Handle PLAYBACK_PAUSED message
 * Keeps current highlight active during pause
 */
function handlePlaybackPaused(payload) {
  highlightState.isPaused = true;
  console.log('Playback paused, keeping current highlight active');
}

/**
 * Handle PLAYBACK_RESUMED message
 * Continues highlighting from current position
 */
function handlePlaybackResumed(payload) {
  highlightState.isPaused = false;
  console.log('Playback resumed, continuing highlighting');
}

/**
 * Handle PLAYBACK_STOPPED message
 * Cleans up all highlights and resets state
 */
function handlePlaybackStopped(payload) {
  console.log('Playback stopped, cleaning up highlights');
  cleanupHighlights();
}

/**
 * Handle SPEED_CHANGED message
 * Recalculates sentence timings for new playback speed
 */
function handleSpeedChanged(payload, sendResponse) {
  try {
    console.log('Speed changed to:', payload.newSpeed);

    // Update playback speed
    highlightState.playbackSpeed = payload.newSpeed;

    // Recalculate all sentence timings with new speed
    highlightState.timings = calculateSentenceTimings(
      highlightState.sentences,
      highlightState.audioDuration,
      payload.newSpeed
    );

    console.log('Sentence timings recalculated for new speed');

    sendResponse({
      success: true,
      timingsRecalculated: true
    });
  } catch (error) {
    console.error('Failed to recalculate timings:', error);
    sendResponse({
      success: false,
      error: error.message
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

        /* Speed control styles */
        .speed-control {
          position: relative;
        }

        .speed-toggle {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          width: auto;
          height: 44px;
          font-size: 14px;
          font-weight: 500;
        }

        .speed-toggle .arrow {
          font-size: 10px;
          transition: transform 0.2s;
        }

        .speed-toggle[aria-expanded="true"] .arrow {
          transform: rotate(180deg);
        }

        .speed-menu {
          position: absolute;
          bottom: 100%;
          right: 0;
          margin-bottom: 8px;
          background: rgba(0, 0, 0, 0.95);
          border-radius: 8px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 2147483648;
        }

        .speed-menu.hidden {
          display: none;
        }

        .speed-preset {
          width: 100%;
          padding: 8px 16px;
          text-align: left;
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          border-radius: 4px;
          font-size: 14px;
          transition: background 0.2s;
        }

        .speed-preset:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .speed-preset.active {
          background: rgba(255, 255, 255, 0.2);
          font-weight: bold;
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

          .speed-toggle {
            padding: 8px 10px;
            font-size: 13px;
          }

          .speed-preset {
            padding: 10px 16px;
            font-size: 15px;
          }
        }
      </style>
      <div class="control-panel" role="region" aria-label="Audio playback controls">
        <button id="pause-btn" aria-label="Pause">⏸</button>
        <button id="stop-btn" aria-label="Stop">⏹</button>
        <div class="speed-control">
          <button id="speed-toggle" class="speed-toggle" aria-label="Playback speed" aria-haspopup="true" aria-expanded="false">
            <span id="speed-current">1x</span>
            <span class="arrow">▼</span>
          </button>
          <div id="speed-menu" class="speed-menu hidden" role="menu">
            <button class="speed-preset" data-speed="0.5" role="menuitem">0.5x</button>
            <button class="speed-preset" data-speed="0.75" role="menuitem">0.75x</button>
            <button class="speed-preset active" data-speed="1.0" role="menuitem">1x</button>
            <button class="speed-preset" data-speed="1.25" role="menuitem">1.25x</button>
            <button class="speed-preset" data-speed="1.5" role="menuitem">1.5x</button>
            <button class="speed-preset" data-speed="1.75" role="menuitem">1.75x</button>
            <button class="speed-preset" data-speed="2.0" role="menuitem">2x</button>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners to buttons
    const pauseBtn = controlPanelShadow.querySelector('#pause-btn');
    const stopBtn = controlPanelShadow.querySelector('#stop-btn');

    pauseBtn.addEventListener('click', handleControlPauseClicked);
    stopBtn.addEventListener('click', handleControlStopClicked);

    // Attach speed control event listeners
    const speedToggle = controlPanelShadow.querySelector('#speed-toggle');
    const speedMenu = controlPanelShadow.querySelector('#speed-menu');
    const speedPresets = controlPanelShadow.querySelectorAll('.speed-preset');

    // Toggle dropdown
    speedToggle.addEventListener('click', () => {
      const isHidden = speedMenu.classList.toggle('hidden');
      speedToggle.setAttribute('aria-expanded', !isHidden);
    });

    // Handle preset clicks
    speedPresets.forEach(preset => {
      preset.addEventListener('click', async () => {
        const speed = parseFloat(preset.dataset.speed);
        await handleSpeedChange(speed);

        // Close dropdown
        speedMenu.classList.add('hidden');
        speedToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close dropdown when clicking outside (attach to document, not shadow)
    // Store the handler so we can remove it later
    speedDropdownCloseHandler = (e) => {
      // Check if controlPanelContainer still exists (defensive check)
      if (controlPanelContainer && !controlPanelContainer.contains(e.target)) {
        speedMenu.classList.add('hidden');
        speedToggle.setAttribute('aria-expanded', 'false');
      }
    };
    document.addEventListener('click', speedDropdownCloseHandler);

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

  // Remove the speed dropdown close handler
  if (speedDropdownCloseHandler) {
    document.removeEventListener('click', speedDropdownCloseHandler);
    speedDropdownCloseHandler = null;
    console.log('Speed dropdown event listener removed');
  }

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

/**
 * Handle speed change from preset button click
 * @param {number} newSpeed - The new playback speed (0.5-2.0)
 */
async function handleSpeedChange(newSpeed) {
  console.log('Speed preset clicked:', newSpeed);

  // Prevent rapid clicking
  if (isActionPending) {
    console.log('Control action already pending, ignoring speed change');
    return;
  }

  isActionPending = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CONTROL_SPEED_CHANGED',
      payload: { speed: newSpeed },
      timestamp: Date.now()
    });

    if (response.success) {
      updateSpeedUI(newSpeed);
    } else {
      console.error('Speed change failed:', response.error);
    }
  } catch (error) {
    console.error('Failed to send speed change message:', error);
  } finally {
    isActionPending = false;
  }
}

/**
 * Update speed UI (toggle button display and active preset)
 * @param {number} speed - Current speed (0.5-2.0)
 */
function updateSpeedUI(speed) {
  if (!controlPanelShadow) {
    console.warn('No control panel shadow DOM to update speed UI');
    return;
  }

  const speedCurrent = controlPanelShadow.querySelector('#speed-current');
  const speedPresets = controlPanelShadow.querySelectorAll('.speed-preset');

  if (!speedCurrent) {
    console.error('Speed current element not found in shadow DOM');
    return;
  }

  // Update toggle button text
  speedCurrent.textContent = `${speed}x`;

  // Update active preset
  speedPresets.forEach(preset => {
    if (parseFloat(preset.dataset.speed) === speed) {
      preset.classList.add('active');
    } else {
      preset.classList.remove('active');
    }
  });

  console.log('Speed UI updated to', speed);
}
