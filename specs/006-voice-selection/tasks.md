# Tasks: Voice Selection

**Input**: Design documents from `/specs/006-voice-selection/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Manual testing only (no automated test tasks - tests not requested in specification)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Chrome extension with flat structure
- Root files: manifest.json, popup.html, popup.js, popup.css, background.js, offscreen.js, content.js
- Utilities: src/api/, src/utils/

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No additional setup needed - extension already initialized with all required permissions

**Note**: The extension already has chrome.storage.local and offscreen permissions. No manifest.json changes needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core voice infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T001 [P] Add getVoicePreference() function to src/utils/storage.js
- [ ] T002 [P] Add setVoicePreference() function to src/utils/storage.js
- [ ] T003 [P] Add getVoiceCache() function with 24-hour TTL validation to src/utils/storage.js
- [ ] T004 [P] Add setVoiceCache() function to src/utils/storage.js
- [ ] T005 Add getVoices() function to src/api/elevenlabs.js for GET /v1/voices endpoint
- [ ] T006 Add formatVoiceLabel() utility function to popup.js for dropdown labels

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View and Select Voice (Priority: P1) 🎯 MVP

**Goal**: Users can view available voices in a dropdown, select a voice, and have their selection automatically saved and persisted across browser sessions

**Independent Test**: Open popup → see voice dropdown → select a voice → close and reopen popup → verify selection persisted

### Implementation for User Story 1

- [ ] T007 [P] [US1] Add voice dropdown select element to popup.html after API key form
- [ ] T008 [P] [US1] Add voice selection styles to popup.css (dropdown and container)
- [ ] T009 [US1] Add GET_VOICES message handler to background.js with cache logic
- [ ] T010 [US1] Add initializeVoiceSelector() function to popup.js that fetches and populates voices
- [ ] T011 [US1] Add populateVoiceDropdown() function to popup.js that creates option elements
- [ ] T012 [US1] Add loadSelectedVoice() function to popup.js that loads saved preference
- [ ] T013 [US1] Add saveVoiceSelection() function to popup.js with auto-save on change event
- [ ] T014 [US1] Call initializeVoiceSelector() in popup.js DOMContentLoaded handler
- [ ] T015 [US1] Add change event listener to voice dropdown in popup.js

**Manual Test Checklist for User Story 1**:
- [ ] Open popup → voice dropdown shows "Loading voices..."
- [ ] After load → dropdown populated with ~30-50 voices
- [ ] Voice labels format: "Name - Gender, Accent" (e.g., "Rachel - Female, American")
- [ ] Select a voice → close popup → reopen → selection persisted
- [ ] First time user → default voice pre-selected in dropdown
- [ ] Console shows no errors during voice loading
- [ ] Voices load within 2 seconds (SC-001)

**Checkpoint**: At this point, User Story 1 should be fully functional - users can select and persist voice preferences

---

## Phase 4: User Story 3 - Voice Selection Integrates with Playback (Priority: P1)

**Goal**: Selected voice is applied to all text-to-speech playback operations with graceful fallback

**Note**: US3 implemented before US2 because playback integration is P1 (core functionality) while preview is P2 (enhancement)

**Independent Test**: Select voice in popup → select text on webpage → right-click "Read Aloud" → verify text read in selected voice

### Implementation for User Story 3

- [ ] T016 [US3] Modify background.js context menu handler to retrieve selectedVoiceId before textToSpeech()
- [ ] T017 [US3] Add getSafeVoiceId() function to background.js that validates voice exists and falls back to DEFAULT_VOICE_ID
- [ ] T018 [US3] Pass voiceId parameter to textToSpeech() in background.js playback handler
- [ ] T019 [US3] Add voice unavailability notification logic to background.js (show toast if fallback occurs)

**Manual Test Checklist for User Story 3**:
- [ ] Select "Rachel" voice → trigger playback → hear Rachel's voice
- [ ] Change to "Josh" voice → trigger playback → hear Josh's voice (different from Rachel)
- [ ] Close browser → reopen → trigger playback → still uses previously selected voice
- [ ] Disconnect network → manually clear voice from cache → trigger playback → uses default voice with notification
- [ ] Voice applies with 100% consistency (SC-004)
- [ ] Graceful fallback works without blocking playback (SC-005)

**Checkpoint**: At this point, User Stories 1 AND 3 should work together - voice selection affects actual playback

---

## Phase 5: User Story 2 - Preview Voice Before Selection (Priority: P2)

**Goal**: Users can preview voices by clicking a preview button that plays a sample phrase in the currently selected voice

**Independent Test**: Select voice in dropdown → click preview button → hear sample phrase "Hello, this is a preview of this voice."

### Implementation for User Story 2

- [ ] T020 [P] [US2] Add preview button element to popup.html next to voice dropdown
- [ ] T021 [P] [US2] Add preview button styles to popup.css
- [ ] T022 [US2] Add PREVIEW_VOICE message handler to background.js that generates audio
- [ ] T023 [US2] Add PLAY_PREVIEW message handler to offscreen.js for preview playback
- [ ] T024 [US2] Add previewVoice() function to popup.js that sends PREVIEW_VOICE message
- [ ] T025 [US2] Add click event listener to preview button in popup.js
- [ ] T026 [US2] Add preview stop logic to offscreen.js (stop existing audio before starting new preview)
- [ ] T027 [US2] Add error handling in background.js for preview generation failures

**Manual Test Checklist for User Story 2**:
- [ ] Click preview button → hear "Hello, this is a preview of this voice." in selected voice
- [ ] Click preview while playing → first preview stops, new one starts
- [ ] Click preview again → preview stops (toggle behavior)
- [ ] Change voice selection → click preview → hear new voice
- [ ] Preview plays within 1 second of click (SC-002)
- [ ] Preview button returns to initial state after playback completes
- [ ] Network failure → preview error shown near button, doesn't block selection

**Checkpoint**: All user stories should now be independently functional - complete voice selection feature

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validations

- [ ] T028 [P] Add voice error message element to popup.html for displaying loading errors
- [ ] T029 [P] Add error message styles to popup.css
- [ ] T030 Add error handling in popup.js initializeVoiceSelector() for API failures
- [ ] T031 Add cache fallback logic in background.js GET_VOICES handler (use stale cache on API failure)
- [ ] T032 Add voice-error display logic in popup.js when voice loading fails
- [ ] T033 Test complete quickstart.md validation scenarios
- [ ] T034 Verify all console.log statements have descriptive messages for debugging
- [ ] T035 Test edge cases: simultaneous selections, rapid voice changes, cache expiry after 24 hours
- [ ] T036 Test cross-website functionality: verify voice selection works on 3+ different websites
- [ ] T037 Verify memory cleanup: check Chrome Task Manager after multiple preview/playback cycles

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A - No setup needed (extension already configured)
- **Foundational (Phase 2)**: No dependencies - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (Phase 3) can start after Foundational - No dependencies on other stories
  - User Story 3 (Phase 4) depends on US1 completion (needs voice selection to exist) - P1 priority
  - User Story 2 (Phase 5) depends on US1 completion (needs voice selection to exist) - P2 priority
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P1)**: Depends on US1 (needs voice selector) - Core playback integration
- **User Story 2 (P2)**: Depends on US1 (needs voice selector) - Enhancement feature

**Rationale**: US3 implemented before US2 despite phase numbering because both depend on US1, but US3 is P1 (essential) while US2 is P2 (enhancement)

### Within Each User Story

**User Story 1**:
- Storage functions (T001-T004) before UI components (T007-T015)
- HTML/CSS (T007-T008) in parallel
- Background handler (T009) in parallel with popup functions (T010-T013)
- Initialization (T014-T015) after all components ready

**User Story 3**:
- All tasks sequential (T016 → T017 → T018 → T019)
- Depends on US1 voice selection being functional

**User Story 2**:
- HTML/CSS (T020-T021) in parallel
- Background/offscreen handlers (T022-T023) in parallel
- Popup functions (T024-T025) after handlers ready
- Error handling (T027) after core preview works

### Parallel Opportunities

**Foundational Phase (Phase 2)**:
- T001-T004: All storage functions in parallel (different utility functions)
- T005 & T006: API function and label formatter in parallel (different files)

**User Story 1 (Phase 3)**:
- T007 & T008: HTML and CSS in parallel (different files)
- T009, T010, T011, T012, T013: Can be developed in parallel (background vs popup logic)

**User Story 2 (Phase 5)**:
- T020 & T021: HTML and CSS in parallel
- T022 & T023: Background and offscreen handlers in parallel

**Polish Phase (Phase 6)**:
- T028 & T029: HTML and CSS in parallel
- T033-T037: All manual testing in parallel (different test scenarios)

---

## Parallel Example: Foundational Phase

```bash
# Launch all storage utilities together:
Task: "Add getVoicePreference() function to src/utils/storage.js"
Task: "Add setVoicePreference() function to src/utils/storage.js"
Task: "Add getVoiceCache() function with 24-hour TTL validation to src/utils/storage.js"
Task: "Add setVoiceCache() function to src/utils/storage.js"

# In parallel, work on API function:
Task: "Add getVoices() function to src/api/elevenlabs.js for GET /v1/voices endpoint"
```

---

## Parallel Example: User Story 1

```bash
# Launch UI components together:
Task: "Add voice dropdown select element to popup.html after API key form"
Task: "Add voice selection styles to popup.css (dropdown and container)"

# In parallel, work on handlers:
Task: "Add GET_VOICES message handler to background.js with cache logic"
Task: "Add initializeVoiceSelector() function to popup.js that fetches and populates voices"
Task: "Add populateVoiceDropdown() function to popup.js that creates option elements"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3 Only)

**MVP = Voice Selection + Playback Integration**

1. Complete Phase 2: Foundational (T001-T006)
2. Complete Phase 3: User Story 1 (T007-T015)
3. Complete Phase 4: User Story 3 (T016-T019)
4. **STOP and VALIDATE**:
   - Test voice selection persistence
   - Test playback uses selected voice
   - Test fallback to default voice
5. Deploy/demo MVP

**Estimated Time**: 1.5-2 hours for MVP

### Full Feature Delivery

1. Complete MVP (Foundational + US1 + US3) → Test independently → ~2 hours
2. Add User Story 2 (Preview) → Test independently → +45 minutes
3. Add Polish & Error Handling → Final validation → +30 minutes
4. **Total**: 2.5-3 hours for complete feature

### Incremental Delivery

1. **Milestone 1 (MVP)**: Foundational + US1 + US3
   - Users can select voices
   - Selection persists across sessions
   - Playback uses selected voice
   - Deploy/Demo ✅

2. **Milestone 2 (Enhanced)**: Add US2
   - Users can preview voices before selecting
   - Better user experience for voice discovery
   - Deploy/Demo ✅

3. **Milestone 3 (Polished)**: Add error handling and edge case coverage
   - Robust error handling
   - Graceful degradation
   - Production-ready ✅

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Manual testing after each phase checkpoint
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- US3 implemented before US2 because US3 is P1 (essential playback integration) while US2 is P2 (enhancement preview feature)
- No automated tests generated - spec does not request test implementation
- All testing is manual via quickstart.md validation scenarios

---

## Task Summary

**Total Tasks**: 37

**By Phase**:
- Phase 1 (Setup): 0 tasks (no setup needed)
- Phase 2 (Foundational): 6 tasks (T001-T006)
- Phase 3 (US1 - View and Select): 9 tasks (T007-T015)
- Phase 4 (US3 - Playback Integration): 4 tasks (T016-T019)
- Phase 5 (US2 - Preview): 8 tasks (T020-T027)
- Phase 6 (Polish): 10 tasks (T028-T037)

**By User Story**:
- User Story 1 (P1): 9 tasks
- User Story 2 (P2): 8 tasks
- User Story 3 (P1): 4 tasks
- Foundational: 6 tasks
- Polish: 10 tasks

**Parallel Opportunities Identified**: 14 tasks marked [P]

**MVP Scope**: Phase 2 + Phase 3 + Phase 4 = 19 tasks (~2 hours)

**Independent Test Criteria**:
- US1: Voice selection persists across popup open/close cycles
- US3: Selected voice used in playback, fallback to default works
- US2: Preview plays sample audio in selected voice

**Success Criteria Validation**:
- SC-001: Voices load within 2 seconds - Test in Phase 3
- SC-002: Previews play within 1 second - Test in Phase 5
- SC-003: Preference persistence 100% - Test in Phase 3 & 4
- SC-004: Voice applies consistently - Test in Phase 4
- SC-005: Graceful fallback - Test in Phase 4
- SC-006: Voice changes without restart - Test in Phase 4
