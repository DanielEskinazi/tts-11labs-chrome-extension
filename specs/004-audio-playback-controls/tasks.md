# Tasks: Audio Playback Controls

**Input**: Design documents from `/specs/004-audio-playback-controls/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/messages.md ✓

**Tests**: No automated tests requested - manual testing per quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare development environment and validate existing extension structure

**No new project setup needed** - this feature integrates into existing Chrome extension

- [ ] T001 Verify extension is installed and working (chrome://extensions/)
- [ ] T002 Review existing toast notification Shadow DOM pattern in content.js (lines 135-221)
- [ ] T003 [P] Review existing AudioPlayer API in src/api/audio.js (pause, resume, stop methods)
- [ ] T004 [P] Review existing message passing patterns in background.js (lines 98-166)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core control panel infrastructure and state management that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create control panel Shadow DOM structure in content.js following toast pattern
- [ ] T006 Implement showControlPanel() function with Shadow DOM creation and error handling in content.js
- [ ] T007 Implement hideControlPanel() function with cleanup in content.js
- [ ] T008 Add control panel CSS (dark theme, button styles, animations) to Shadow DOM template in content.js
- [ ] T009 [P] Add message validation utility for control messages in content.js
- [ ] T010 [P] Add isActionPending debounce flag management in content.js
- [ ] T011 Add AUDIO_STATE_CHANGED handler in offscreen.js (wire to audioPlayer.onStatusChange callback)
- [ ] T012 Add AUDIO_STATE_CHANGED router in background.js (translate to content script messages)

**Checkpoint**: Foundation ready - control panel can be created/destroyed, state sync infrastructure exists

---

## Phase 3: User Story 1 - Pause Playing Audio (Priority: P1) 🎯 MVP

**Goal**: User can pause text-to-speech audio playback while preserving position

**Independent Test**: Start TTS audio, click pause button, verify audio stops and button changes to play icon while maintaining playback position

### Implementation for User Story 1

- [ ] T013 [US1] Add pause button to control panel Shadow DOM template in content.js
- [ ] T014 [US1] Implement handleControlPauseClicked() function in content.js (optimistic UI update)
- [ ] T015 [US1] Add CONTROL_PAUSE_CLICKED message handler in background.js (route to offscreen PAUSE_AUDIO)
- [ ] T016 [US1] Add AUDIO_PLAYBACK_PAUSED message handler in content.js (confirm button state)
- [ ] T017 [US1] Implement updateButtonState() function for pause ↔ play toggle in content.js
- [ ] T018 [US1] Add button state validation and error recovery in content.js
- [ ] T019 [US1] Add ARIA labels for pause button accessibility in content.js
- [ ] T020 [US1] Test rapid clicking protection (debounce with isActionPending flag)

**Checkpoint**: User can pause audio and button updates correctly. Position is preserved (verify via resume).

---

## Phase 4: User Story 2 - Resume Paused Audio (Priority: P1) 🎯 MVP

**Goal**: User can resume paused audio from the exact position where it was paused

**Independent Test**: Pause audio, then click play button and verify audio resumes from saved position (not from beginning)

### Implementation for User Story 2

- [ ] T021 [US2] Add play button toggle logic to control panel in content.js (shares element with pause)
- [ ] T022 [US2] Implement handleControlResumeClicked() function in content.js (optimistic UI update)
- [ ] T023 [US2] Add CONTROL_RESUME_CLICKED message handler in background.js (route to offscreen RESUME_AUDIO)
- [ ] T024 [US2] Add AUDIO_PLAYBACK_RESUMED message handler in content.js (confirm button state)
- [ ] T025 [US2] Test pause → resume preserves playback position
- [ ] T026 [US2] Test button icon toggles correctly (⏸ ↔ ▶)
- [ ] T027 [US2] Update ARIA labels for play button accessibility in content.js

**Checkpoint**: User can pause and resume audio. Playback position is maintained across pause/resume cycles.

---

## Phase 5: User Story 3 - Stop Audio Playback (Priority: P2)

**Goal**: User can completely stop audio playback and close controls when done listening

**Independent Test**: Play audio, click stop button, verify audio stops completely and control panel disappears

### Implementation for User Story 3

- [ ] T028 [US3] Add stop button (⏹) to control panel Shadow DOM template in content.js
- [ ] T029 [US3] Implement handleControlStopClicked() function in content.js
- [ ] T030 [US3] Add CONTROL_STOP_CLICKED message handler in background.js (route to offscreen STOP_AUDIO)
- [ ] T031 [US3] Add AUDIO_PLAYBACK_STOPPED message handler in content.js (hide control panel)
- [ ] T032 [US3] Test stop removes control panel completely
- [ ] T033 [US3] Test new audio playback starts fresh after stop
- [ ] T034 [US3] Add ARIA label for stop button accessibility in content.js

**Checkpoint**: User can stop audio and controls disappear. New audio starts from beginning (position reset verified).

---

## Phase 6: User Story 4 - Automatic Control Display (Priority: P2)

**Goal**: Control panel appears automatically when audio playback starts without user action

**Independent Test**: Trigger TTS playback and verify controls appear within 500ms in a visible, non-obstructive location

### Implementation for User Story 4

- [ ] T035 [US4] Add AUDIO_PLAYBACK_STARTED message sender in background.js (after successful PLAY_AUDIO)
- [ ] T036 [US4] Add AUDIO_PLAYBACK_STARTED message handler in content.js (call showControlPanel)
- [ ] T037 [US4] Implement old panel cleanup before creating new panel in content.js (prevent duplicates)
- [ ] T038 [US4] Test control panel appears automatically on audio start
- [ ] T039 [US4] Test only one control panel exists at a time (new audio replaces old controls)
- [ ] T040 [US4] Add timing log to verify panel appears within 500ms

**Checkpoint**: Controls appear automatically when audio starts. Only one control panel visible at any time.

---

## Phase 7: User Story 5 - Automatic Control Hiding (Priority: P3)

**Goal**: Control panel disappears automatically when audio playback ends naturally or is stopped

**Independent Test**: Let audio play to completion or click stop, verify controls disappear automatically

### Implementation for User Story 5

- [ ] T041 [US5] Add AUDIO_PLAYBACK_STOPPED message sender in background.js (on natural audio end)
- [ ] T042 [US5] Wire audioPlayer.onPlaybackEnd callback in offscreen.js to send AUDIO_STATE_CHANGED with status='idle'
- [ ] T043 [US5] Handle 'idle' status in background.js AUDIO_STATE_CHANGED handler (send AUDIO_PLAYBACK_STOPPED with reason='ended')
- [ ] T044 [US5] Test control panel auto-hides when audio ends naturally
- [ ] T045 [US5] Test control panel auto-hides immediately when stop button clicked
- [ ] T046 [US5] Add fade-out animation before removal (optional enhancement)

**Checkpoint**: Controls disappear automatically on audio end (natural or user-stopped). Page layout stays clean.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T047 [P] Add responsive positioning CSS for mobile viewports (≤768px) in content.js Shadow DOM
- [ ] T048 [P] Add keyboard navigation support (Tab to focus, Enter to click) testing
- [ ] T049 Test control panel on multiple websites (Wikipedia, news sites, complex SPAs)
- [ ] T050 Test control panel positioning doesn't obstruct page content
- [ ] T051 [P] Add console logging cleanup (remove debug logs, keep error logs)
- [ ] T052 [P] Verify no memory leaks (heap snapshot before/after audio sessions)
- [ ] T053 Test on different viewport sizes (desktop, tablet, mobile)
- [ ] T054 Verify all ARIA labels present and correct for screen readers
- [ ] T055 Run complete quickstart.md testing checklist (P1, P2, P3 tests)
- [ ] T056 Document any known issues or edge cases discovered during testing

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in priority order (P1 → P1 → P2 → P2 → P3)
  - US1 and US2 form the MVP (pause/resume controls)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after US1 - Shares button toggle logic with pause, tests depend on pause working
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Independent stop button, no dependencies on US1/US2
- **User Story 4 (P2)**: Can start after US1, US2, US3 - Triggers control panel creation for all buttons
- **User Story 5 (P3)**: Can start after US4 - Requires auto-show to be working for auto-hide to make sense

### Within Each User Story

- Control panel foundation (T005-T012) MUST be complete first
- Message handlers before button implementations
- Content script handlers before background routers
- Optimistic UI updates before confirmation handlers
- Core implementation before testing tasks

### Parallel Opportunities

- **Phase 1 Setup**: T003 and T004 (review tasks) can run in parallel
- **Phase 2 Foundational**: T009 and T010 (content script utilities) can run in parallel with T011 and T012 (offscreen/background handlers)
- **Within User Stories**: Most tasks are sequential (button → handler → router → confirmation)
- **Phase 8 Polish**: T047, T048, T051, T052 can all run in parallel (different concerns)

---

## Parallel Example: Foundational Phase

```bash
# Launch content script utilities in parallel:
Task: "Add message validation utility for control messages in content.js"
Task: "Add isActionPending debounce flag management in content.js"

# While simultaneously working on offscreen/background infrastructure:
Task: "Add AUDIO_STATE_CHANGED handler in offscreen.js"
Task: "Add AUDIO_STATE_CHANGED router in background.js"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only - Pause/Resume)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T012) - CRITICAL foundation
3. Complete Phase 3: User Story 1 - Pause (T013-T020)
4. Complete Phase 4: User Story 2 - Resume (T021-T027)
5. **STOP and VALIDATE**: Test pause/resume independently per quickstart.md P1 checklist
6. Deploy/demo pause/resume controls (MVP!)

### Incremental Delivery

1. Complete Setup + Foundational → Control panel infrastructure ready
2. Add US1 (Pause) → Test independently → Basic control appears
3. Add US2 (Resume) → Test independently → Complete pause/resume cycle works (MVP!)
4. Add US3 (Stop) → Test independently → Users can end audio cleanly
5. Add US4 (Auto-show) → Test independently → Controls appear automatically (no manual trigger)
6. Add US5 (Auto-hide) → Test independently → Controls clean up automatically
7. Add Polish → Cross-browser testing, responsive design, accessibility validation

### Suggested Execution Order

**Week 1: MVP (Pause/Resume)**
- Day 1: Phase 1 Setup + Phase 2 Foundational
- Day 2-3: US1 Pause implementation and testing
- Day 4-5: US2 Resume implementation and testing
- Deliverable: Working pause/resume controls

**Week 2: Complete Feature**
- Day 1: US3 Stop implementation
- Day 2: US4 Auto-show implementation
- Day 3: US5 Auto-hide implementation
- Day 4-5: Phase 8 Polish (responsive, accessibility, cross-site testing)
- Deliverable: Full feature with all 5 user stories

---

## Notes

- [P] tasks = different files or independent concerns, no dependencies
- [Story] label maps task to specific user story for traceability
- No new files created - all changes integrate into existing content.js, background.js, offscreen.js
- Control panel created dynamically via Shadow DOM (no separate HTML/CSS files)
- Manual testing per quickstart.md (no automated test suite requested)
- Follow existing toast notification patterns for consistency
- Reuse existing AudioPlayer methods (pause, resume, stop) - no changes to audio.js needed
- Message passing follows established chrome.runtime patterns
- Each user story should be independently testable per quickstart.md checklists
- Verify controls work across different websites (Wikipedia, news sites, etc.)
- Test responsive positioning on mobile and desktop viewports
- Validate accessibility with keyboard navigation and screen readers
