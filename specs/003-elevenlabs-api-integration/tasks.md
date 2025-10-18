---
description: "Task list for ElevenLabs API Integration feature implementation"
---

# Tasks: ElevenLabs API Integration for Text-to-Speech

**Input**: Design documents from `/specs/003-elevenlabs-api-integration/`
**Prerequisites**: plan.md (✓), spec.md (✓)

**Tests**: NOT INCLUDED - No tests explicitly requested in specification

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Chrome extension structure at repository root
- Source code in `src/` directory (new in Phase 3)
- Service worker: `background.js`
- Content script: `content.js` (from Phase 2)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new source directory structure for API integration

- [X] T001 Create src/ directory structure: src/api/, src/utils/
- [X] T002 [P] Create placeholder files: src/api/elevenlabs.js, src/api/audio.js
- [X] T003 [P] Create utility files: src/utils/storage.js, src/utils/errors.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core API client infrastructure and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement chrome.storage wrapper utilities in src/utils/storage.js (getApiKey, getSettings, setSettings)
- [X] T005 [P] Implement error mapping utilities in src/utils/errors.js (mapApiErrorToUserMessage, ErrorTypes enum)
- [X] T006 [P] Create ElevenLabs API client base structure in src/api/elevenlabs.js (API_BASE_URL constant, DEFAULT_VOICE_ID = 'nPczCjzI2devNBz1zQrb' for Brian voice)
- [X] T007 Implement API key validation function in src/api/elevenlabs.js (validateApiKey)
- [X] T008 Implement text length validation function in src/api/elevenlabs.js (validateTextLength, MAX_TEXT_LENGTH=5000)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Convert Captured Text to Speech via ElevenLabs API (Priority: P1) 🎯 MVP

**Goal**: Send captured text to ElevenLabs API and receive audio back, completing the core TTS workflow

**Independent Test**: (1) Select text on any web page, (2) click "Read with ElevenLabs" from context menu, (3) verify API request is sent with captured text, (4) verify audio response is received from ElevenLabs, (5) confirm no errors occur during API call

### Implementation for User Story 1

- [X] T009 [US1] Implement buildApiRequest function in src/api/elevenlabs.js (construct headers with API key, build request body with text and voice_id)
- [X] T010 [US1] Implement textToSpeech async function in src/api/elevenlabs.js (fetch request to ElevenLabs API, handle response, return audio blob)
- [X] T011 [US1] Add timeout handling to textToSpeech in src/api/elevenlabs.js (15 second timeout using AbortController)
- [X] T012 [US1] Add request cancellation support in src/api/elevenlabs.js (store active AbortController, cancelPendingRequests function)
- [X] T013 [US1] Update background.js to listen for TTS_REQUEST message from content script
- [X] T014 [US1] Implement TTS request handler in background.js (retrieve API key, validate, call textToSpeech, send response back to content script)
- [X] T015 [US1] Update content.js to send TTS_REQUEST message when context menu clicked (include captured text from session storage)
- [X] T016 [US1] Add loading toast notification in content.js when TTS request starts ("Converting text to speech...")
- [X] T017 [US1] Add success toast notification in content.js when audio received ("Audio ready")
- [X] T018 [US1] Add error handling in background.js for API failures (catch errors, use src/utils/errors.js to map to user messages)
- [X] T019 [US1] Add logging in background.js for API requests (log request timestamp, text length, response time in ms, status code; exclude API key and user text content)

**Checkpoint**: At this point, User Story 1 should be fully functional - text is sent to API and audio is received

---

## Phase 4: User Story 2 - Automatic Audio Playback with Basic Controls (Priority: P2)

**Goal**: Play received audio automatically and provide pause/resume controls for user control

**Independent Test**: (1) Trigger TTS on selected text, (2) verify audio begins playing automatically when received, (3) click pause button to stop playback, (4) click resume to continue from where it paused, (5) verify playback completes and cleans up properly

### Implementation for User Story 2

- [ ] T020 [P] [US2] Create AudioPlayer class in src/api/audio.js (constructor, state management: idle/loading/playing/paused/error)
- [ ] T021 [P] [US2] Implement loadAudio method in src/api/audio.js (create Audio element from blob URL, handle load events)
- [ ] T022 [US2] Implement play method in src/api/audio.js (play audio, detect autoplay blocks, return promise)
- [ ] T023 [US2] Implement pause method in src/api/audio.js (pause playback, store current position)
- [ ] T024 [US2] Implement resume method in src/api/audio.js (resume from paused position)
- [ ] T025 [US2] Implement stop method in src/api/audio.js (stop playback, reset position)
- [ ] T026 [US2] Implement cleanup method in src/api/audio.js (release blob URL, remove audio element, reset state)
- [ ] T027 [US2] Add playback state tracking in src/api/audio.js (current position, duration, status)
- [ ] T028 [US2] Update background.js to create AudioPlayer instance when audio is received
- [ ] T029 [US2] Implement automatic playback in background.js (call audioPlayer.play() when audio loads)
- [ ] T030 [US2] Add browser autoplay policy detection in background.js (catch play() promise rejection)
- [ ] T031 [US2] Send AUTOPLAY_BLOCKED message from background.js to content.js when play() promise rejects (include play button action)
- [ ] T032 [US2] Add message handler for PAUSE_AUDIO in background.js (call audioPlayer.pause())
- [ ] T033 [US2] Add message handler for RESUME_AUDIO in background.js (call audioPlayer.resume())
- [ ] T034 [US2] Add message handler for STOP_AUDIO in background.js (call audioPlayer.stop() and cleanup())
- [ ] T035 [US2] Update background.js to stop current audio when new TTS request starts (cancel playback, cleanup resources)
- [ ] T036 [US2] Add audio completion listener in background.js (cleanup when audio ends naturally)
- [ ] T037 [US2] Update content.js to show play button in toast if autoplay blocked (send PLAY_AUDIO message on click)
- [ ] T038 [US2] Add pause/resume UI controls in content.js (simple button or icon in toast/popup)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - audio plays automatically with pause/resume controls

---

## Phase 5: User Story 3 - Robust Error Handling and User Feedback (Priority: P3)

**Goal**: Provide clear, actionable error messages for all failure scenarios (invalid API key, rate limits, network issues, text length)

**Independent Test**: (1) Intentionally use invalid API key and verify clear error message, (2) simulate network failure and check error handling, (3) test with text exceeding API limits, (4) verify all errors show user-friendly toast notifications with actionable guidance

### Implementation for User Story 3

- [ ] T039 [P] [US3] Add API key presence check in background.js TTS handler (error if missing/empty: "No API key configured. Please add your ElevenLabs API key in extension settings.")
- [ ] T040 [P] [US3] Add text length validation in background.js before API call (error if >5000 chars: "Text too long. Maximum 5000 characters supported")
- [ ] T041 [US3] Implement HTTP status code error handling in src/api/elevenlabs.js (401: "API key is invalid or expired. Please update your key in settings", 429: "API quota exceeded. Please check your ElevenLabs account", 503: "Service temporarily unavailable. Please try again later")
- [ ] T042 [US3] Implement network timeout error handling in src/api/elevenlabs.js (timeout after 15s: "Request timed out. Please try again.")
- [ ] T043 [US3] Implement network failure error handling in src/api/elevenlabs.js (fetch error: "Network error. Please check your internet connection")
- [ ] T044 [US3] Add rate limit header parsing in src/api/elevenlabs.js (extract retry-after or remaining quota from response headers if available)
- [ ] T045 [US3] Update error toast notifications in content.js to include actionable guidance (link to settings for API key errors, quota guidance for 429)
- [ ] T046 [US3] Add error logging in background.js (log: error type, status code, timestamp, text length; EXCLUDE: API key, user's text content, full request/response bodies)
- [ ] T047 [US3] Implement unsupported audio format detection in src/api/audio.js (catch load errors: "Unsupported audio format received")
- [ ] T048 [US3] Add special character/emoji text handling in background.js (send to API as-is, catch API rejection if it occurs)
- [ ] T049 [US3] Add edge case handling for text with only whitespace in background.js (trim and validate before sending)

**Checkpoint**: All user stories should now be independently functional with comprehensive error handling

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories, edge case handling, and final integration

- [ ] T050 [P] Add sequential request handling in background.js (cancel pending request when new TTS triggered while previous in progress)
- [ ] T051 [P] Add resource cleanup on tab close in background.js (stop audio, cancel requests, release memory)
- [ ] T052 Update manifest.json to use ES modules for service worker ("type": "module" in background script, enables import statements from src/)
- [ ] T053 Add console logging throughout for debugging (request/response cycles, state changes, playback events)
- [ ] T054 [P] Test TTS workflow on 3+ different websites (verify text capture, API calls, playback work consistently)
- [ ] T055 [P] Test all error scenarios (invalid key, network failure, rate limit, timeout, long text)
- [ ] T056 Test sequential TTS requests (10+ consecutive requests without reload)
- [ ] T057 Verify no console errors during normal operations (successful request and playback)
- [ ] T058 [P] Validate performance metrics (check logged response times, verify 95%+ requests <5s for <1000 char text, flag outliers)
- [ ] T059 Code cleanup and comment documentation in all new files
- [ ] T060 Update CLAUDE.md with Phase 3 implementation details

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Requires audio blob from US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances error handling for US1 and US2 but independently testable

### Within Each User Story

- **US1**: API client → background handler → content script integration → notifications
- **US2**: AudioPlayer class → playback methods → background integration → UI controls
- **US3**: Validation functions → error mapping → enhanced error messages → edge cases

### Parallel Opportunities

- **Phase 1**: All tasks marked [P] can run in parallel (T002, T003)
- **Phase 2**: All tasks marked [P] can run in parallel (T005, T006)
- **Phase 3 (US1)**: No parallel tasks - sequential implementation required
- **Phase 4 (US2)**: T020-T021 can run in parallel, T022-T027 can run in parallel once T020-T021 complete
- **Phase 5 (US3)**: T039-T040 can run in parallel, T041-T042 can run in parallel
- **Phase 6**: T050-T051 can run in parallel, T054-T055 can run in parallel, T056-T058 can run in parallel

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch foundational utilities together:
Task: "Implement error mapping utilities in src/utils/errors.js"
Task: "Create ElevenLabs API client base structure in src/api/elevenlabs.js"
```

## Parallel Example: Phase 4 User Story 2

```bash
# Launch AudioPlayer class structure tasks together:
Task: "Create AudioPlayer class in src/api/audio.js"
Task: "Implement loadAudio method in src/api/audio.js"

# Then launch playback methods together:
Task: "Implement play method in src/api/audio.js"
Task: "Implement pause method in src/api/audio.js"
Task: "Implement resume method in src/api/audio.js"
Task: "Implement stop method in src/api/audio.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T008) - CRITICAL
3. Complete Phase 3: User Story 1 (T009-T019)
4. **STOP and VALIDATE**: Test API integration independently
   - Select text on Wikipedia
   - Trigger TTS via context menu
   - Verify API request sent and audio received
   - Check console logs for errors
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (T009-T019) → Test independently → Deploy/Demo (MVP! Core TTS works)
3. Add User Story 2 (T020-T037) → Test independently → Deploy/Demo (Playback controls added)
4. Add User Story 3 (T038-T048) → Test independently → Deploy/Demo (Error handling complete)
5. Add Polish (T049-T058) → Final validation → Production ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T008)
2. Once Foundational is done:
   - Developer A: User Story 1 (T009-T019)
   - Developer B: User Story 2 (T020-T037) - requires coordination with A for audio blob interface
   - Developer C: User Story 3 (T038-T048) - can work independently on error handling
3. Stories integrate and test independently

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability (US1, US2, US3)
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Test on real websites (Wikipedia, news sites, blogs) throughout implementation
- Check chrome://extensions console for errors after each phase
- Verify service worker stays alive during long audio playback
- Account for browser autoplay policy - may need user interaction to play audio
