# Tasks: Basic Extension Setup

**Input**: Design documents from `/specs/001-feature-name/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in this feature specification. Test tasks are excluded per workflow guidelines.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: Files at repository root (Chrome extension structure)
- Paths: `/manifest.json`, `/popup.html`, `/popup.js`, `/popup.css`, `/icons/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for Chrome extension

- [X] T001 Create project directory structure: icons/ folder at repository root
- [X] T002 Create placeholder files: manifest.json, popup.html, popup.js, popup.css at repository root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Manifest V3 configuration that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until manifest.json is configured

- [X] T003 Implement Manifest V3 configuration in manifest.json per contracts/manifest-spec.json
- [X] T004 Configure extension permissions (storage only) in manifest.json
- [X] T005 Configure action.default_popup to point to popup.html in manifest.json
- [X] T006 Define icon paths (16x16, 48x48, 128x128) in manifest.json

**Checkpoint**: Manifest V3 foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Install and Configure Extension (Priority: P1) 🎯 MVP

**Goal**: Users can install the extension, configure their ElevenLabs API key, and have it securely stored in chrome.storage.local with persistence across browser sessions.

**Independent Test**: Install extension via chrome://extensions, click extension icon to open popup, enter valid 32-character hex API key, save it, close popup, reopen popup to verify API key is displayed (masked with last 4 chars visible) and persists after browser restart.

### Implementation for User Story 1

- [X] T007 [P] [US1] Create popup HTML structure in popup.html with form, input field, status message, save/clear buttons
- [X] T008 [P] [US1] Implement popup styling in popup.css with professional design, form layout, button styles, status colors
- [X] T009 [US1] Implement DOM element references and constants in popup.js (STORAGE_KEY, API_KEY_REGEX)
- [X] T010 [US1] Implement loadApiKey() function in popup.js to retrieve config from chrome.storage.local
- [X] T011 [US1] Implement validateApiKey() function in popup.js with regex /^[a-fA-F0-9]{32}$/ and whitespace trimming
- [X] T012 [US1] Implement maskApiKey() function in popup.js to show dots + last 4 characters
- [X] T013 [US1] Implement saveApiKey() function in popup.js with validation, chrome.storage.local.set, timestamp handling (createdAt/updatedAt)
- [X] T014 [US1] Implement clearApiKey() function in popup.js with chrome.storage.local.remove
- [X] T015 [US1] Add form submit event listener in popup.js to call saveApiKey()
- [X] T016 [US1] Add clear button event listener in popup.js to call clearApiKey()
- [X] T017 [US1] Add DOMContentLoaded event listener in popup.js to call loadApiKey() on popup open
- [X] T018 [US1] Implement error handling for chrome.runtime.lastError in all chrome.storage callbacks in popup.js
- [X] T019 [US1] Implement showError() and hideError() helper functions in popup.js for user-friendly error messages

**Checkpoint**: At this point, User Story 1 should be fully functional - users can install, save API keys, view masked keys, and verify persistence across sessions.

---

## Phase 4: User Story 2 - View Extension Status (Priority: P2)

**Goal**: Users can quickly check whether the extension is properly configured by viewing clear status indicators in the popup interface.

**Independent Test**: Open popup with no API key stored - verify "API key required" status message displays. Save an API key - verify "Configured and ready" status message displays. Test updating and clearing API key to verify status updates correctly.

### Implementation for User Story 2

- [X] T020 [US2] Implement updateStatus() function in popup.js to set status message and CSS classes based on configuration state
- [X] T021 [US2] Add status CSS classes (.configured, .not-configured) in popup.css with appropriate colors (green/red)
- [X] T022 [US2] Update loadApiKey() in popup.js to call updateStatus(true) when key exists, updateStatus(false) when missing
- [X] T023 [US2] Update saveApiKey() in popup.js to call updateStatus(true) after successful save
- [X] T024 [US2] Update clearApiKey() in popup.js to call updateStatus(false) after successful removal
- [X] T025 [US2] Add help text in popup.html with link to ElevenLabs subscription page for API key acquisition

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - full API key management with clear status feedback.

---

## Phase 5: User Story 3 - Visual Brand Recognition (Priority: P3)

**Goal**: Users can easily identify the ElevenLabs TTS extension among other installed extensions through distinctive iconography at multiple sizes.

**Independent Test**: Install extension and verify icons appear correctly in Chrome toolbar (16x16), chrome://extensions page (48x48 and 128x128), and popup header. Icons should be clearly visible and recognizable.

### Implementation for User Story 3

- [X] T026 [P] [US3] Create or generate 16x16 icon in icons/icon16.png (toolbar icon)
- [X] T027 [P] [US3] Create or generate 48x48 icon in icons/icon48.png (extension management icon)
- [X] T028 [P] [US3] Create or generate 128x128 icon in icons/icon128.png (Chrome Web Store icon)
- [X] T029 [US3] Add header branding element in popup.html with consistent styling
- [X] T030 [US3] Style header branding in popup.css to match extension identity

**Checkpoint**: All user stories should now be independently functional - complete Phase 1 extension with installation, configuration, status, and branding.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [X] T031 [P] Add CSP compliance validation - ensure no inline scripts in popup.html
- [X] T032 [P] Verify input sanitization - confirm textContent usage instead of innerHTML in popup.js
- [X] T033 Code review for error handling - ensure all chrome.storage calls check chrome.runtime.lastError
- [X] T034 Performance validation - verify popup loads in < 1 second, input validation feedback in < 500ms
- [X] T035 Manual testing via chrome://extensions load unpacked - verify all acceptance scenarios from spec.md
- [X] T036 [P] Edge case testing - whitespace trimming, empty input validation, persistence after restart
- [X] T037 Size validation - confirm total extension size < 5MB, individual files < 500KB
- [X] T038 Run quickstart.md validation - follow quickstart guide to verify all steps work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P2): Can start after Foundational - Integrates with US1 but independently testable
  - User Story 3 (P3): Can start after Foundational - Independent of US1/US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Calls updateStatus() which integrates with US1 functions but is independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Completely independent of US1/US2

### Within Each User Story

**User Story 1:**
- T007 (HTML) and T008 (CSS) can run in parallel [P]
- T009-T014 (core functions) should be sequential (building blocks)
- T015-T017 (event listeners) depend on T009-T014
- T018-T019 (error handling) can be added after core functions

**User Story 2:**
- All tasks (T020-T025) are modifications to existing files from US1
- Should be done sequentially after US1 is complete
- But can start immediately after US1 checkpoint

**User Story 3:**
- T026, T027, T028 (icon creation) can all run in parallel [P]
- T029-T030 (header branding) can run in parallel with icon creation

### Parallel Opportunities

- **Setup Phase**: T001 and T002 can run together
- **Foundational Phase**: All manifest tasks (T003-T006) modify same file - must be sequential
- **User Story 1**: T007 (HTML) and T008 (CSS) can run in parallel
- **User Story 2**: No parallel opportunities (all modify same files sequentially)
- **User Story 3**: T026, T027, T028 (icon files) can all run in parallel
- **Polish Phase**: T031, T032, T036, T037 can run in parallel [P]
- **Cross-Story**: After Foundational phase, US1, US2, and US3 can be worked on in parallel by different developers

---

## Parallel Example: User Story 1

```bash
# Launch HTML and CSS creation together (different files):
Task: "Create popup HTML structure in popup.html with form, input field, status message, save/clear buttons"
Task: "Implement popup styling in popup.css with professional design, form layout, button styles, status colors"

# Then implement JavaScript functions sequentially (same file, dependencies)
```

## Parallel Example: User Story 3

```bash
# Launch all icon creation tasks together (different files):
Task: "Create or generate 16x16 icon in icons/icon16.png (toolbar icon)"
Task: "Create or generate 48x48 icon in icons/icon48.png (extension management icon)"
Task: "Create or generate 128x128 icon in icons/icon128.png (Chrome Web Store icon)"
```

## Parallel Example: Cross-Story After Foundation

```bash
# After Foundational phase completes, launch all user stories in parallel:
Task: "User Story 1 - Install and Configure Extension (all US1 tasks)"
Task: "User Story 2 - View Extension Status (all US2 tasks)"
Task: "User Story 3 - Visual Brand Recognition (all US3 tasks)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T006) - CRITICAL: blocks all stories
3. Complete Phase 3: User Story 1 (T007-T019)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Install extension via chrome://extensions
   - Save API key, verify storage
   - Test persistence across browser restart
   - Verify masked display
5. Deploy/demo if ready - extension is now minimally functional

### Incremental Delivery

1. Complete Setup + Foundational → Manifest V3 foundation ready
2. Add User Story 1 (T007-T019) → Test independently → **Deploy/Demo (MVP!)**
   - Extension can now be installed and configured
3. Add User Story 2 (T020-T025) → Test independently → Deploy/Demo
   - Extension now has clear status indicators
4. Add User Story 3 (T026-T030) → Test independently → Deploy/Demo
   - Extension now has professional branding
5. Add Polish (T031-T038) → Final validation → Deploy/Demo
   - Extension is production-ready

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. **Team completes Setup + Foundational together** (T001-T006)
2. **Once Foundational is done:**
   - Developer A: User Story 1 (T007-T019)
   - Developer B: User Story 3 (T026-T030) - can start in parallel, no dependency on US1
   - Developer C: Prepare icons and assets
3. **After User Story 1 completes:**
   - Developer B: User Story 2 (T020-T025) - integrates with US1
4. **Stories integrate independently**

---

## Notes

- **[P] tasks**: Different files, no dependencies, can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **Each user story**: Should be independently completable and testable
- **No tests included**: Tests are not explicitly requested in feature specification
- **Commit strategy**: Commit after each task or logical group of related tasks
- **Testing approach**: Manual testing in Chrome per quickstart.md
- **Stop at any checkpoint**: Validate story independently before proceeding
- **File paths**: All paths are at repository root (Chrome extension structure)
- **Constitution compliance**:
  - Manifest V3 (NON-NEGOTIABLE) - enforced in T003
  - Minimal permissions (storage only) - enforced in T004
  - CSP compliance (no inline scripts) - validated in T031
  - Security (input sanitization) - validated in T032

---

## Task Summary

**Total Tasks**: 38

**Phase Breakdown**:
- Phase 1 (Setup): 2 tasks
- Phase 2 (Foundational): 4 tasks
- Phase 3 (User Story 1 - P1): 13 tasks 🎯 MVP
- Phase 4 (User Story 2 - P2): 6 tasks
- Phase 5 (User Story 3 - P3): 5 tasks
- Phase 6 (Polish): 8 tasks

**Parallel Opportunities**: 8 tasks marked [P] can run in parallel within their phases

**MVP Scope** (Recommended first milestone):
- Setup: T001-T002
- Foundational: T003-T006
- User Story 1: T007-T019
- **Total for MVP**: 19 tasks (50% of total)

**Independent Test Criteria**:
- **User Story 1**: Install, save API key, verify persistence, check masking
- **User Story 2**: Verify status indicators update correctly based on configuration state
- **User Story 3**: Verify icons display correctly at all sizes in toolbar and extensions page
