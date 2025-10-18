# Implementation Plan: ElevenLabs API Integration for Text-to-Speech

**Branch**: `003-elevenlabs-api-integration` | **Date**: 2025-10-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-elevenlabs-api-integration/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Integrate ElevenLabs text-to-speech API to convert user-selected text into audio playback. This phase implements the core TTS functionality building on Phase 2's text capture infrastructure, including API authentication, request handling, audio playback, and comprehensive error handling for network issues, rate limits, and API failures.

## Technical Context

**Language/Version**: JavaScript ES2020+ (Chrome extension runtime environment, Chrome 88+ required for Manifest V3)
**Primary Dependencies**: ElevenLabs Text-to-Speech API v1, Chrome Extension APIs (chrome.storage, chrome.runtime), Fetch API for HTTP requests, Web Audio API or HTMLAudioElement for playback
**Default Voice**: Brian (voice_id: `nPczCjzI2devNBz1zQrb`) - clear, natural English voice
**Storage**: chrome.storage.local for API key (from Phase 1), chrome.storage.session for captured text (from Phase 2)
**Testing**: Manual testing in Chrome browser via chrome://extensions (load unpacked), testing on multiple websites
**Target Platform**: Chrome 88+ (Manifest V3 minimum support)
**Project Type**: Chrome Extension (single project structure with background service worker, content scripts, popup UI)
**Performance Goals**: Audio delivered within 5 seconds for < 1000 character text, pause/resume response < 100ms, 95%+ API success rate with valid credentials
**Constraints**: 15 second API timeout, 5000 character max text length (ElevenLabs API v1 limit), browser autoplay policy compliance, service worker lifecycle compatibility, ES modules for service worker imports
**Scale/Scope**: Single user extension, sequential TTS requests (no queueing), default voice only (Phase 4 adds voice selection)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Phase-First Development ✅ PASS
- **Requirement**: Complete Phase 2 (Text Selection) before Phase 3 (API Integration)
- **Status**: Phase 2 implementation is complete (text capture, context menu, toast notifications functional)
- **Evidence**: Phase 2 branch merged, Phase 3 builds on existing text capture infrastructure
- **Action**: None required

### II. Manifest V3 Compliance ✅ PASS
- **Requirement**: Use service workers, chrome.storage API, no blocking requests
- **Status**: Design uses background service worker for API calls, chrome.storage.local for API key retrieval
- **Evidence**: Technical Context specifies chrome.storage.local and service worker architecture
- **Action**: Ensure service worker lifecycle handling for API requests (add to Phase 0 research)

### III. Security & Privacy First ✅ PASS
- **Requirement**: Secure API key storage, minimal permissions, no data leakage
- **Status**: API key stored in chrome.storage.local (from Phase 1), no third-party data sharing
- **Evidence**: FR-001, FR-002, FR-017 address secure key handling and logging without exposing keys
- **Action**: Validate API key encryption options in Phase 0 research

### IV. Chrome Extension Best Practices ✅ PASS
- **Requirement**: Content scripts for page interaction, background worker for API calls, proper message passing
- **Status**: Architecture follows extension patterns - content script captures text, service worker handles ElevenLabs API
- **Evidence**: Technical Context specifies chrome.runtime for message passing, service worker for API operations
- **Action**: Document message passing protocol in Phase 1 contracts

### V. Testing Before Proceeding ✅ PASS
- **Requirement**: Manual testing in Chrome on 3+ websites, verify error scenarios
- **Status**: Testing strategy defined in Success Criteria (SC-001 through SC-010)
- **Evidence**: Spec includes test scenarios for multiple websites, error conditions, sequential requests
- **Action**: Create testing checklist in quickstart.md during Phase 1

**GATE RESULT**: ✅ ALL CHECKS PASS - Proceed to Phase 0 Research

**Post-Design Re-evaluation Required**: Yes, after Phase 1 design artifacts are generated

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
tts-11labs-chrome-extension/
├── manifest.json           # Chrome extension manifest (Phase 1)
├── popup.html             # Extension popup UI (Phase 1)
├── popup.js               # Popup logic for settings (Phase 1)
├── background.js          # Service worker - Phase 3 adds API integration here
├── content.js             # Content script for text selection (Phase 2)
├── styles.css             # Shared styles
├── icons/                 # Extension icons (Phase 1)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/                   # NEW in Phase 3
    ├── api/
    │   ├── elevenlabs.js  # ElevenLabs API client
    │   └── audio.js       # Audio playback manager
    └── utils/
        ├── storage.js     # chrome.storage wrapper utilities
        └── errors.js      # Error handling and user messages
```

**Structure Decision**: Chrome Extension single project structure. Phase 3 adds new `src/` directory for API integration code. The background service worker (`background.js`) will import modules from `src/api/` to handle ElevenLabs requests and audio playback. Existing `content.js` from Phase 2 will send captured text to background worker via chrome.runtime.sendMessage.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

