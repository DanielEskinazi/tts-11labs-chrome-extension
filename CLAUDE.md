# tts-11labs-chrome-extension Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-17

## Active Technologies
- JavaScript ES2020+ (Chrome extension runtime environment) + None (vanilla JavaScript, uses built-in Chrome APIs only) (001-feature-name)
- chrome.storage.session for captured text (survives service worker restarts), chrome.storage.local for persistent settings (from Phase 1) (002-text-selection-context-menu)
- chrome.storage.session for transient playback state (if needed across service worker restarts); no persistent storage required (004-audio-playback-controls)
- chrome.storage.local for persistent speed preference (key: `playbackSpeed`, value: 0.5-2.0) (005-playback-speed-control)
- chrome.storage.local for persistent voice preference, chrome.storage.local with 24-hour TTL for voice list cache (006-voice-selection)
- JavaScript ES2020+ (Chrome extension runtime environment) + None (vanilla JavaScript, uses built-in Chrome APIs and DOM APIs) (007-text-highlighting)
- chrome.storage.session for playback state tracking (if needed), no persistent storage for highlights (007-text-highlighting)

## Project Structure
```
src/
tests/
```

## Commands
npm test && npm run lint

## Code Style
JavaScript ES2020+ (Chrome extension runtime environment): Follow standard conventions

## Recent Changes
- 007-text-highlighting: Added JavaScript ES2020+ (Chrome extension runtime environment) + None (vanilla JavaScript, uses built-in Chrome APIs and DOM APIs)
- 006-voice-selection: Added JavaScript ES2020+ (Chrome extension runtime environment) + None (vanilla JavaScript, uses built-in Chrome APIs only)
- 005-playback-speed-control: Added JavaScript ES2020+ (Chrome extension runtime environment)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
