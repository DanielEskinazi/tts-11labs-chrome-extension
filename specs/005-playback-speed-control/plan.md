# Implementation Plan: Playback Speed Control

**Branch**: `005-playback-speed-control` | **Date**: 2025-10-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-playback-speed-control/spec.md`

## Summary

Add playback speed control to the audio control panel, allowing users to adjust TTS playback speed from 0.5x to 2x with quick access to 7 common presets. Speed changes apply immediately during playback without interruption, and the user's preferred speed is persisted across browser sessions using chrome.storage.local.

**Technical Approach**: Extend the existing audio control panel (feature 004) with a compact speed control UI (dropdown or button group). Leverage browser's native HTMLAudioElement.playbackRate API for speed adjustment. Store user preference in chrome.storage.local and apply automatically when new audio loads. Integrate with existing message passing architecture to sync speed changes between content script, background, and offscreen document.

## Technical Context

**Language/Version**: JavaScript ES2020+ (Chrome extension runtime environment)

**Primary Dependencies**:
- Chrome Extension APIs: chrome.storage.local (persist speed preference), chrome.runtime (message passing)
- Existing extension components: AudioPlayer (src/api/audio.js), audio control panel (content.js from feature 004), offscreen document (offscreen.js)
- Browser API: HTMLAudioElement.playbackRate (standard, no polyfill needed)
- No external libraries required (vanilla JavaScript, CSS)

**Storage**: chrome.storage.local for persistent speed preference (key: `playbackSpeed`, value: 0.5-2.0)

**Testing**: Manual testing in Chrome (verify speed changes during playback, test persistence across sessions, validate preset buttons/dropdown)

**Target Platform**: Chrome 88+ (Manifest V3 compatible browsers with HTMLAudioElement.playbackRate support)

**Project Type**: Chrome Extension (extends existing content script + background service worker + offscreen architecture)

**Performance Goals**:
- Speed control accessible within 2 seconds (user can find and click within control panel)
- Speed changes apply within 100ms (browser's playbackRate property changes instantly)
- UI updates (button state, indicator) complete within 50ms
- Storage read/write operations non-blocking (async chrome.storage.local API)

**Constraints**:
- Must fit within existing control panel layout (limited space)
- Must not cause layout shift or overflow on mobile viewports
- Speed changes must not interrupt audio (no pause/resume/restart)
- Must validate speed values (reject outside 0.5x-2x range)
- Must handle edge cases (speed change during loading, corrupted storage values)

**Scale/Scope**:
- 7 speed presets (0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x)
- Single persistent preference per user (global, not per-audio-file)
- Compact UI addition to existing control panel (~30-50 lines CSS, ~80-120 lines JS)
- 1 new storage key in chrome.storage.local
- 3-4 new message types for speed control communication

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check (Phase 0)

✅ **I. Phase-First Development**
- Plan follows incremental implementation: P1 stories (adjust speed + presets) → P2 (persistence) → P3 (visual indicator)
- Each priority level can be independently tested
- P1 delivers core value (speed control), P2 adds convenience, P3 adds polish
- No phase skipping required

✅ **II. Manifest V3 Compliance**
- Uses existing service worker architecture (background.js, offscreen.js)
- No new permissions required (chrome.storage already declared, content script has DOM access)
- chrome.storage.local is Manifest V3 compliant (async API)
- Message passing via chrome.runtime.sendMessage (existing pattern)
- No localStorage or blocking API calls introduced

✅ **III. Security & Privacy First**
- Speed preference is non-sensitive user setting
- No new network requests or third-party services
- Stored value validated (0.5-2.0 range) before use
- No data transmission (stored locally only)
- Reuses existing secure message passing

✅ **IV. Chrome Extension Best Practices**
- Content script manages UI (speed control in existing panel)
- Offscreen document applies speed (audioPlayer.audio.playbackRate)
- Background routes messages and manages storage
- Proper cleanup when controls removed (existing hideControlPanel logic)
- No additional memory footprint (speed value is primitive)

✅ **V. Testing Before Proceeding**
- Manual testing plan per priority level (P1 → P2 → P3)
- Test speed changes during active playback
- Verify each preset button/option
- Test persistence across browser restarts
- Validate edge cases (invalid values, rapid changes)
- Check console for errors after each increment

**Result**: ✅ ALL GATES PASS - No violations. Proceed to Phase 0.

### Post-Design Check (Phase 1)

*Completed after data-model.md, contracts/, and quickstart.md generation*

✅ **I. Phase-First Development**
- Design documents support P1 → P2 → P3 incremental implementation
- data-model.md defines Speed Preference entity and state transitions
- quickstart.md provides phase-by-phase implementation checklist
- Each priority level remains independently testable (P1 core functionality, P2 adds persistence, P3 adds polish)

✅ **II. Manifest V3 Compliance**
- Message contracts use chrome.runtime.sendMessage (Manifest V3 compliant)
- chrome.storage.local is async API (service worker compatible)
- No new permissions required (storage already declared, content script has DOM access)
- No localStorage or persistent background pages
- HTMLAudioElement.playbackRate is standard browser API (no compatibility issues)

✅ **III. Security & Privacy First**
- Speed preference is non-sensitive user setting (no PII)
- Message validation defined in contracts/messages.md (validateSpeedMessage helper)
- Storage values validated before use (0.5-2.0 range check, fallback to 1.0)
- No external API calls or third-party services
- No data transmission outside browser

✅ **IV. Chrome Extension Best Practices**
- Content script manages UI (speed dropdown in existing control panel)
- Offscreen document applies speed (audioPlayer.setPlaybackSpeed method)
- Background routes messages and manages storage (centralized state)
- Proper cleanup in hideControlPanel (speed dropdown removed with panel)
- Minimal memory footprint (primitive value, no objects retained)

✅ **V. Testing Before Proceeding**
- quickstart.md provides comprehensive manual testing guide
- Test scenarios defined in contracts/messages.md (happy path, error paths, edge cases)
- Each priority level has independent test checklist
- Console logging for debugging at each integration point

**Result**: ✅ ALL GATES PASS - Design maintains constitution compliance. Ready for Phase 2 (/speckit.tasks).

## Project Structure

### Documentation (this feature)

```
specs/005-playback-speed-control/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── messages.md      # Message contracts for speed control
├── checklists/          # Quality validation (already exists)
│   └── requirements.md  # Spec validation checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Chrome Extension Structure (existing, extending feature 004)

content.js               # MODIFY: Add speed control UI to existing control panel
offscreen.js             # MODIFY: Add SET_PLAYBACK_SPEED handler
background.js            # MODIFY: Add CONTROL_SPEED_CHANGED message router, storage read/write
src/api/audio.js         # MODIFY: Add setPlaybackSpeed(rate) method to AudioPlayer class
src/utils/storage.js     # MODIFY: Add getPlaybackSpeed() and setPlaybackSpeed(rate) helpers

# No new files required - extends existing architecture
```

**Structure Decision**: This feature extends the existing Chrome extension architecture from feature 004 (audio playback controls). Speed control is added to the existing floating control panel in content.js, AudioPlayer gains a setPlaybackSpeed method, and storage utilities handle preference persistence. No new structural components needed - fully integrates with established patterns.

## Complexity Tracking

*No constitution violations - this section intentionally left empty.*

This feature aligns perfectly with all constitution principles. It extends existing components incrementally, maintains Manifest V3 compliance, adds no security concerns, follows established Chrome extension patterns, and can be tested manually at each priority level.
