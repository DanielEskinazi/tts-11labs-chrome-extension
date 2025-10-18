# Tasks: Text Selection and Context Menu Integration

**Input**: Design documents from `/specs/002-text-selection-context-menu/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: No dedicated test tasks included as tests are not explicitly requested in the feature specification. Testing will be manual via Chrome browser.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Chrome extension structure: files at repository root (manifest.json, background.js, content.js, toast.css)
- No subdirectories needed for Phase 2

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Update manifest.json with Phase 2 permissions and file references

- [X] T001 Update manifest.json version from 1.0.0 to 1.1.0
- [X] T002 Add new permissions to manifest.json: contextMenus, activeTab, scripting
- [X] T003 Add host_permissions to manifest.json for all HTTP/HTTPS pages: ["http://*/*", "https://*/*"]
- [X] T004 Add background service worker configuration to manifest.json pointing to background.js
- [X] T005 Add content_scripts configuration to manifest.json with matches: ["<all_urls>"], js: ["content.js"], css: ["toast.css"], run_at: "document_idle", all_frames: false

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create CSS and utility files needed by all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 Create toast.css with base toast styles (position: fixed, top: 20px, right: 20px, z-index: 2147483647)
- [X] T007 Add toast type variants to toast.css (success: #10b981, warning: #f59e0b, error: #ef4444)
- [X] T008 Add slideIn animation to toast.css (translateX(100%) to translateX(0) over 0.3s ease-out)
- [X] T009 Add accessibility styles to toast.css (focus outline, system fonts, ARIA-compatible)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Select Text and Trigger TTS via Context Menu (Priority: P1) 🎯 MVP

**Goal**: Enable users to select text on any web page, right-click to see "Read with ElevenLabs" option, click it to capture text, and see visual confirmation via toast notification.

**Independent Test**: (1) Select text on any web page, (2) right-click to verify "Read with ElevenLabs" appears in context menu, (3) click the option and verify text is captured and green toast appears with confirmation message, (4) verify toast auto-removes after 3 seconds.

### Implementation for User Story 1

**Background Service Worker (background.js)**

- [X] T010 [US1] Create background.js with in-memory cache variable for captured text (capturedTextCache = null)
- [X] T011 [US1] Implement chrome.runtime.onInstalled listener in background.js to create context menu with id: "read-with-elevenlabs", title: "Read with ElevenLabs", contexts: ["selection"], documentUrlPatterns: ["http://*/*", "https://*/*"]
- [X] T012 [US1] Implement chrome.contextMenus.onClicked listener in background.js to handle context menu clicks and send CAPTURE_TEXT message to active tab via chrome.tabs.sendMessage
- [X] T013 [US1] Implement chrome.runtime.onMessage listener in background.js to receive TEXT_CAPTURED messages from content script
- [X] T014 [US1] Implement handleTextCaptured function in background.js to store captured text in capturedTextCache and chrome.storage.session with key "lastCapturedText"
- [X] T015 [US1] Add logic to handleTextCaptured in background.js to determine toast type (success for text <5000 chars, warning for text >5000 chars)
- [X] T016 [US1] Add logic to handleTextCaptured in background.js to generate toast message with text preview (first 30 chars + "..." if truncated)
- [X] T017 [US1] Send SHOW_TOAST message from handleTextCaptured to content script via chrome.tabs.sendMessage with message and type
- [X] T018 [US1] Implement getCapturedText helper function in background.js to retrieve text from cache or chrome.storage.session (for Phase 3)
- [X] T019 [US1] Add console logging throughout background.js for debugging (extension installed, context menu clicked, text captured, storage operations)

**Content Script (content.js)**

- [X] T020 [P] [US1] Create content.js with chrome.runtime.onMessage listener for messages from service worker
- [X] T021 [US1] Implement captureSelectedText function in content.js to get window.getSelection(), validate, trim whitespace, and send TEXT_CAPTURED message to service worker
- [X] T022 [US1] Add validation in captureSelectedText to check for empty/whitespace-only selections and show error toast if empty
- [X] T023 [US1] Send TEXT_CAPTURED message with payload {text, url: window.location.href, length} via chrome.runtime.sendMessage
- [X] T024 [US1] Add error handling in captureSelectedText for failed message sending (catch and show error toast)
- [X] T025 [US1] Implement showToast function in content.js to create Shadow DOM with closed mode
- [X] T026 [US1] Add HTML escaping utility function (escapeHtml) in content.js using textContent assignment
- [X] T027 [US1] Implement Shadow DOM content injection in showToast with inline CSS from toast.css and escaped message
- [X] T028 [US1] Add dynamic background color logic in showToast based on toast type (success/warning/error)
- [X] T029 [US1] Append toast container to document.body in showToast and set auto-remove timeout for 3000ms
- [X] T030 [US1] Add ARIA attributes to toast in showToast (role="alert", aria-live="polite")
- [X] T031 [US1] Add console logging throughout content.js for debugging (script loaded, messages received, text captured, toast displayed/removed)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently by selecting text, right-clicking, clicking context menu, and seeing toast confirmation.

---

## Phase 4: User Story 2 - Seamless Experience Across Different Websites (Priority: P2)

**Goal**: Ensure extension works consistently across 10+ popular websites without breaking page functionality or causing console errors.

**Independent Test**: Visit 10+ popular websites (Google Docs, Medium, Twitter/X, Reddit, Wikipedia, GitHub, Gmail, NYTimes, Stack Overflow, Amazon), select text on each, verify context menu appears, text selection works normally, no console errors, page functionality remains intact.

### Implementation for User Story 2

**Enhanced Error Handling and Compatibility**

- [X] T032 [P] [US2] Add CSP compliance verification to content.js by checking no inline scripts/styles in main document (only in Shadow DOM)
- [X] T033 [P] [US2] Add document.body availability check in showToast before attempting to append container
- [X] T034 [US2] Add error handling for Shadow DOM creation failures in showToast (try-catch with fallback to console error)
- [X] T035 [US2] Add validation in background.js to handle tabs without content script loaded (check for "Receiving end does not exist" error)
- [X] T036 [US2] Add logic in captureSelectedText to preserve multi-paragraph selections with line breaks (\n characters)
- [X] T037 [US2] Add Unicode and emoji support verification in escapeHtml function (ensure textContent handles UTF-8 correctly)
- [X] T038 [US2] Add defensive checks in chrome.runtime.onMessage listeners to validate message structure (type, timestamp, payload)
- [X] T039 [US2] Add graceful degradation for unknown message types (log warning, don't crash)

**Testing and Validation**

- [X] T040 [US2] Test extension on 10+ popular websites per quickstart.md test plan and document results
- [X] T041 [US2] Verify no console errors on any tested website (check both page DevTools and service worker DevTools)
- [X] T042 [US2] Test text selection edge cases: short text (1-2 words), long text (100+ words), very long text (5000+ chars), special characters, emojis, Unicode, multi-paragraph
- [X] T043 [US2] Verify extension works on SPA websites (Gmail, Twitter) after navigation without page reload

**Checkpoint**: Extension should work consistently across all tested websites with no errors and consistent behavior.

---

## Phase 5: User Story 3 - Fast and Lightweight Extension (Priority: P3)

**Goal**: Ensure extension loads quickly, doesn't slow down page rendering, uses minimal memory, and has no perceptible performance impact.

**Independent Test**: (1) Measure page load times with and without extension, verify <50ms difference, (2) check memory usage via Chrome Task Manager, verify <5MB per tab, (3) confirm no performance degradation on low-end devices or complex web apps.

### Implementation for User Story 3

**Performance Optimization**

- [X] T044 [P] [US3] Verify content_scripts run_at is set to "document_idle" in manifest.json to avoid blocking critical rendering path
- [X] T045 [P] [US3] Verify all_frames is set to false in manifest.json to reduce memory overhead (only inject in top-level frames)
- [X] T046 [P] [US3] Optimize Shadow DOM creation in showToast to minimize DOM queries and use efficient innerHTML injection
- [X] T047 [US3] Add passive event listeners flag if any event listeners are added in content.js (currently none, but future-proofing)
- [X] T048 [US3] Verify chrome.storage.session usage instead of chrome.storage.local for faster read/write operations
- [X] T049 [US3] Add cleanup logic to ensure toast removal doesn't leak memory (verify setTimeout is cleared and container is removed from DOM)

**Performance Testing and Validation**

- [X] T050 [US3] Measure page load impact using Chrome DevTools Performance tab on example.com (with and without extension)
- [X] T051 [US3] Verify page load impact is <50ms per success criteria SC-003
- [X] T052 [US3] Measure memory usage via Chrome Task Manager for service worker (<2MB expected) and content script per tab (<5MB expected)
- [X] T053 [US3] Test context menu response time (should appear within 100ms of right-click per SC-001)
- [X] T054 [US3] Test toast display time (should appear within 200ms of clicking menu item per SC-008)
- [X] T055 [US3] Test on complex web apps (Google Docs, Figma, Google Maps) to verify no frame drops or stuttering

**Checkpoint**: All performance requirements should be met with measurable validation.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation updates, and overall quality checks

- [X] T056 [P] Verify manifest.json is valid JSON (use json validator or chrome://extensions load test)
- [X] T057 [P] Run quickstart.md validation: complete all steps from Step 1 through Step 9
- [X] T058 Run full verification checklist from quickstart.md covering all FR (Functional Requirements) and SC (Success Criteria)
- [X] T059 Test service worker lifecycle: verify termination and wake behavior, verify state persistence across restarts
- [X] T060 Document any incompatible websites discovered during testing (e.g., sites with strict CSP that block extensions)
- [X] T061 Add final console log cleanup: ensure all logs are helpful for debugging, remove any sensitive data logging
- [X] T062 Verify no JavaScript console errors during normal usage across all tested websites (SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 - Builds on US1 implementation but adds error handling and compatibility checks
- **User Story 3 (P3)**: Can start after US1 - Validates performance of US1 implementation

### Within Each User Story

- Background service worker tasks (T010-T019) must complete before content script can send messages
- Content script tasks (T020-T031) can start in parallel with background tasks but message passing tests require both complete
- US2 and US3 tasks are primarily validation and enhancement tasks that build on US1

### Parallel Opportunities

- **Phase 1**: All manifest.json updates (T001-T005) can be done in a single edit session
- **Phase 2**: All CSS tasks (T006-T009) can be done in a single toast.css file creation
- **US1**: T020 (create content.js) can start in parallel with T010 (create background.js)
- **US2**: T032, T033 (CSP and document.body checks) can be done in parallel
- **US3**: T044, T045, T046 (performance optimizations) can be done in parallel
- **US3**: T050, T052, T053, T054, T055 (performance tests) can be run in parallel
- **Phase 6**: T056, T057 (validation tasks) can be done in parallel

---

## Parallel Example: User Story 1

```bash
# Launch background.js and content.js creation in parallel:
Task: "Create background.js with in-memory cache variable for captured text"
Task: "Create content.js with chrome.runtime.onMessage listener for messages from service worker"

# Then implement message handlers in parallel:
Task: "Implement chrome.contextMenus.onClicked listener in background.js"
Task: "Implement captureSelectedText function in content.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T005) - Update manifest.json
2. Complete Phase 2: Foundational (T006-T009) - Create toast.css
3. Complete Phase 3: User Story 1 (T010-T031) - Implement core functionality
4. **STOP and VALIDATE**: Load extension in Chrome, test text selection → context menu → toast on example.com
5. Test on 2-3 simple websites to verify basic functionality
6. **MVP COMPLETE**: Users can now select text and see confirmation

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (manifest + CSS)
2. Add User Story 1 → Test independently → **MVP Achieved** ✅
3. Add User Story 2 → Test on 10+ websites → Cross-site compatibility validated
4. Add User Story 3 → Performance testing → Performance requirements met
5. Polish Phase → Final validation → **Phase 2 Complete** ✅

### Sequential Strategy (Single Developer)

1. Complete Phase 1 (manifest updates) - 10 minutes
2. Complete Phase 2 (CSS file) - 10 minutes
3. Complete User Story 1 tasks in order (T010-T031) - 2-3 hours
4. Validate US1 works end-to-end
5. Complete User Story 2 tasks in order (T032-T043) - 1-2 hours
6. Complete User Story 3 tasks in order (T044-T055) - 1-2 hours
7. Complete Polish phase (T056-T062) - 30 minutes

**Total Estimated Time**: 4-6 hours for experienced developer, 6-10 hours for beginner

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability (US1, US2, US3)
- Each user story should be independently testable via the "Independent Test" criteria
- No automated tests written - all testing is manual via Chrome browser (load unpacked extension)
- Commit after completing each user story phase
- Stop at any checkpoint to validate story independently before proceeding
- Service worker logs appear in chrome://extensions → "service worker" DevTools
- Content script logs appear in page DevTools (F12) Console tab
- Avoid: editing same file sections in parallel (e.g., don't edit background.js message handler while adding new message types)

---

## Success Validation

After completing all tasks, verify Phase 2 is complete by checking:

✅ **User Story 1**: Select text, right-click, see context menu, click, see toast confirmation
✅ **User Story 2**: Extension works on 10+ websites with no console errors
✅ **User Story 3**: Page load impact <50ms, memory <5MB per tab, context menu <100ms response time
✅ **All FR (Functional Requirements)**: FR-001 through FR-020 from spec.md
✅ **All SC (Success Criteria)**: SC-001 through SC-010 from spec.md
✅ **Quickstart**: All 9 steps in quickstart.md complete successfully

When all validation passes, Phase 2 is ready for git commit and progression to Phase 3 (ElevenLabs API Integration).
