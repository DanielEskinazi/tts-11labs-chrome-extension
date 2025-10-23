# Data Model: Real-time Text Highlighting

**Date**: 2025-10-22 | **Feature**: 007-text-highlighting

## Entity Definitions

### Sentence

A unit of text delimited by sentence-ending punctuation, parsed from the selected text for sequential highlighting.

**Fields**:
- `text`: string - The sentence content
- `startOffset`: number - Character offset in original text where sentence begins
- `endOffset`: number - Character offset in original text where sentence ends
- `index`: number - Sequential index (0-based) in the sentence array

**Validation Rules**:
- `text` MUST be non-empty after trimming whitespace
- `endOffset` MUST be greater than `startOffset`
- `index` MUST be >= 0 and unique within a sentence collection

**State**: Immutable after parsing (no state changes)

**Example**:
```javascript
{
  text: "This is the first sentence",
  startOffset: 0,
  endOffset: 26,
  index: 0
}
```

---

### SentenceTiming

Maps a sentence to its start/end time in the audio playback timeline.

**Fields**:
- `sentenceIndex`: number - References Sentence.index
- `startTime`: number - Time in milliseconds when sentence audio begins
- `endTime`: number - Time in milliseconds when sentence audio ends
- `duration`: number - Calculated as (endTime - startTime)

**Validation Rules**:
- `sentenceIndex` MUST reference a valid Sentence
- `startTime` MUST be >= 0
- `endTime` MUST be > `startTime`
- `duration` MUST be > 0

**State Transitions**:
- Created: After audio duration is known and proportional timing calculated
- Recalculated: When playback speed changes (all timings adjusted by speed factor)

**Example**:
```javascript
{
  sentenceIndex: 0,
  startTime: 0,
  endTime: 2500,      // 2.5 seconds
  duration: 2500
}
```

---

### Highlight

A visual indicator (DOM element) applied to the currently active sentence.

**Fields**:
- `spanElement`: HTMLSpanElement - The `<span>` wrapper containing the highlighted text
- `sentenceIndex`: number - References Sentence.index being highlighted
- `isActive`: boolean - Whether this highlight is currently visible

**Validation Rules**:
- `spanElement` MUST be a valid DOM element in the document
- `spanElement` MUST have className containing 'tts-highlight'
- Only ONE highlight can have `isActive = true` at any time

**State Transitions**:
1. **Created**: When sentence highlighting begins
   - spanElement created and inserted in DOM
   - isActive = true

2. **Deactivated**: When next sentence begins
   - isActive = false
   - spanElement removed from DOM (unwrapped)

3. **Destroyed**: On playback stop/complete
   - All highlights removed
   - spanElements unwrapped

**Example**:
```javascript
{
  spanElement: <span class="tts-highlight">This is highlighted</span>,
  sentenceIndex: 2,
  isActive: true
}
```

---

### HighlightState

Tracks the current state of the highlighting system during playback.

**Fields**:
- `sentences`: Array<Sentence> - All sentences parsed from selected text
- `timings`: Array<SentenceTiming> - Timing map for all sentences
- `currentSentenceIndex`: number | null - Index of currently highlighted sentence (null if not playing)
- `audioDuration`: number - Total audio duration in milliseconds
- `playbackSpeed`: number - Current playback speed (0.5 - 2.0)
- `isPlaying`: boolean - Whether audio is actively playing
- `isPaused`: boolean - Whether audio is paused
- `activeHighlight`: Highlight | null - Currently active highlight element

**Validation Rules**:
- `sentences.length` MUST match `timings.length`
- `currentSentenceIndex` MUST be null OR in range [0, sentences.length - 1]
- `audioDuration` MUST be > 0 when playing
- `playbackSpeed` MUST be in range [0.5, 2.0]
- `isPlaying` and `isPaused` cannot both be true
- `activeHighlight` MUST be null when `isPlaying = false`

**State Transitions**:

```
IDLE (initial)
  → START_PLAYBACK → PLAYING

PLAYING
  → NEXT_SENTENCE → PLAYING (update currentSentenceIndex, activeHighlight)
  → PAUSE → PAUSED
  → STOP → IDLE
  → SPEED_CHANGE → PLAYING (recalculate timings)

PAUSED
  → RESUME → PLAYING
  → STOP → IDLE

IDLE
  → (cleanup all highlights, reset state)
```

**Example**:
```javascript
{
  sentences: [
    { text: "First sentence", startOffset: 0, endOffset: 14, index: 0 },
    { text: "Second sentence", startOffset: 15, endOffset: 30, index: 1 }
  ],
  timings: [
    { sentenceIndex: 0, startTime: 0, endTime: 2000, duration: 2000 },
    { sentenceIndex: 1, startTime: 2000, endTime: 4000, duration: 2000 }
  ],
  currentSentenceIndex: 0,
  audioDuration: 4000,
  playbackSpeed: 1.0,
  isPlaying: true,
  isPaused: false,
  activeHighlight: { spanElement: <span>, sentenceIndex: 0, isActive: true }
}
```

---

## Relationships

```
HighlightState (1) ──has many──> Sentence (N)
HighlightState (1) ──has many──> SentenceTiming (N)
HighlightState (1) ──has one──> Highlight (1) [active]

Sentence (1) <──references── SentenceTiming (1)
Sentence (1) <──references── Highlight (1)

Constraint: sentences.length == timings.length
Constraint: Only one Highlight with isActive=true exists
```

---

## Storage Requirements

**In-Memory Only** (chrome.storage NOT used):
- All entities exist only during active playback session
- Destroyed when playback stops or page unloads
- No persistence needed (highlights are transient visual feedback)

**Size Estimation** (for 100 sentences):
- Sentences: ~100 * 200 bytes = 20KB
- Timings: ~100 * 50 bytes = 5KB
- HighlightState: ~1KB
- Active Highlight: ~0.5KB
- **Total**: ~26.5KB (well within memory constraints)

---

## Data Flow

1. **Text Selection** → Parse into Sentences
2. **Audio Duration Known** → Calculate SentenceTimings
3. **Playback Starts** → Initialize HighlightState (isPlaying=true)
4. **Playback Progress** → Update currentSentenceIndex → Create new Highlight → Remove old Highlight
5. **Speed Change** → Recalculate all SentenceTimings
6. **Playback Stops** → Cleanup all Highlights → Reset HighlightState to IDLE

---

## Implementation Notes

- **Sentence parsing**: Use regex `/[.!?]+\s+/g` (from research.md)
- **Timing calculation**: Proportional based on character count (from research.md)
- **Highlight management**: Windowed approach for >100 sentences (from research.md)
- **DOM cleanup**: Always unwrap spans to restore original DOM structure
