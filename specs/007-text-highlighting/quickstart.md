# Quickstart: Text Highlighting Implementation

**Date**: 2025-10-22 | **Feature**: 007-text-highlighting

## Overview

This guide provides step-by-step instructions for implementing sentence-by-sentence text highlighting synchronized with TTS audio playback.

**Estimated Time**: 2-3 hours for complete implementation

---

## Prerequisites

- Extension loaded in Chrome (`chrome://extensions`)
- API key configured
- Voice selection and playback speed features already implemented
- Basic understanding of Chrome extension message passing

---

## Implementation Steps

### Step 1: Create Text Utilities (30 min)

**File**: `src/utils/textUtils.js`

```javascript
/**
 * Split text into sentences using punctuation detection
 * @param {string} text - The text to split
 * @returns {Array<{text: string, startOffset: number, endOffset: number, index: number}>}
 */
export function splitIntoSentences(text) {
  // Split on sentence-ending punctuation followed by whitespace
  const rawSentences = text.split(/([.!?]+\s+)/);
  const sentences = [];
  let currentOffset = 0;

  for (let i = 0; i < rawSentences.length; i += 2) {
    const sentence = rawSentences[i];
    const punctuation = rawSentences[i + 1] || '';
    const fullText = (sentence + punctuation).trim();

    if (fullText.length === 0) continue;

    sentences.push({
      text: fullText,
      startOffset: currentOffset,
      endOffset: currentOffset + fullText.length,
      index: sentences.length
    });

    currentOffset += fullText.length + 1; // +1 for space
  }

  return sentences;
}

/**
 * Calculate sentence timings based on proportional character count
 * @param {Array} sentences - Array of sentence objects
 * @param {number} totalAudioDuration - Total audio duration in ms
 * @param {number} playbackSpeed - Current playback speed (0.5-2.0)
 * @returns {Array<{sentenceIndex: number, startTime: number, endTime: number, duration: number}>}
 */
export function calculateSentenceTimings(sentences, totalAudioDuration, playbackSpeed = 1.0) {
  const totalChars = sentences.reduce((sum, s) => sum + s.text.length, 0);
  const timings = [];
  let currentTime = 0;

  for (const sentence of sentences) {
    const proportion = sentence.text.length / totalChars;
    const duration = (proportion * totalAudioDuration) / playbackSpeed;

    timings.push({
      sentenceIndex: sentence.index,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration
    });

    currentTime += duration;
  }

  return timings;
}
```

**Test**:
```javascript
const text = "Hello world. This is a test! How are you?";
const sentences = splitIntoSentences(text);
console.log(sentences);
// Expected: 3 sentences

const timings = calculateSentenceTimings(sentences, 10000, 1.0);
console.log(timings);
// Expected: ~3.3s, ~4.5s, ~2.2s (proportional to char count)
```

---

### Step 2: Add Highlighting Manager to Content Script (60 min)

**File**: `content.js`

```javascript
// Import text utilities
import { splitIntoSentences, calculateSentenceTimings } from './src/utils/textUtils.js';

// Highlight state
let highlightState = {
  sentences: [],
  timings: [],
  currentSentenceIndex: null,
  audioDuration: 0,
  playbackSpeed: 1.0,
  isPlaying: false,
  isPaused: false,
  activeHighlight: null,
  originalSelection: null  // Store DOM range
};

/**
 * Inject CSS for highlights
 */
function injectHighlightStyles() {
  if (document.getElementById('tts-highlight-styles')) return;

  const style = document.createElement('style');
  style.id = 'tts-highlight-styles';
  style.textContent = `
    .tts-highlight {
      background-color: rgba(255, 255, 0, 0.3) !important;
      transition: background-color 0.2s ease;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Create highlight for a sentence
 * @param {number} sentenceIndex
 */
function highlightSentence(sentenceIndex) {
  // Remove previous highlight
  if (highlightState.activeHighlight) {
    removeHighlight(highlightState.activeHighlight);
  }

  const sentence = highlightState.sentences[sentenceIndex];
  if (!sentence || !highlightState.originalSelection) return;

  try {
    // Find the text node containing this sentence
    const range = document.createRange();
    range.setStart(highlightState.originalSelection.startContainer, sentence.startOffset);
    range.setEnd(highlightState.originalSelection.startContainer, sentence.endOffset);

    // Wrap in span
    const span = document.createElement('span');
    span.className = 'tts-highlight';
    range.surroundContents(span);

    highlightState.activeHighlight = {
      spanElement: span,
      sentenceIndex,
      isActive: true
    };

    // Auto-scroll if needed
    scrollToHighlightIfNeeded(span);

    console.log(`Highlighted sentence ${sentenceIndex}:`, sentence.text);
  } catch (error) {
    console.error('Failed to highlight sentence:', error);
  }
}

/**
 * Remove highlight
 */
function removeHighlight(highlight) {
  if (!highlight || !highlight.spanElement) return;

  try {
    const span = highlight.spanElement;
    const parent = span.parentNode;

    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);

    highlight.isActive = false;
  } catch (error) {
    console.error('Failed to remove highlight:', error);
  }
}

/**
 * Auto-scroll to keep highlight visible
 */
function scrollToHighlightIfNeeded(element) {
  const rect = element.getBoundingClientRect();
  const isVisible = (
    rect.top >= 0 &&
    rect.bottom <= window.innerHeight
  );

  if (!isVisible) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest'
    });
  }
}

/**
 * Cleanup all highlights
 */
function cleanupHighlights() {
  if (highlightState.activeHighlight) {
    removeHighlight(highlightState.activeHighlight);
    highlightState.activeHighlight = null;
  }

  highlightState.sentences = [];
  highlightState.timings = [];
  highlightState.currentSentenceIndex = null;
  highlightState.isPlaying = false;
  highlightState.isPaused = false;

  console.log('Highlights cleaned up');
}
```

---

### Step 3: Add Message Handlers to Content Script (45 min)

**File**: `content.js` (continue)

```javascript
// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_HIGHLIGHTING':
      handleStartHighlighting(message.payload, sendResponse);
      return true; // Async response

    case 'UPDATE_HIGHLIGHT_PROGRESS':
      handleUpdateProgress(message.payload);
      break;

    case 'PLAYBACK_PAUSED':
      handlePlaybackPaused(message.payload);
      break;

    case 'PLAYBACK_RESUMED':
      handlePlaybackResumed(message.payload);
      break;

    case 'PLAYBACK_STOPPED':
      handlePlaybackStopped(message.payload);
      break;

    case 'SPEED_CHANGED':
      handleSpeedChanged(message.payload, sendResponse);
      return true; // Async response
  }
});

function handleStartHighlighting(payload, sendResponse) {
  try {
    injectHighlightStyles();

    // Store original selection
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      highlightState.originalSelection = selection.getRangeAt(0).cloneRange();
    }

    // Parse sentences
    highlightState.sentences = splitIntoSentences(payload.text);
    highlightState.audioDuration = payload.audioDuration;
    highlightState.playbackSpeed = payload.playbackSpeed;

    // Calculate timings
    highlightState.timings = calculateSentenceTimings(
      highlightState.sentences,
      payload.audioDuration,
      payload.playbackSpeed
    );

    highlightState.isPlaying = true;
    highlightState.currentSentenceIndex = 0;

    // Highlight first sentence
    highlightSentence(0);

    sendResponse({
      success: true,
      sentenceCount: highlightState.sentences.length
    });
  } catch (error) {
    console.error('Failed to start highlighting:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function handleUpdateProgress(payload) {
  if (!highlightState.isPlaying || highlightState.isPaused) return;

  const currentTime = payload.currentTime;

  // Find current sentence based on time
  for (let i = 0; i < highlightState.timings.length; i++) {
    const timing = highlightState.timings[i];

    if (currentTime >= timing.startTime && currentTime < timing.endTime) {
      if (highlightState.currentSentenceIndex !== i) {
        highlightState.currentSentenceIndex = i;
        highlightSentence(i);
      }
      break;
    }
  }
}

function handlePlaybackPaused(payload) {
  highlightState.isPaused = true;
  console.log('Playback paused, keeping highlight active');
}

function handlePlaybackResumed(payload) {
  highlightState.isPaused = false;
  console.log('Playback resumed');
}

function handlePlaybackStopped(payload) {
  cleanupHighlights();
  console.log('Playback stopped, highlights removed');
}

function handleSpeedChanged(payload, sendResponse) {
  try {
    highlightState.playbackSpeed = payload.newSpeed;

    // Recalculate timings
    highlightState.timings = calculateSentenceTimings(
      highlightState.sentences,
      highlightState.audioDuration,
      payload.newSpeed
    );

    sendResponse({
      success: true,
      timingsRecalculated: true
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}
```

---

### Step 4: Send Messages from Background Script (30 min)

**File**: `background.js`

Modify the context menu handler to send START_HIGHLIGHTING:

```javascript
// In the context menu click handler, after textToSpeech() is called
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'read-aloud') {
    const selectedText = info.selectionText;

    // Get audio duration from API response
    const audioBlob = await textToSpeech(selectedText, apiKey, voiceId);
    const audioDuration = await getAudioDuration(audioBlob);

    // Send highlighting message to content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'START_HIGHLIGHTING',
        payload: {
          text: selectedText,
          audioDuration: audioDuration,
          playbackSpeed: await getPlaybackSpeed(),
          timestamp: Date.now()
        }
      });

      console.log('Highlighting started:', response);
    } catch (error) {
      console.error('Failed to start highlighting:', error);
      // Continue playback without highlighting (graceful degradation)
    }
  }
});

// Helper to get audio duration
async function getAudioDuration(audioBlob) {
  return new Promise((resolve) => {
    const audio = new Audio(URL.createObjectURL(audioBlob));
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration * 1000); // Convert to milliseconds
      URL.revokeObjectURL(audio.src);
    });
  });
}
```

---

### Step 5: Send Progress Updates from Offscreen Script (30 min)

**File**: `offscreen.js`

Add progress tracking to the audio playback:

```javascript
let progressInterval = null;

function startProgressTracking(audio) {
  // Send progress updates every 100ms
  progressInterval = setInterval(() => {
    if (audio.paused) return;

    chrome.runtime.sendMessage({
      type: 'UPDATE_HIGHLIGHT_PROGRESS',
      payload: {
        currentTime: audio.currentTime * 1000, // Convert to ms
        timestamp: Date.now()
      }
    });
  }, 100);
}

function stopProgressTracking() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

// In your playAudio function
async function playAudio(audioBlob) {
  const audio = new Audio(URL.createObjectURL(audioBlob));

  audio.addEventListener('play', () => {
    startProgressTracking(audio);
  });

  audio.addEventListener('pause', () => {
    stopProgressTracking();
    chrome.runtime.sendMessage({
      type: 'PLAYBACK_PAUSED',
      payload: { currentTime: audio.currentTime * 1000, timestamp: Date.now() }
    });
  });

  audio.addEventListener('ended', () => {
    stopProgressTracking();
    chrome.runtime.sendMessage({
      type: 'PLAYBACK_STOPPED',
      payload: { reason: 'completed', timestamp: Date.now() }
    });
  });

  await audio.play();
}
```

---

## Testing Checklist

1. **Basic Highlighting**:
   - [ ] Select text with 3+ sentences → right-click "Read Aloud"
   - [ ] Verify first sentence highlights immediately
   - [ ] Verify highlighting moves to next sentences during playback
   - [ ] Verify all highlights removed when playback completes

2. **Auto-scroll**:
   - [ ] Select long text passage (10+ sentences)
   - [ ] Scroll to top of page
   - [ ] Trigger playback
   - [ ] Verify page auto-scrolls to keep highlighted sentence visible

3. **Pause/Resume**:
   - [ ] Start playback → pause mid-sentence
   - [ ] Verify current sentence remains highlighted
   - [ ] Resume playback
   - [ ] Verify highlighting continues from pause point

4. **Speed Changes**:
   - [ ] Start playback at 1x speed
   - [ ] Change to 2x speed mid-playback
   - [ ] Verify highlighting speeds up accordingly
   - [ ] Change to 0.5x speed
   - [ ] Verify highlighting slows down

5. **Edge Cases**:
   - [ ] Very short sentences (1-2 words)
   - [ ] Very long sentences (100+ words)
   - [ ] Text with abbreviations (Dr., Mr., etc.)
   - [ ] Text spanning multiple paragraphs

---

## Troubleshooting

### Highlights not appearing

**Check**:
- Content script loaded? (Check console in page inspection)
- CSS injected? (Look for `#tts-highlight-styles` in DOM)
- Messages received? (Add console.log in message handlers)

### Highlights out of sync with audio

**Check**:
- Progress updates arriving? (Log UPDATE_HIGHLIGHT_PROGRESS frequency)
- Timings calculated correctly? (Log highlightState.timings)
- Playback speed matches? (Verify speed in background vs content script)

### Page layout broken

**Check**:
- Using `<span>` (inline element, not block)?
- CSS has `!important` to override page styles?
- Cleanup removes all spans properly?

---

## Performance Tips

- For passages >100 sentences, implement windowing (keep only 20 spans in DOM)
- Batch DOM updates if highlighting multiple sentences simultaneously
- Use `requestAnimationFrame` for smooth transitions if needed

---

## Next Steps

After completing implementation:
1. Test on 5+ different websites (news, documentation, blogs)
2. Test with all playback speeds (0.5x, 0.75x, 1x, 1.5x, 2x)
3. Test pause/resume extensively
4. Measure performance on long passages (Chrome Task Manager)
5. Create PR and document any edge cases discovered
