# Tasks: Playback Speed Control

**Input**: Design documents from `/specs/005-playback-speed-control/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/messages.md, quickstart.md

**Tests**: Not explicitly requested in specification - tasks focus on implementation and manual testing

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Chrome Extension structure (existing)
- Files: content.js, background.js, offscreen.js, src/api/audio.js, src/utils/storage.js
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing extension is functional and feature 004 (audio playback controls) is complete

**No new project setup needed** - this feature extends existing Chrome extension

- [ ] T001 Verify Chrome extension loads without errors (chrome://extensions/)
- [ ] T002 Verify feature 004 (audio playback controls) is fully functional and tested
- [ ] T003 [P] Review existing AudioPlayer API in src/api/audio.js (pause, resume, stop methods)
- [ ] T004 [P] Review existing control panel implementation in content.js (showControlPanel, hideControlPanel)
- [ ] T005 [P] Review existing message passing patterns in background.js and offscreen.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add core speed control infrastructure that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Add setPlaybackSpeed(rate) method to AudioPlayer class in src/api/audio.js
- [ ] T007 Add speed validation helper (0.5-2.0 range) in src/api/audio.js
- [ ] T008 Add SET_PLAYBACK_SPEED message handler in offscreen.js (call audioPlayer.setPlaybackSpeed)
- [ ] T009 Add CONTROL_SPEED_CHANGED message router in background.js (route to offscreen)
- [ ] T010 Add message validation for speed messages in background.js (validate 0.5-2.0 range)

**Checkpoint**: Foundation ready - AudioPlayer can change speed, messages route correctly

---

## Phase 3: User Story 1 + 2 - Adjust Speed with Presets (Priority: P1) 🎯 MVP

**Goal**: User can adjust playback speed during active playback using 7 preset buttons (0.5x - 2x)

**Independent Test**: Start audio playback, open speed dropdown, click any preset (e.g., 1.5x), verify audio continues at new speed without pausing

### Implementation for User Stories 1 & 2 (Combined MVP)

- [ ] T011 [P] [US1][US2] Define speed preset constants (0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0) in content.js
- [ ] T012 [US1][US2] Add speed control dropdown HTML structure to control panel Shadow DOM in content.js (showControlPanel function)
- [ ] T013 [US1][US2] Add speed control CSS styles to Shadow DOM in content.js (dropdown, presets, hover states, active highlighting)
- [ ] T014 [US1][US2] Add responsive CSS for mobile viewports (centered dropdown, adequate tap targets) in content.js
- [ ] T015 [US2] Create handleSpeedChange(newSpeed) function in content.js (sends CONTROL_SPEED_CHANGED message)
- [ ] T016 [US2] Attach click event listeners to all 7 speed preset buttons in content.js
- [ ] T017 [US2] Add dropdown toggle behavior (open/close on click) in content.js
- [ ] T018 [US1] Create updateSpeedUI(speed) function in content.js (updates toggle display and active preset)
- [ ] T019 [US1][US2] Handle CONTROL_SPEED_CHANGED response in content.js (call updateSpeedUI on success)
- [ ] T020 [US1] Test rapid speed changes (click multiple presets quickly, verify each applies without errors)
- [ ] T021 [US1] Test speed change while audio paused (verify speed applies when resume clicked)
- [ ] T022 [US2] Test all 7 presets individually (0.5x through 2.0x, verify audio speed matches selection)

**Checkpoint**: User can change speed during playback, dropdown UI works, all presets functional. MVP complete.

---

## Phase 4: User Story 3 - Persistent Speed Preference (Priority: P2)

**Goal**: User's preferred speed is remembered across browser sessions and automatically applied to new audio

**Independent Test**: Set speed to 1.5x, close browser completely, reopen, start new audio, verify audio plays at 1.5x

### Implementation for User Story 3

- [ ] T023 [P] [US3] Add getPlaybackSpeed() helper to src/utils/storage.js (reads from chrome.storage.local, defaults to 1.0)
- [ ] T024 [P] [US3] Add setPlaybackSpeed(rate) helper to src/utils/storage.js (writes to chrome.storage.local with key 'playbackSpeed')
- [ ] T025 [US3] Add storage value validation in getPlaybackSpeed (check type, range 0.5-2.0, fallback to 1.0 if invalid)
- [ ] T026 [US3] Modify CONTROL_SPEED_CHANGED handler in background.js to save speed preference (call setPlaybackSpeed)
- [ ] T027 [US3] Modify handleTTSRequest in background.js to load saved speed preference before playback starts
- [ ] T028 [US3] Add initialSpeed parameter to PLAY_AUDIO message payload in background.js
- [ ] T029 [US3] Modify handlePlayAudio in offscreen.js to accept and apply initialSpeed from payload
- [ ] T030 [US3] Modify AUDIO_PLAYBACK_STARTED message in background.js to include currentSpeed in payload
- [ ] T031 [US3] Modify AUDIO_PLAYBACK_STARTED handler in content.js to read currentSpeed and update UI (call updateSpeedUI)
- [ ] T032 [US3] Test persistence across browser restart (set 1.5x, quit Chrome, restart, verify new audio plays at 1.5x)
- [ ] T033 [US3] Test default behavior for first-time user (no saved preference, verify audio starts at 1.0x)
- [ ] T034 [US3] Test preference update (change from 1.0x to 1.5x to 2.0x, verify final preference is 2.0x)
- [ ] T035 [US3] Test corrupted storage value (manually set invalid value, verify fallback to 1.0x with warning logged)

**Checkpoint**: Speed preference persists across sessions, auto-applies on audio start, handles edge cases gracefully.

---

## Phase 5: User Story 4 - Clear Speed Indicator (Priority: P3)

**Goal**: Current playback speed is clearly displayed in the control panel UI

**Independent Test**: Change speed to 1.5x, verify dropdown toggle shows "1.5x", change to 0.75x, verify display updates to "0.75x"

### Implementation for User Story 4

- [ ] T036 [US4] Add speed display element to dropdown toggle button in content.js (e.g., `<span id="speed-current">1x</span>`)
- [ ] T037 [US4] Modify updateSpeedUI function to update speed display text (e.g., "1.5x")
- [ ] T038 [US4] Add visual highlighting to active preset in dropdown menu (CSS class 'active')
- [ ] T039 [US4] Ensure speed indicator updates immediately on speed change (test with all 7 presets)
- [ ] T040 [US4] Test indicator accuracy (verify displayed speed matches actual audio.playbackRate)
- [ ] T041 [US4] Test indicator persistence (pause/resume audio, verify indicator still shows correct speed)

**Checkpoint**: Speed indicator displays current speed accurately, updates instantly, remains consistent across pause/resume.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, error handling, accessibility, performance optimization

- [ ] T042 [P] Add ARIA attributes to dropdown (aria-haspopup, aria-expanded, role="menu")
- [ ] T043 [P] Add ARIA attributes to speed preset buttons (role="menuitem")
- [ ] T044 [P] Test keyboard navigation (Tab to dropdown, Enter to open, Arrow keys to navigate presets, Enter to select)
- [ ] T045 Handle speed change during audio loading (queue speed, apply once audio starts)
- [ ] T046 Handle missing audioPlayer instance (log warning, return error in SET_PLAYBACK_SPEED handler)
- [ ] T047 Add error recovery for storage failures (catch chrome.storage errors, continue with default 1.0x)
- [ ] T048 [P] Add console logging for debugging (speed changes, storage operations, message routing)
- [ ] T049 Test on mobile viewport (verify dropdown doesn't overflow, tap targets adequate)
- [ ] T050 Test on desktop viewport (verify dropdown positioning, hover states work)
- [ ] T051 Test dropdown closes on outside click (click elsewhere on page, verify dropdown closes)
- [ ] T052 Test control panel cleanup (stop audio, verify speed dropdown removed with panel)
- [ ] T053 Verify no memory leaks (check Chrome Task Manager after multiple speed changes)
- [ ] T054 Test integration with pause/resume (verify speed persists across pause/resume cycles)
- [ ] T055 Test integration with stop (verify speed preference saved before audio stops)
- [ ] T056 [P] Performance test: measure dropdown open time (target < 100ms)
- [ ] T057 [P] Performance test: measure speed change application time (target < 100ms)
- [ ] T058 [P] Update CLAUDE.md with new technology (chrome.storage.local for speed preference)
- [ ] T059 Final manual test on 3 different websites (Wikipedia, news site, complex SPA)
- [ ] T060 Final console error check (verify no warnings or errors after full test cycle)

**Checkpoint**: Feature complete, polished, tested across browsers/viewports, ready for production.

---

## Dependencies & Execution Order

### User Story Completion Order

```
Phase 1: Setup (Prerequisites)
  ↓
Phase 2: Foundational Infrastructure
  ↓
Phase 3: US1 + US2 (MVP - Core Speed Control)
  ↓
Phase 4: US3 (Persistence)
  ↓
Phase 5: US4 (Visual Indicator)
  ↓
Phase 6: Polish
```

**Key Dependencies**:
- **US1 + US2 → US3**: Persistence depends on speed control UI and messages working first
- **US1 + US2 → US4**: Visual indicator depends on speed control functionality existing
- **US3 → US4**: No dependency - US4 can be implemented before US3 if desired
- **All Stories → Phase 6**: Polish tasks depend on all stories being functional

### Parallel Execution Opportunities

Within **Phase 2 (Foundational)**:
- T006, T007, T008 can run in parallel (different files)
- T009, T010 can run in parallel after T006-T008 complete

Within **Phase 3 (US1+US2)**:
- T011 and T012 can run in parallel (constants and HTML structure)
- T013 and T014 can run in parallel (desktop and mobile CSS)
- After T012 complete: T015, T016, T017, T018 can run in parallel (all within content.js but different functions)

Within **Phase 4 (US3)**:
- T023 and T024 can run in parallel (storage helpers in same file)
- T026, T027, T028, T029 can run in sequence (message flow changes)
- T032, T033, T034, T035 can run in parallel (independent test scenarios)

Within **Phase 6 (Polish)**:
- T042, T043, T048, T056, T057, T058 can run in parallel (different files or independent tasks)
- Manual tests (T049-T060) can run in any order

---

## Implementation Strategy

### MVP Scope (Recommended First Delivery)

**Deliver only Phase 3 (User Stories 1 & 2)** for fastest value:
- T001-T010: Setup and foundation (10 tasks)
- T011-T022: Core speed control with presets (12 tasks)
- **Total MVP**: 22 tasks

**MVP Delivers**:
- ✅ Adjust playback speed during active playback
- ✅ 7 preset buttons (0.5x - 2x)
- ✅ Dropdown UI in control panel
- ✅ Immediate speed changes without audio interruption

**MVP Excludes** (can add later):
- ❌ Persistence (users set speed each time)
- ❌ Visual indicator (users see presets but no current speed display)
- ❌ Advanced polish (accessibility, edge cases)

### Full Feature Scope

**All Phases**: 60 tasks total
- Phase 1 (Setup): 5 tasks
- Phase 2 (Foundational): 5 tasks
- Phase 3 (US1+US2 MVP): 12 tasks
- Phase 4 (US3 Persistence): 13 tasks
- Phase 5 (US4 Indicator): 6 tasks
- Phase 6 (Polish): 19 tasks

### Incremental Delivery Plan

1. **Week 1**: MVP (Phase 1-3) - 22 tasks → Speed control working
2. **Week 2**: Persistence (Phase 4) - 13 tasks → Preference remembered
3. **Week 3**: Indicator + Polish (Phase 5-6) - 25 tasks → Production-ready

---

## Task Validation Checklist

✅ All tasks follow `- [ ] [ID] [P?] [Story] Description` format
✅ All tasks include file paths where applicable
✅ Tasks organized by user story (independent implementation)
✅ Each user story has independent test criteria
✅ Foundational phase clearly separated from story work
✅ Parallel execution opportunities identified ([P] markers)
✅ MVP scope defined (Phase 1-3, 22 tasks)
✅ Dependencies documented (user story completion order)
✅ Total task count: 60 tasks

---

**Status**: Tasks ready for execution. Recommended approach: Start with MVP (T001-T022) to deliver core value quickly.
