# Implementation Plan: Voice Selection

**Branch**: `006-voice-selection` | **Date**: 2025-10-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-voice-selection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature adds voice selection capability to the ElevenLabs TTS Chrome extension. Users will be able to view available voices from the ElevenLabs API in a dropdown menu within the extension popup, preview voices before selection, and persist their voice preference across browser sessions using chrome.storage.local. The selected voice will be automatically applied to all text-to-speech playback operations, with graceful fallback to a default voice when the selected voice becomes unavailable.

## Technical Context

**Language/Version**: JavaScript ES2020+ (Chrome extension runtime environment)
**Primary Dependencies**: None (vanilla JavaScript, uses built-in Chrome APIs only)
**Storage**: chrome.storage.local for persistent voice preference, chrome.storage.local with 24-hour TTL for voice list cache
**Testing**: Manual testing in Chrome browser (chrome://extensions with unpacked extension)
**Target Platform**: Chrome 88+ (Manifest V3 minimum)
**Project Type**: Chrome extension (single project with popup UI, background service worker, content scripts, offscreen audio player)
**Performance Goals**: Voice list loads within 2 seconds of popup open, voice previews play within 1 second of button click
**Constraints**:
- Must use Manifest V3 APIs (service workers, not persistent background pages)
- Voice list cache expires after 24 hours to keep data fresh
- Auto-save on dropdown selection change (no explicit save button)
- Single preview button architecture (previews currently selected voice only)
**Scale/Scope**: Expected 10-50 voices from ElevenLabs API, single user per browser profile, minimal memory footprint (<2MB additional storage)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Phase-First Development (Principle I)
✅ **PASS** - This feature integrates into existing phase-based architecture. Implementation will add voice selection UI to existing popup (Phase 1 extension), integrate with existing API layer (Phase 3), and enhance existing playback system (Phase 4). No new phases required.

### Manifest V3 Compliance (Principle II)
✅ **PASS** - Feature uses only compliant APIs:
- chrome.storage.local for voice preference persistence
- Existing service worker for ElevenLabs API calls
- Existing offscreen document for audio playback
- No new permissions required (storage and offscreen already declared)

### Security & Privacy First (Principle III)
✅ **PASS** - Security considerations addressed:
- No new API keys or credentials needed
- Voice data cached in chrome.storage.local (no external transmission except ElevenLabs API)
- Voice list cache expires after 24 hours (no stale data accumulation)
- Preview audio generated on-demand (no persistent storage of preview data)
- Falls back to default voice gracefully (no user data exposure on errors)

### Chrome Extension Best Practices (Principle IV)
✅ **PASS** - Architecture follows extension patterns:
- Popup UI handles voice selection dropdown and preview button
- Background service worker manages voice list API calls and caching
- Offscreen document handles preview audio playback
- Message passing via chrome.runtime.sendMessage for communication
- Lightweight implementation (<50KB additional code estimated)

### Testing Before Proceeding (Principle V)
✅ **PASS** - Testing strategy defined:
- Test voice dropdown population from API
- Test voice selection persistence across popup open/close cycles
- Test preview button functionality for multiple voices
- Test fallback behavior when selected voice unavailable
- Test on multiple websites to verify integration with existing playback
- Verify console shows no errors

**Constitution Compliance**: ALL GATES PASSED ✅

## Project Structure

### Documentation (this feature)

```
specs/006-voice-selection/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── elevenlabs-voices-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
# Chrome Extension Structure (single project)
/
├── manifest.json              # Already exists - no changes needed
├── popup.html                 # MODIFY: Add voice dropdown and preview button
├── popup.js                   # MODIFY: Add voice selection logic
├── popup.css                  # MODIFY: Add styles for voice selector
├── background.js              # MODIFY: Add voice list fetching and caching
├── offscreen.js               # MODIFY: Add preview audio playback support
├── content.js                 # NO CHANGE
└── src/
    ├── api/
    │   ├── elevenlabs.js      # MODIFY: Add getVoices() function, support voiceId in textToSpeech()
    │   └── audio.js           # MODIFY: Add preview audio playback
    └── utils/
        ├── storage.js         # MODIFY: Add getVoicePreference(), setVoicePreference(), getVoiceCache(), setVoiceCache()
        └── errors.js          # NO CHANGE
```

**Structure Decision**: This is a Chrome extension following Manifest V3 architecture. The project uses a flat structure with popup UI, background service worker, offscreen audio player, and content scripts. Voice selection feature integrates into existing popup UI and extends existing storage/API utilities.

## Complexity Tracking

*No constitution violations - this section is empty*
