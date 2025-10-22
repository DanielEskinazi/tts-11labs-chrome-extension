# Implementation Plan: Audio Playback Controls

**Branch**: `004-audio-playback-controls` | **Date**: 2025-10-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-audio-playback-controls/spec.md`

## Summary

Add floating audio playback control panel to the Chrome extension that provides pause, resume, and stop functionality for text-to-speech audio. The controls automatically appear when audio starts playing and disappear when audio stops or is manually ended. The control panel uses consistent styling with existing toast notifications and positions itself to minimize content obstruction.

**Technical Approach**: Implement a Shadow DOM-based floating control panel in the content script that communicates with the background service worker (via offscreen document) to control audio playback. Reuse existing toast notification CSS patterns and message passing architecture. Leverage existing AudioPlayer pause/resume/stop methods in the offscreen document.

## Technical Context

**Language/Version**: JavaScript ES2020+ (Chrome extension runtime environment)
**Primary Dependencies**:
- Chrome Extension APIs: chrome.runtime (message passing), chrome.storage (state persistence)
- Existing extension components: AudioPlayer (src/api/audio.js), toast notification system (content.js, toast.css)
- No external libraries required (vanilla JavaScript, Shadow DOM)

**Storage**: chrome.storage.session for transient playback state (if needed across service worker restarts); no persistent storage required
**Testing**: Manual testing in Chrome (chrome://extensions/, test across different websites)
**Target Platform**: Chrome 88+ (Manifest V3 compatible browsers)
**Project Type**: Chrome Extension (content script + background service worker architecture)

**Performance Goals**:
- Control panel appears within 500ms of audio playback starting
- Button clicks respond within 100ms (pause/resume/stop actions)
- No visual jank or layout shift when controls appear/disappear
- Minimal memory footprint (< 100KB additional memory for controls)

**Constraints**:
- Must work across all websites without breaking page layouts
- Must not conflict with page CSS (use Shadow DOM isolation)
- Must handle rapid audio session changes gracefully
- Controls must be accessible on mobile and desktop viewports
- High z-index required to appear above page content

**Scale/Scope**:
- Single floating control panel (one at a time)
- 3 interactive buttons (pause/play toggle, stop)
- Supports single active audio session
- Minimal UI (~50-100 lines CSS, ~100-150 lines JS for controls)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check (Phase 0)

✅ **I. Phase-First Development**
- Plan follows incremental implementation: P1 stories (pause/resume) → P2 stories (stop, auto-show) → P3 (auto-hide)
- Each priority level can be independently tested
- No phase skipping required

✅ **II. Manifest V3 Compliance**
- Uses existing service worker architecture (background.js, offscreen.js)
- No new permissions required (content script already has DOM access)
- Message passing via chrome.runtime.sendMessage (existing pattern)
- No localStorage or blocking API calls introduced

✅ **III. Security & Privacy First**
- No sensitive data handling in controls
- No new network requests or third-party services
- Reuses existing secure message passing
- No data persistence (transient UI state only)

✅ **IV. Chrome Extension Best Practices**
- Content script manages UI injection (control panel)
- Background/offscreen handles audio state (existing AudioPlayer)
- Message passing for pause/resume/stop commands
- Proper cleanup when controls removed (event listener removal)
- Shadow DOM prevents CSS conflicts

✅ **V. Testing Before Proceeding**
- Manual testing plan per priority level (P1 → P2 → P3)
- Test on multiple websites (Wikipedia, news sites, complex SPAs)
- Verify across viewport sizes
- Check console for errors after each increment

**Result**: ✅ ALL GATES PASS - No violations. Proceed to Phase 0.

### Post-Design Check (Phase 1)

*Completed after data-model.md, contracts/, and quickstart.md generation*

✅ **I. Phase-First Development**
- Design documents align with P1 → P2 → P3 incremental implementation
- data-model.md defines testable state transitions for each priority
- Each priority level remains independently implementable

✅ **II. Manifest V3 Compliance**
- Message contracts use chrome.runtime.sendMessage (Manifest V3 compliant)
- No new permissions introduced
- State stored in-memory (content script) or chrome.storage.session (compliant)
- No blocking web requests or persistent background pages

✅ **III. Security & Privacy First**
- Message validation functions defined in contracts/messages.md
- No sensitive data in control panel state
- No external API calls from controls
- XSS protection via HTML escaping in Shadow DOM

✅ **IV. Chrome Extension Best Practices**
- Design follows content script (UI) + background (routing) + offscreen (audio) architecture
- Shadow DOM prevents CSS conflicts with page styles
- Proper cleanup defined in data-model.md lifecycle
- Message contracts follow existing extension patterns
- Event listeners properly removed on control panel destruction

✅ **V. Testing Before Proceeding**
- quickstart.md provides comprehensive testing checklists for each priority (P1: 10 tests, P2: 8 tests, P3: 5 tests)
- Includes debugging guide for all extension contexts
- Common issues and solutions documented
- Performance testing guidance included

**Result**: ✅ ALL GATES PASS - Design complies with all constitution principles. Ready for Phase 2 (`/speckit.tasks`).

## Project Structure

### Documentation (this feature)

```
specs/004-audio-playback-controls/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0: Technology decisions & patterns
├── data-model.md        # Phase 1: Control panel state machine & entities
├── quickstart.md        # Phase 1: Development guide for controls
├── contracts/           # Phase 1: Message contracts for control commands
│   └── messages.md      # Chrome runtime message API contracts
└── tasks.md             # Phase 2: Implementation tasks (/speckit.tasks - NOT created yet)
```

### Source Code (repository root)

```
# Chrome Extension Structure (existing)
/
├── manifest.json           # Extension manifest (no changes needed)
├── background.js           # Background service worker (add control message handlers)
├── offscreen.js            # Offscreen document (audio playback, already has pause/resume/stop)
├── content.js              # Content script (add control panel injection/management)
├── toast.css               # Toast notification styles (reuse for control panel)
├── popup.js                # Extension popup (no changes)
├── popup.html              # Extension popup UI (no changes)
├── popup.css               # Popup styles (no changes)
├── src/
│   ├── api/
│   │   ├── audio.js        # AudioPlayer class (already has pause/resume/stop methods)
│   │   ├── elevenlabs.js   # ElevenLabs API integration (no changes)
│   └── utils/
│       ├── storage.js      # Chrome storage utilities (no changes)
│       └── errors.js       # Error mapping (no changes)
└── icons/                  # Extension icons (no changes)

# New files for this feature:
# - None required (functionality added to existing files)
# - Control panel HTML/CSS injected via Shadow DOM in content.js
# - Message handlers added to existing background.js and offscreen.js
```

**Structure Decision**: This feature integrates into the existing Chrome extension architecture without requiring new files. The control panel UI will be dynamically created and injected by content.js using Shadow DOM (following the same pattern as toast notifications). Audio control logic leverages existing AudioPlayer methods in offscreen.js. Message passing reuses established chrome.runtime patterns between content script, background worker, and offscreen document.

## Complexity Tracking

*No constitution violations detected. This section left empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A       | N/A        | N/A                                  |

## Phase 0: Research & Technology Decisions

### Research Tasks

1. **Shadow DOM Control Panel Patterns**
   - Research: How to create accessible, styled buttons in Shadow DOM
   - Research: Best practices for Shadow DOM event handling in content scripts
   - Research: CSS isolation techniques to prevent page style conflicts
   - **Goal**: Determine optimal Shadow DOM structure for control panel

2. **Playback State Synchronization**
   - Research: How to sync audio playback state (playing/paused/stopped) between offscreen document and content script
   - Research: Message passing patterns for real-time state updates
   - Research: Handling race conditions when user clicks controls rapidly
   - **Goal**: Design reliable state sync mechanism

3. **Control Panel Positioning**
   - Research: CSS positioning strategies for floating panels (fixed vs sticky vs absolute)
   - Research: Viewport-relative positioning to avoid content obstruction
   - Research: Responsive positioning for mobile vs desktop
   - **Goal**: Determine positioning strategy that works across all page layouts

4. **Existing Toast Notification Patterns**
   - Review: content.js toast implementation (Shadow DOM structure, lifecycle)
   - Review: toast.css styling patterns (colors, shadows, animations)
   - Review: How toasts handle show/hide animations
   - **Goal**: Reuse patterns for consistency and code efficiency

5. **Audio Player Integration**
   - Review: AudioPlayer API (pause, resume, stop, getState methods)
   - Review: Existing message handlers in background.js for PAUSE_AUDIO, RESUME_AUDIO, STOP_AUDIO
   - Research: How to detect audio playback state changes (onPlaybackEnd, onStatusChange callbacks)
   - **Goal**: Understand integration points for control panel

**Output**: `research.md` with decisions on Shadow DOM structure, state sync approach, positioning strategy, and integration patterns.

## Phase 1: Design & Contracts

### Data Model

**Output**: `data-model.md` covering:

1. **Control Panel State Machine**
   - States: hidden, showing-playing, showing-paused
   - Transitions: audioStarted → showing-playing, pauseClicked → showing-paused, stopClicked → hidden, audioEnded → hidden
   - State persistence: In-memory only (content script context)

2. **Playback State Entity**
   - Fields: status (playing/paused/stopped), hasActiveSession (boolean)
   - Relationships: Maps to AudioPlayer state in offscreen document
   - Validation: Status must be one of enum values

3. **Control Panel UI Entity**
   - Fields: visibility (boolean), currentButton (pause/play), position (CSS coordinates)
   - Relationships: Reflects Playback State
   - Lifecycle: Created on audio start, destroyed on audio stop

### API Contracts

**Output**: `contracts/messages.md` covering Chrome runtime messages:

1. **AUDIO_PLAYBACK_STARTED** (background → content)
   - Trigger: When audio begins playing after TTS request succeeds
   - Payload: `{ sessionId: string, duration: number }` (optional metadata)
   - Response: None (one-way notification)
   - Content script action: Show control panel in "playing" state

2. **AUDIO_PLAYBACK_PAUSED** (background → content)
   - Trigger: When audio successfully pauses (confirmation)
   - Payload: `{ currentPosition: number }`
   - Response: None
   - Content script action: Update control panel to "paused" state (show play button)

3. **AUDIO_PLAYBACK_RESUMED** (background → content)
   - Trigger: When audio successfully resumes (confirmation)
   - Payload: `{ currentPosition: number }`
   - Response: None
   - Content script action: Update control panel to "playing" state (show pause button)

4. **AUDIO_PLAYBACK_STOPPED** (background → content)
   - Trigger: When audio stops (user action or natural end)
   - Payload: `{ reason: 'user' | 'ended' | 'error' }`
   - Response: None
   - Content script action: Hide control panel

5. **CONTROL_PAUSE_CLICKED** (content → background)
   - Trigger: User clicks pause button
   - Payload: `{ timestamp: number }`
   - Response: `{ success: boolean, error?: string }`
   - Background action: Forward to offscreen, call audioPlayer.pause()

6. **CONTROL_RESUME_CLICKED** (content → background)
   - Trigger: User clicks play/resume button
   - Payload: `{ timestamp: number }`
   - Response: `{ success: boolean, error?: string }`
   - Background action: Forward to offscreen, call audioPlayer.resume()

7. **CONTROL_STOP_CLICKED** (content → background)
   - Trigger: User clicks stop button
   - Payload: `{ timestamp: number }`
   - Response: `{ success: boolean, error?: string }`
   - Background action: Forward to offscreen, call audioPlayer.stop(), cleanup resources

### Quickstart Guide

**Output**: `quickstart.md` with:
- Local development setup (already installed extension)
- How to test control panel in isolation
- Debugging message passing with Chrome DevTools
- Testing checklist for each priority level (P1, P2, P3)
- Common issues and solutions

### Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` to add:
- Shadow DOM control panel pattern
- Audio playback state synchronization
- Chrome runtime message contracts for controls

**Note**: This feature adds minimal new technology (reuses existing patterns). Update will primarily document the control panel component structure.

---

**Phase 1 Complete**: After generating data-model.md, contracts/, and quickstart.md, re-run Constitution Check to verify design compliance. Then proceed to Phase 2 (`/speckit.tasks`) for implementation task generation.
