<!--
SYNC IMPACT REPORT
==================
Version Change: 0.0.0 → 1.0.0
Rationale: Initial constitution creation for ElevenLabs TTS Chrome Extension

Modified Principles:
- NEW: Phase-First Development
- NEW: Manifest V3 Compliance
- NEW: Security & Privacy First
- NEW: Chrome Extension Best Practices
- NEW: Testing Before Proceeding

Added Sections:
- Core Principles (5 principles defined)
- Technical Standards (Chrome extension requirements)
- Development Workflow (phase-based implementation)
- Governance (amendment and compliance procedures)

Templates Status:
✅ plan-template.md - Reviewed, constitution references align
✅ spec-template.md - Reviewed, user story structure compatible
✅ tasks-template.md - Reviewed, phase-based structure compatible

Follow-up TODOs: None
-->

# ElevenLabs TTS Chrome Extension Constitution

## Core Principles

### I. Phase-First Development

Every feature MUST be implemented in discrete, testable phases as defined in README.md. Each phase MUST be fully functional and tested in Chrome before proceeding to the next phase. This ensures incremental value delivery and reduces integration risk.

**Rules**:
- Complete Phase 1 (Basic Setup) before starting Phase 2 (Text Selection)
- Test each phase independently in Chrome browser
- No phase skipping or parallel phase implementation
- Each phase completion marked by functional testing checkpoint

**Rationale**: Chrome extensions have unique runtime constraints. Phase isolation prevents complex debugging across multiple untested components.

### II. Manifest V3 Compliance (NON-NEGOTIABLE)

All extension code MUST strictly follow Chrome Manifest V3 specifications. Service workers replace background pages. No blocking web requests. All permissions explicitly justified and minimized.

**Rules**:
- Use service workers for background scripts (NOT persistent background pages)
- Declare all permissions in manifest.json with justification
- Use chrome.storage API for data persistence (NOT localStorage)
- Follow Chrome Extension security best practices (CSP, no inline scripts)
- All API calls properly handle service worker lifecycle

**Rationale**: Manifest V3 is mandatory for Chrome Web Store. Non-compliance blocks publication and causes runtime failures.

### III. Security & Privacy First

API keys and user data MUST be handled securely. ElevenLabs API key stored using chrome.storage.local with encryption where possible. No data transmission to third parties except ElevenLabs API. Clear user consent for permissions.

**Rules**:
- API keys stored only in chrome.storage.local (NEVER in code or logs)
- Minimize requested permissions to absolute requirements
- Implement proper CORS handling for API calls
- Clear error messages without exposing sensitive data
- Audio caching must respect privacy (no persistent storage without consent)

**Rationale**: Browser extensions have elevated privileges. Security violations harm users and violate Chrome Web Store policies.

### IV. Chrome Extension Best Practices

Code MUST follow Chrome extension architecture patterns: content scripts for page interaction, background service workers for API calls, popup for UI. Message passing via chrome.runtime APIs. Proper resource cleanup.

**Rules**:
- Content scripts handle text selection and page DOM interaction
- Background service worker manages ElevenLabs API calls and audio playback
- Popup provides settings UI (API key, voice selection)
- Use chrome.runtime.sendMessage for script communication
- Implement proper cleanup for audio objects and event listeners
- Keep extension lightweight (< 5MB total size)

**Rationale**: Chrome's security model enforces script isolation. Violating architecture patterns causes permission errors and runtime failures.

### V. Testing Before Proceeding

Each feature increment MUST be manually tested in Chrome before marking complete. Test across different websites, text selections, and error conditions. Verify keyboard shortcuts, context menus, and audio playback.

**Rules**:
- Load unpacked extension in chrome://extensions after each change
- Test on minimum 3 different websites (simple, complex, dynamic content)
- Verify all keyboard shortcuts function globally
- Test error scenarios (invalid API key, network failure, no text selected)
- Check console for errors and warnings
- Validate memory cleanup (no leaks after multiple uses)

**Rationale**: Chrome extensions have unique runtime environments. Automated testing difficult for extension-specific APIs. Manual testing catches integration issues early.

## Technical Standards

**Language**: JavaScript ES2020+ (Chrome extensions runtime)
**Manifest Version**: V3 (REQUIRED)
**Primary APIs**: chrome.storage, chrome.contextMenus, chrome.commands, chrome.runtime, chrome.scripting
**External API**: ElevenLabs Text-to-Speech API v1
**Audio**: Web Audio API or HTMLAudioElement for playback
**Content Extraction**: Readability.js or equivalent for full-page reading
**File Structure**: Per README.md specification (manifest.json, popup.*, background.js, content.js, icons/)
**Size Constraints**: Total extension < 5MB, individual files < 500KB
**Browser Support**: Chrome 88+ (Manifest V3 minimum)

## Development Workflow

### Phase Implementation Requirements

1. **Phase 1 - Basic Setup**: Complete manifest.json, popup UI, API key storage, icons before Phase 2
2. **Phase 2 - Text Selection**: Content script, context menu, message passing before Phase 3
3. **Phase 3 - API Integration**: ElevenLabs connection, voice fetching, error handling before Phase 4
4. **Phase 4 - Audio Playback**: Audio player, keyboard shortcuts, play/pause/stop before Phase 5
5. **Phase 5 - Full Page Reading**: Content extraction, progress indicators before Phase 6
6. **Phase 6 - Polish**: Caching, speed controls, comprehensive testing

### Testing Checkpoints

Each phase MUST pass these gates before proceeding:
- Extension loads without errors in chrome://extensions
- Popup opens and displays correctly
- Console shows no errors or warnings
- Feature works on test websites
- User experience matches README.md specification
- No memory leaks (check with Chrome Task Manager)

### Code Quality Standards

- **Comments**: Every function has clear purpose comment
- **Error Handling**: All API calls wrapped in try-catch with user-friendly messages
- **Logging**: console.log for debugging, console.error for failures
- **Code Style**: Consistent indentation (2 spaces), semicolons, ES6+ syntax
- **File Organization**: One responsibility per file, clear naming conventions

## Governance

### Amendment Procedure

1. Identify constitution violation or missing principle
2. Document proposed change with justification
3. Update constitution version per semantic versioning:
   - **MAJOR**: Principle removal or incompatible change (e.g., abandon phase-based development)
   - **MINOR**: New principle added (e.g., add accessibility requirement)
   - **PATCH**: Clarification or typo fix (e.g., clarify testing requirement)
4. Update dependent templates if principle affects workflow
5. Update README.md if user-facing guidance changes

### Versioning Policy

- Version format: MAJOR.MINOR.PATCH
- Increment MAJOR for breaking changes to development principles
- Increment MINOR for new principles or significant expansions
- Increment PATCH for clarifications and non-semantic refinements
- Record all changes in Sync Impact Report comment

### Compliance Review

- Review compliance before each phase completion
- Verify Manifest V3 compliance before testing
- Check security practices during API integration
- Validate architecture patterns during code review
- All violations require justification in plan.md Complexity Tracking section

### Constitution Supersedes

This constitution takes precedence over:
- External Chrome extension tutorials (unless explicitly aligned)
- Default JavaScript patterns (when they conflict with extension requirements)
- Personal coding preferences (architecture must follow section IV)

**Version**: 1.0.0 | **Ratified**: 2025-10-17 | **Last Amended**: 2025-10-17
