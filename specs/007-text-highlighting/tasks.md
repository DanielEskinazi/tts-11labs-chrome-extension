# Tasks: Real-time Text Highlighting

**Input**: Design documents from `/specs/007-text-highlighting/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual testing only (no automated test tasks - tests not requested in specification)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Chrome extension with flat structure
- Root files: manifest.json, content.js, background.js, offscreen.js, popup.*
- Utilities: src/utils/, src/api/
- Specs: specs/007-text-highlighting/

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No additional setup needed - extension already initialized with all required permissions

**Note**: The extension already has content script access and message passing infrastructure. No manifest.json changes or new permissions needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core text parsing and timing utilities that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T001 [P] Create splitIntoSentences() function in src/utils/textUtils.js using regex /[.!?]+\s+/g
- [ ] T002 [P] Create calculateSentenceTimings() function in src/utils/textUtils.js for proportional timing
- [ ] T003 [P] Add CSS highlight styles injection function in content.js (.tts-highlight class)
- [ ] T004 Add HighlightState initialization in content.js with all entity fields from data-model.md

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Sentence Highlighting During Playback (Priority: P1) 🎯 MVP

**Goal**: Highlight each sentence sequentially as audio plays, with smooth transitions between sentences

**Independent Test**: Select text → trigger playback → verify each sentence highlights in sequence → verify highlights clear on stop

### Implementation for User Story 1

- [ ] T005 [P] [US1] Add highlightSentence() function in content.js that wraps text in <span> with highlight class
- [ ] T006 [P] [US1] Add removeHighlight() function in content.js that unwraps span and restores original text
- [ ] T007 [US1] Add START_HIGHLIGHTING message handler in content.js that parses sentences and initializes timings
- [ ] T008 [US1] Add UPDATE_HIGHLIGHT_PROGRESS message handler in content.js that checks current time vs sentence timings
- [ ] T009 [US1] Add PLAYBACK_STOPPED message handler in content.js that calls cleanupHighlights()
- [ ] T010 [US1] Add PLAYBACK_PAUSED message handler in content.js that preserves current highlight
- [ ] T011 [US1] Add PLAYBACK_RESUMED message handler in content.js that continues highlighting
- [ ] T012 [US1] Modify background.js context menu handler to send START_HIGHLIGHTING message with text, audioDuration, playbackSpeed
- [ ] T013 [US1] Modify offscreen.js audio playback to send UPDATE_HIGHLIGHT_PROGRESS every 100ms during playback
- [ ] T014 [US1] Modify offscreen.js pause event to send PLAYBACK_PAUSED message
- [ ] T015 [US1] Modify offscreen.js resume/play event to send PLAYBACK_RESUMED message
- [ ] T016 [US1] Modify offscreen.js stop/ended event to send PLAYBACK_STOPPED message

**Manual Test Checklist for User Story 1**:
- [ ] Select text with 3+ sentences → right-click "Read Aloud" → first sentence highlights immediately
- [ ] Highlighting progresses sequentially through sentences as audio plays
- [ ] Previous highlight removed when moving to next sentence
- [ ] Pause playback → current sentence stays highlighted
- [ ] Resume playback → highlighting continues from current position
- [ ] Stop playback OR audio completes → all highlights removed
- [ ] Console shows no errors during highlighting operations

**Checkpoint**: At this point, User Story 1 should be fully functional - basic sentence highlighting works

---

## Phase 4: User Story 2 - Auto-scroll to Highlighted Text (Priority: P2)

**Goal**: Automatically scroll page to keep currently highlighted sentence visible in viewport

**Independent Test**: Select long text passage (10+ sentences) → scroll to top → trigger playback → verify page auto-scrolls to highlighted sentences

### Implementation for User Story 2

- [ ] T017 [P] [US2] Add scrollToHighlightIfNeeded() function in content.js using element.scrollIntoView()
- [ ] T018 [P] [US2] Add isElementInViewport() helper function in content.js to check visibility
- [ ] T019 [US2] Modify highlightSentence() in content.js to call scrollToHighlightIfNeeded() after creating highlight
- [ ] T020 [US2] Configure scrollIntoView with behavior: 'smooth', block: 'center' for optimal positioning

**Manual Test Checklist for User Story 2**:
- [ ] Select long passage (10+ sentences) spanning multiple screens
- [ ] Scroll to page top before triggering playback
- [ ] Verify page auto-scrolls smoothly to keep highlighted sentence centered in viewport
- [ ] Verify no unnecessary scrolling when sentence already visible
- [ ] Manually scroll during playback → next sentence auto-scroll still works
- [ ] Auto-scroll is smooth (no jarring jumps) at behavior: 'smooth'

**Checkpoint**: At this point, User Stories 1 AND 2 should work together - highlighting with auto-scroll

---

## Phase 5: User Story 3 - Playback Speed Integration (Priority: P2)

**Goal**: Adjust sentence highlighting timing dynamically when playback speed changes

**Independent Test**: Start playback → change speed to 2x → verify highlighting speeds up → change to 0.5x → verify highlighting slows down

### Implementation for User Story 3

- [ ] T021 [P] [US3] Add SPEED_CHANGED message handler in content.js
- [ ] T022 [US3] Implement timing recalculation logic in SPEED_CHANGED handler using calculateSentenceTimings()
- [ ] T023 [US3] Modify background.js speed change handler to send SPEED_CHANGED message to content script
- [ ] T024 [US3] Add currentTime parameter to SPEED_CHANGED message for accurate resync after recalculation

**Manual Test Checklist for User Story 3**:
- [ ] Start playback at 1x speed → verify normal highlighting progression
- [ ] Change to 2x speed mid-playback → verify highlighting speeds up (sentences change twice as fast)
- [ ] Change to 0.5x speed mid-playback → verify highlighting slows down (sentences change half as fast)
- [ ] Rapid speed changes (1x → 2x → 0.5x) → highlighting stays synchronized
- [ ] Speed change during pause → resume → highlighting uses new speed
- [ ] Console shows successful timing recalculation messages

**Checkpoint**: All user stories should now be independently functional - complete highlighting feature

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validations

- [ ] T025 [P] Add error handling in content.js for DOM mutation scenarios (graceful degradation)
- [ ] T026 [P] Add defensive checks in highlightSentence() for invalid sentence indices
- [ ] T027 Add memory cleanup verification: test 20+ playback cycles and check Chrome Task Manager
- [ ] T028 Add performance optimization: implement sentence windowing for passages >100 sentences
- [ ] T029 Test edge cases: very short sentences (1-2 words), very long sentences (100+ words)
- [ ] T030 Test cross-website compatibility: news sites, documentation, blogs (3+ different sites)
- [ ] T031 Add console logging for debugging: highlight start/stop, sentence transitions, timing calculations
- [ ] T032 Verify cleanupHighlights() properly unwraps all spans and restores original DOM
- [ ] T033 Test with dynamic content: pages that modify DOM during playback
- [ ] T034 Run all manual test checklists from quickstart.md
- [ ] T035 Validate message contracts: verify all 6 message types send/receive correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A - No setup needed (extension already configured)
- **Foundational (Phase 2)**: No dependencies - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (Phase 3) can start after Foundational - No dependencies on other stories
  - User Story 2 (Phase 4) depends on US1 completion (needs highlightSentence() to exist)
  - User Story 3 (Phase 5) depends on US1 completion (needs timing system to exist)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (needs highlighting infrastructure) - Enhancement to US1
- **User Story 3 (P2)**: Depends on US1 (needs timing system) - Enhancement to US1

**Rationale**: US1 must be complete first as it provides the core highlighting infrastructure. US2 and US3 are enhancements that could potentially run in parallel after US1 is done, but US2→US3 sequential order is recommended for testing clarity.

### Within Each User Story

**Foundational (Phase 2)**:
- T001-T002: Text utilities in parallel (different functions in same file)
- T003-T004: Content script setup in parallel with text utilities

**User Story 1 (Phase 3)**:
- T005-T006: Highlight manipulation functions in parallel (different functions)
- T007-T011: Message handlers in parallel (different handlers)
- T012-T016: Background/offscreen modifications in parallel (different files)
- All tasks within US1 can execute in parallel as they touch different functions/files

**User Story 2 (Phase 4)**:
- T017-T018: Helper functions in parallel
- T019-T020: Sequential (modify existing highlightSentence function)

**User Story 3 (Phase 5)**:
- T021-T022: Content script changes in parallel (different message handler)
- T023-T024: Background script changes in parallel (different file)

### Parallel Opportunities

**Foundational Phase (Phase 2)**:
- T001 & T002: Both utility functions can be developed in parallel
- T003 & T004: Content script functions can be developed in parallel

**User Story 1 (Phase 3)**:
- T005 & T006: Highlight functions in parallel
- T007-T011: All message handlers in parallel (different switch cases)
- T012-T016: Background and offscreen modifications in parallel (different files)

**User Story 2 (Phase 4)**:
- T017 & T018: Helper functions in parallel

**User Story 3 (Phase 5)**:
- T021 & T022: SPEED_CHANGED handler in parallel with timing logic
- T023 & T024: Background modification in parallel with message structure

**Polish Phase (Phase 6)**:
- T025 & T026: Error handling tasks in parallel (different functions)
- T029-T034: All testing tasks can run in parallel (different test scenarios)

---

## Parallel Example: Foundational Phase

```bash
# Launch text utilities together:
Task: "Create splitIntoSentences() function in src/utils/textUtils.js"
Task: "Create calculateSentenceTimings() function in src/utils/textUtils.js"

# In parallel, set up content script:
Task: "Add CSS highlight styles injection in content.js"
Task: "Add HighlightState initialization in content.js"
```

---

## Parallel Example: User Story 1

```bash
# Launch highlight manipulation functions together:
Task: "Add highlightSentence() function in content.js"
Task: "Add removeHighlight() function in content.js"

# Launch all message handlers together:
Task: "Add START_HIGHLIGHTING message handler in content.js"
Task: "Add UPDATE_HIGHLIGHT_PROGRESS message handler in content.js"
Task: "Add PLAYBACK_STOPPED message handler in content.js"
Task: "Add PLAYBACK_PAUSED message handler in content.js"
Task: "Add PLAYBACK_RESUMED message handler in content.js"

# In parallel, modify background and offscreen:
Task: "Modify background.js context menu handler"
Task: "Modify offscreen.js audio playback for progress updates"
Task: "Modify offscreen.js pause event"
Task: "Modify offscreen.js resume/play event"
Task: "Modify offscreen.js stop/ended event"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**MVP = Basic Sentence Highlighting**

1. Complete Phase 2: Foundational (T001-T004)
2. Complete Phase 3: User Story 1 (T005-T016)
3. **STOP and VALIDATE**:
   - Test highlighting on 3 different websites
   - Test pause/resume behavior
   - Verify cleanup on stop
4. Deploy/demo MVP

**Estimated Time**: 1.5-2 hours for MVP

### Full Feature Delivery

1. Complete Foundational (Phase 2) → Test utilities → ~30 minutes
2. Add User Story 1 (Phase 3) → Test independently → ~90 minutes
3. Add User Story 2 (Phase 4) → Test auto-scroll → +30 minutes
4. Add User Story 3 (Phase 5) → Test speed integration → +30 minutes
5. Add Polish (Phase 6) → Final validation → +45 minutes
6. **Total**: 3.5-4 hours for complete feature

### Incremental Delivery

1. **Milestone 1 (MVP)**: Foundational + US1
   - Basic sentence highlighting works
   - Pause/resume works
   - Cleanup on stop works
   - Deploy/Demo ✅

2. **Milestone 2 (Enhanced)**: Add US2
   - Auto-scroll for long passages
   - Better UX for long-form content
   - Deploy/Demo ✅

3. **Milestone 3 (Complete)**: Add US3
   - Speed integration
   - Highlighting adjusts to playback speed
   - Deploy/Demo ✅

4. **Milestone 4 (Polished)**: Add error handling and edge case coverage
   - Robust implementation
   - Production-ready
   - Deploy/Demo ✅

---

## Notes

- [P] tasks = different files or different functions, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Manual testing after each phase checkpoint
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No automated tests generated - spec does not request test implementation
- All testing is manual via Chrome browser (per constitution requirement)

---

## Task Summary

**Total Tasks**: 35

**By Phase**:
- Phase 1 (Setup): 0 tasks (no setup needed)
- Phase 2 (Foundational): 4 tasks (T001-T004)
- Phase 3 (US1 - Sentence Highlighting): 12 tasks (T005-T016)
- Phase 4 (US2 - Auto-scroll): 4 tasks (T017-T020)
- Phase 5 (US3 - Speed Integration): 4 tasks (T021-T024)
- Phase 6 (Polish): 11 tasks (T025-T035)

**By User Story**:
- User Story 1 (P1): 12 tasks
- User Story 2 (P2): 4 tasks
- User Story 3 (P2): 4 tasks
- Foundational: 4 tasks
- Polish: 11 tasks

**Parallel Opportunities Identified**: 18 tasks marked [P]

**MVP Scope**: Phase 2 + Phase 3 = 16 tasks (~2 hours)

**Independent Test Criteria**:
- US1: Highlighting progresses through sentences, pause/resume works, cleanup on stop
- US2: Auto-scroll keeps highlighted text visible for long passages
- US3: Highlighting timing adjusts when playback speed changes

**Success Criteria Validation**:
- SC-001: <200ms sync accuracy - Test in Phase 3
- SC-002: Smooth transitions - Test in Phase 3
- SC-003: Auto-scroll 100% visible - Test in Phase 4
- SC-004: No layout breakage - Test in Phase 6
- SC-005: Pause/resume works - Test in Phase 3
- SC-006: <100ms cleanup - Test in Phase 3 & 6
