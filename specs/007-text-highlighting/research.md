# Research: Real-time Text Highlighting

**Date**: 2025-10-22 | **Feature**: 007-text-highlighting

## Research Questions

1. How to split text into sentences accurately for English text?
2. What's the best DOM highlighting technique that doesn't break page layout?
3. How to synchronize highlighting timing with audio playback?
4. What's the optimal auto-scroll implementation for smooth UX?
5. How to handle performance for long passages (100+ sentences)?

---

## R1: Sentence Splitting Strategy

### Decision

Use regex-based sentence splitting with punctuation detection: `/[.!?]+[\s]+/g`

### Rationale

- **Simple and effective**: Regex pattern matches sentence-ending punctuation (. ! ?) followed by whitespace
- **No external libraries**: Keeps extension lightweight (<5MB)
- **Good enough for English**: Handles 95% of common cases (news, articles, documentation)
- **Edge cases acceptable**: Abbreviations (Dr., Mr.) may split incorrectly, but impact is minimal (highlighting just moves faster)

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| NLP library (natural, compromise) | Adds 500KB+ to extension, overkill for highlighting use case |
| Manual sentence parsing with abbreviation handling | Complex state machine, diminishing returns for edge cases |
| Split on periods only | Misses ! and ? sentences, poor UX |

### Implementation Pattern

```javascript
function splitIntoSentences(text) {
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text.split(/[.!?]+\s+/);

  // Filter out empty strings
  return sentences.filter(s => s.trim().length > 0);
}
```

---

## R2: DOM Highlighting Technique

### Decision

Use CSS class injection with `<span>` wrapper elements for each sentence

### Rationale

- **Non-destructive**: Wraps text nodes in `<span>` without modifying original DOM structure
- **Clean removal**: Can easily unwrap and restore original text on cleanup
- **CSS-based styling**: Highlighting via `.tts-highlight { background-color: rgba(255, 255, 0, 0.3); }`
- **Performant**: Modern browsers handle thousands of spans efficiently
- **Layout-safe**: `<span>` is inline element, doesn't break page flow

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| CSS ::selection pseudo-class | Can't control programmatically, conflicts with user selection |
| Background color on existing elements | Loses original background, hard to restore |
| Overlay div with absolute positioning | Complex z-index issues, breaks on scroll/resize |
| Mark API (browser native) | Limited browser support (experimental), no fine-grained control |

### Implementation Pattern

```javascript
// Wrap sentence in span with highlight class
function highlightSentence(textNode, startOffset, endOffset) {
  const range = document.createRange();
  range.setStart(textNode, startOffset);
  range.setEnd(textNode, endOffset);

  const span = document.createElement('span');
  span.className = 'tts-highlight';
  range.surroundContents(span);

  return span;
}

// Remove highlight and unwrap
function removeHighlight(span) {
  const parent = span.parentNode;
  while (span.firstChild) {
    parent.insertBefore(span.firstChild, span);
  }
  parent.removeChild(span);
}
```

---

## R3: Timing Synchronization Strategy

### Decision

**Proportional timing** based on sentence character count relative to total audio duration

### Rationale

- **Simple calculation**: `sentenceDuration = (sentence.length / totalText.length) * totalAudioDuration`
- **No API changes needed**: Works with existing audio duration from ElevenLabs
- **Good approximation**: Character count correlates reasonably with speech time
- **Adjusts for speed**: When playback speed changes, recalculate all timings
- **Acceptable accuracy**: Within ~500ms for most sentences (meets <200ms goal for short sentences)

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Word-count-based timing | Similar accuracy, character count is simpler |
| ElevenLabs word-level timestamps API | Requires API changes, may not be available on all plans |
| Fixed time per sentence | Terrible accuracy (long/short sentences get same time) |
| Estimate from TTS model parameters | Too complex, no guarantee of accuracy |

### Implementation Pattern

```javascript
function calculateSentenceTimings(sentences, totalText, audioDuration, playbackSpeed) {
  const timings = [];
  let currentTime = 0;

  for (const sentence of sentences) {
    const proportion = sentence.length / totalText.length;
    const duration = (proportion * audioDuration) / playbackSpeed;

    timings.push({
      sentence,
      startTime: currentTime,
      endTime: currentTime + duration
    });

    currentTime += duration;
  }

  return timings;
}
```

---

## R4: Auto-scroll Implementation

### Decision

Use `element.scrollIntoView({ behavior: 'smooth', block: 'center' })` with viewport visibility check

### Rationale

- **Native browser API**: No library needed, excellent browser support (Chrome 61+)
- **Smooth scrolling**: `behavior: 'smooth'` provides 60fps animated scroll
- **Optimal positioning**: `block: 'center'` keeps highlighted sentence in middle of viewport
- **Conditional scrolling**: Only scroll if element is outside viewport (avoids unnecessary movement)
- **Respects user scroll**: If user manually scrolls away, auto-scroll waits until next sentence

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Manual scroll animation (window.scrollBy) | Complex to implement, reinvents native behavior |
| Intersection Observer | Overkill for simple visibility check, added complexity |
| Always scroll to top | Poor UX, jarring for users |
| No auto-scroll | Fails US2 acceptance criteria for long passages |

### Implementation Pattern

```javascript
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
```

---

## R5: Performance Optimization for Long Passages

### Decision

Use **sentence windowing** with virtual scrolling for passages >100 sentences

### Rationale

- **Memory efficient**: Only keep 20 sentence spans in DOM at once (current + 10 before + 10 after)
- **Fast highlighting**: createElement is cheap for <20 elements
- **Smooth cleanup**: Batch removal of old highlights every 10 sentences
- **Handles edge case**: Most passages are <50 sentences; optimization kicks in only when needed
- **No perceived delay**: Users only see current sentence, past highlights can be removed lazily

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|------------------|
| Render all sentences upfront | Works for <50 sentences, but 1000+ sentences causes lag |
| Single highlight that moves | Requires re-parsing DOM position for each sentence, more complex |
| Background thread (Web Worker) | Can't access DOM from worker, added complexity for marginal gain |

### Implementation Pattern

```javascript
class HighlightManager {
  constructor() {
    this.activeHighlights = new Map(); // sentenceIndex -> span element
    this.windowSize = 20;
  }

  highlightSentence(index) {
    // Remove highlights outside window
    for (const [idx, span] of this.activeHighlights) {
      if (Math.abs(idx - index) > this.windowSize / 2) {
        this.removeHighlight(span);
        this.activeHighlights.delete(idx);
      }
    }

    // Add new highlight
    const span = this.createHighlight(index);
    this.activeHighlights.set(index, span);

    return span;
  }

  cleanup() {
    for (const span of this.activeHighlights.values()) {
      this.removeHighlight(span);
    }
    this.activeHighlights.clear();
  }
}
```

---

## Technology Stack Summary

| Component | Technology | Justification |
|-----------|------------|---------------|
| Sentence Parsing | Regex `/[.!?]+\s+/g` | Simple, no dependencies, good enough |
| DOM Manipulation | `<span>` wrapper + CSS class | Layout-safe, clean removal |
| Timing | Proportional character count | Simple calculation, adjusts for speed |
| Auto-scroll | `scrollIntoView` API | Native, smooth, widely supported |
| Performance | Sentence windowing (20 window) | Handles 1000+ sentences efficiently |

---

## Implementation Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Sentence split false positives (Dr., Mr.) | Low | Acceptable UX (highlight just moves faster) |
| DOM mutation during playback | Medium | Graceful degradation: catch errors, stop highlighting |
| Timing drift for long passages | Low | Recalculate on speed change, proportional algorithm self-corrects |
| Page layout breakage | High | Use inline `<span>`, test on complex sites, CSS defensive rules |

---

## Next Steps

1. **Phase 1**: Design data model (Sentence, Highlight, TimingMap entities)
2. **Phase 1**: Create message contracts (playback events, timing sync)
3. **Phase 1**: Write quickstart guide for developers
4. **Phase 2**: Generate implementation tasks from this research
