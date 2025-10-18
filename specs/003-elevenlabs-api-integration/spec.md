# Feature Specification: ElevenLabs API Integration for Text-to-Speech

**Feature Branch**: `003-elevenlabs-api-integration`
**Created**: 2025-10-17
**Status**: Draft
**Phase**: 3 of 4 (follows Phase 2: Text Selection and Context Menu Integration)
**Input**: User description: "Integrate ElevenLabs text-to-speech API to convert captured text into audio and play it back to users"

## User Scenarios & Testing

### User Story 1 - Convert Captured Text to Speech via ElevenLabs API (Priority: P1) 🎯 MVP

As a user who has selected and captured text using the context menu, I want the extension to automatically send that text to ElevenLabs and receive audio back, so that I can hear the selected text read aloud in a natural voice.

**Why this priority**: This is the core value proposition of the extension - converting text to speech. Without this, Phase 2's text capture is just a preview feature with no real utility. This completes the basic TTS workflow and delivers the promised functionality.

**Independent Test**: Can be fully tested by: (1) selecting text on any web page, (2) clicking "Read with ElevenLabs" from context menu, (3) verifying API request is sent with the captured text, (4) verifying audio response is received from ElevenLabs, (5) confirming no errors occur during the API call. Delivers functional TTS conversion even if audio playback UI isn't polished yet.

**Acceptance Scenarios**:

1. **Given** I have configured a valid ElevenLabs API key in Phase 1, **When** I select text and click "Read with ElevenLabs", **Then** the extension sends my text to the ElevenLabs API and receives audio data back
2. **Given** I have selected a short paragraph (< 1000 characters), **When** the API request is made, **Then** I receive audio within 3 seconds
3. **Given** the API request is successful, **When** audio is received, **Then** I see a toast notification "Audio ready" instead of "Text captured"
4. **Given** I select text while another TTS request is in progress, **When** I click the context menu, **Then** the current request is cancelled and the new text is sent instead
5. **Given** my API key is valid and I have quota remaining, **When** I make an API request, **Then** the request succeeds without authentication errors

---

### User Story 2 - Automatic Audio Playback with Basic Controls (Priority: P2)

As a user who receives TTS audio, I want the audio to play automatically and have basic playback controls (pause/resume), so that I can listen to the content hands-free but still maintain control when needed.

**Why this priority**: Automatic playback creates a seamless user experience - users shouldn't have to click "play" after requesting TTS. Basic controls (pause/resume) are essential for usability but advanced controls (speed, skip) can wait for Phase 4.

**Independent Test**: Can be tested by: (1) triggering TTS on selected text, (2) verifying audio begins playing automatically when received, (3) clicking a pause button/icon to stop playback, (4) clicking resume to continue from where it paused, (5) verifying playback completes and cleans up properly.

**Acceptance Scenarios**:

1. **Given** I have received TTS audio from the API, **When** the audio loads, **Then** it begins playing automatically without requiring additional user action
2. **Given** audio is currently playing, **When** I click a pause control, **Then** playback pauses immediately at the current position
3. **Given** audio is paused, **When** I click the resume/play control, **Then** playback continues from where it was paused
4. **Given** audio is playing, **When** I select new text and trigger TTS again, **Then** the current audio stops and new audio begins playing
5. **Given** audio playback completes naturally, **When** the audio ends, **Then** all playback resources are cleaned up and UI returns to ready state

---

### User Story 3 - Robust Error Handling and User Feedback (Priority: P3)

As a user, I want clear error messages when TTS fails (invalid API key, rate limits, network issues), so that I understand what went wrong and know how to fix it.

**Why this priority**: Users will inevitably encounter errors (expired keys, exceeded quotas, network problems). Good error handling prevents frustration and support requests. This builds user trust but isn't required for the basic happy-path experience.

**Independent Test**: Can be tested by: (1) intentionally using an invalid API key and verifying clear error message, (2) simulating network failure and checking error handling, (3) testing with text that exceeds API limits, (4) verifying all errors show user-friendly toast notifications with actionable guidance.

**Acceptance Scenarios**:

1. **Given** I have not configured an API key or my key is invalid, **When** I try to use TTS, **Then** I see an error toast "Invalid API key. Please update in extension settings" with a link to settings
2. **Given** I have exceeded my ElevenLabs API quota, **When** I make a TTS request, **Then** I see an error toast "API quota exceeded. Please check your ElevenLabs account"
3. **Given** I have no internet connection, **When** I try to use TTS, **Then** I see an error toast "Network error. Please check your internet connection"
4. **Given** I select text that exceeds ElevenLabs character limits (>5000 chars), **When** I trigger TTS, **Then** I see a warning toast "Text too long. Maximum 5000 characters supported" and the request is not sent
5. **Given** the ElevenLabs API is temporarily unavailable (503 error), **When** I make a request, **Then** I see an error toast "Service temporarily unavailable. Please try again later"

---

### Edge Cases

- **What happens when API key is missing or empty?** Display error toast before making any API request: "No API key configured. Please add your ElevenLabs API key in extension settings." Provide a button/link to open settings popup.
- **What happens when selected text is very long (>5000 characters)?** Show warning toast and truncate text to 5000 characters before sending to API. Log truncation for debugging. (Note: ElevenLabs API has character limits per request)
- **What happens when API returns an audio format the browser doesn't support?** Show error toast "Unsupported audio format received" and log details for debugging. Fall back to alternative format if possible.
- **What happens when user selects new text while audio is playing?** Cancel current playback, cancel any pending API requests, clear audio buffer, and initiate new TTS request for the new text. Show "Loading new audio..." toast.
- **What happens when network request times out?** After 15 seconds timeout, show error toast "Request timed out. Please try again." and clean up pending requests.
- **What happens when API returns 401 Unauthorized?** Interpret as invalid/expired API key. Show error toast "API key is invalid or expired. Please update your key in settings."
- **What happens when API returns 429 Rate Limit Exceeded?** Show error toast with rate limit message and suggested retry time if available from headers.
- **What happens if browser blocks audio playback (autoplay policy)?** Detect autoplay block, show toast "Click to play audio" with a play button. When user clicks, attempt playback again.
- **What happens when user closes the browser tab while audio is playing?** Audio should stop immediately (browser automatically stops audio from closed tabs). Clean up resources in service worker.
- **What happens when text contains only special characters or emojis?** Send to API as-is. If API rejects it, show error toast "Unable to convert text to speech. Please select readable text."

## Requirements

### Functional Requirements

- **FR-001**: Extension MUST retrieve the API key from chrome.storage.local before making any API requests
- **FR-002**: Extension MUST validate API key is present and non-empty before attempting TTS conversion
- **FR-003**: Extension MUST send captured text to ElevenLabs API using the appropriate endpoint (text-to-speech API)
- **FR-004**: Extension MUST include API key in request headers as per ElevenLabs API authentication requirements
- **FR-005**: Extension MUST handle API response containing audio data (expected format: MP3 or similar browser-compatible format)
- **FR-006**: Extension MUST convert API response into playable audio (using browser's Audio API or HTMLAudioElement)
- **FR-007**: Extension MUST automatically begin audio playback when audio is successfully loaded
- **FR-008**: Extension MUST provide pause/resume controls during audio playback
- **FR-009**: Extension MUST display loading state while API request is in progress (e.g., "Converting text to speech..." toast)
- **FR-010**: Extension MUST display success feedback when audio is ready (e.g., "Audio ready" or auto-play indication)
- **FR-011**: Extension MUST handle API errors gracefully with user-friendly error messages
- **FR-012**: Extension MUST validate text length before sending to API (enforce 5000 character maximum or ElevenLabs limit)
- **FR-013**: Extension MUST cancel pending API requests if user triggers new TTS before previous request completes
- **FR-014**: Extension MUST stop current audio playback when new TTS is triggered
- **FR-015**: Extension MUST implement timeout for API requests (15 seconds maximum)
- **FR-016**: Extension MUST clean up audio resources (stop playback, release memory) when audio completes or is cancelled
- **FR-017**: Extension MUST log API request/response details for debugging (excluding sensitive data like full API keys)
- **FR-018**: Extension MUST handle browser autoplay policy restrictions (detect blocked autoplay and show manual play option)
- **FR-019**: Extension MUST work offline for Phase 2 text capture, but display appropriate error when attempting TTS without network
- **FR-020**: Extension MUST use reasonable default voice settings for API requests (default voice ID from ElevenLabs)

### Key Entities

- **API Request**: Outgoing request to ElevenLabs text-to-speech API. Attributes: text (string, captured from user selection), voice ID (string, default voice), API key (string, from storage), request ID (unique identifier for cancellation), timestamp (when request was initiated).

- **API Response**: Incoming response from ElevenLabs API containing audio data. Attributes: audio data (binary/blob, MP3 or compatible format), content type (string, e.g., "audio/mpeg"), status code (integer, HTTP status), error message (string, if request failed), response time (milliseconds, for performance tracking).

- **Audio Player State**: Current state of audio playback. Attributes: status (enum: idle, loading, playing, paused, error), current position (seconds, playback position), duration (seconds, total audio length), audio source (URL or blob), playback controls (play/pause/stop functions).

- **API Configuration**: Settings for API integration. Attributes: API key (string, stored securely), voice ID (string, default voice selection), base URL (string, ElevenLabs API endpoint), timeout (integer, milliseconds), max text length (integer, character limit).

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users receive TTS audio within 5 seconds for text selections under 1000 characters (measured from context menu click to audio playback start)
- **SC-002**: API success rate is at least 95% when valid API key is configured and quota is available (measured as successful 2xx responses; excludes 4xx client errors like invalid keys, expired tokens, or quota exceeded)
- **SC-003**: Users can successfully pause and resume audio playback with response time under 100ms
- **SC-004**: Error messages appear within 2 seconds of error occurrence and clearly indicate the problem and solution
- **SC-005**: Extension handles 100% of common API error scenarios (401, 429, 503, network timeout) with appropriate user feedback
- **SC-006**: Audio playback completes without interruption or glitches for 95% of successful requests
- **SC-007**: Extension successfully cancels pending requests when user triggers new TTS, with no orphaned requests or memory leaks
- **SC-008**: Browser autoplay policy blocks are detected and handled gracefully 100% of the time (manual play option provided)
- **SC-009**: No console errors or warnings appear during normal TTS operations (successful request and playback)
- **SC-010**: Users can make sequential TTS requests without requiring extension reload or browser refresh (tested with 10+ consecutive requests)

## Scope

### In Scope

- Integration with ElevenLabs text-to-speech API
- API key validation and error handling
- Audio playback using browser's native audio capabilities
- Basic playback controls (play/pause/stop)
- Automatic audio playback when ready
- Loading and success feedback via toast notifications
- Comprehensive error handling (invalid keys, rate limits, network errors, API errors)
- Request cancellation for sequential TTS triggers
- Audio resource cleanup
- Text length validation before API calls
- Timeout handling for API requests
- Browser autoplay policy handling

### Out of Scope (Future Phases)

- **Future Phase**: Voice selection UI (use default voice in Phase 3)
- **Future Phase**: Advanced playback controls (speed adjustment, skip forward/back, volume)
- **Future Phase**: Multiple voice profiles or custom voice settings
- **Future Phase**: Queueing multiple TTS requests
- **Future Phase**: Audio caching/offline playback
- **Future**: Text preprocessing (removing markdown, code, special formatting)
- **Future**: Real-time text highlighting during playback
- **Future**: Download audio files
- **Future**: Playlist or history of recent TTS
- **Future**: Custom API endpoint configuration
- **Future**: Support for other TTS providers

## Assumptions

1. **ElevenLabs API**: Users have or will create an ElevenLabs account and obtain an API key. API follows standard REST conventions with JSON payloads. API returns audio in browser-compatible format (MP3 or similar).

2. **API Key Storage**: Phase 1 already provides mechanism for storing API key in chrome.storage.local. API key validation is done by attempting actual API request (no separate validation endpoint assumed).

3. **Internet Connectivity**: Users must be online to use TTS features. No offline mode or caching in Phase 3. Network errors will be handled but won't prevent Phase 2 text capture from working offline.

4. **Browser Audio Support**: Chrome 88+ natively supports MP3 audio playback. No audio codec conversion needed. Browser's autoplay policy may block automatic playback on some sites, but extension can detect and handle this.

5. **Default Voice**: Extension will use Brian voice (voice_id: `nPczCjzI2devNBz1zQrb`) from ElevenLabs. Users cannot change voice in Phase 3 - that's deferred to future enhancement.

6. **Text Length Limits**: ElevenLabs API v1 has a 5000 character limit per request. Extension will enforce this client-side before making requests.

7. **API Performance**: ElevenLabs API responds within 5 seconds for typical text lengths (< 1000 chars). Longer text may take proportionally longer. Timeout set to 15 seconds to accommodate network latency.

8. **Single Active Request**: Only one TTS request is active at a time. Sequential requests automatically cancel previous pending requests. No queueing mechanism in Phase 3.

9. **Error Recovery**: Users must manually retry after errors. No automatic retry logic in Phase 3 (would require rate limit backoff strategy, deferred to future enhancement).

10. **Audio Format**: Assumed ElevenLabs returns audio that browser can play directly via Audio() or <audio> element. If special handling is needed, that's an implementation detail for planning phase.

## Dependencies

### Technical Dependencies

- **Phase 2 Completion**: Requires text capture, context menu, and toast notification infrastructure from Phase 2
- **Phase 1 Completion**: Requires API key storage mechanism from Phase 1
- **ElevenLabs API**: Active ElevenLabs API service with documented text-to-speech endpoint
- **Chrome APIs**: Depends on chrome.storage.local (API key retrieval), fetch API (HTTP requests), Audio API or HTMLAudioElement (playback)

### User Dependencies

- **ElevenLabs Account**: Users must create an ElevenLabs account and obtain an API key
- **API Key Configuration**: Users must configure API key in extension settings (Phase 1) before using TTS
- **Internet Connection**: Users must be online to make API requests
- **Browser Support**: Chrome 88+ or compatible Chromium browser with audio playback support

### External Dependencies

- **ElevenLabs API Availability**: Extension depends on ElevenLabs API being accessible and operational
- **API Quota**: Users must have available quota in their ElevenLabs account (free tier or paid plan)

## Risks & Mitigations

### Risk 1: API Rate Limiting Impacts User Experience
**Likelihood**: Medium
**Impact**: High (users unable to use extension)
**Mitigation**: Implement clear rate limit error messages with guidance on upgrading account. Display remaining quota if available from API headers. Add request throttling to prevent rapid sequential requests that waste quota.

### Risk 2: API Latency Exceeds User Expectations
**Likelihood**: Medium
**Impact**: Medium (users perceive extension as slow)
**Mitigation**: Display loading state immediately when request starts. Set realistic timeout (15s). Optimize text by trimming whitespace and removing unnecessary characters. Consider chunking very long text in future phases.

### Risk 3: API Authentication Failures Due to Invalid/Expired Keys
**Likelihood**: High (user error)
**Impact**: Medium (user cannot use feature until fixed)
**Mitigation**: Validate API key presence before making requests. Provide clear error messages with link to settings. Consider adding "Test API Key" button in settings (future enhancement). Log authentication errors separately for easier debugging.

### Risk 4: Browser Autoplay Policy Blocks Audio
**Likelihood**: High (browser security feature)
**Impact**: Medium (user must manually click play)
**Mitigation**: Detect autoplay failures using audio.play() promise rejection. Immediately show toast with play button when autoplay is blocked. Educate users that clicking context menu counts as user interaction (may help with autoplay policy).

### Risk 5: Network Failures Cause Poor User Experience
**Likelihood**: Medium
**Impact**: Medium (temporary feature unavailability)
**Mitigation**: Implement proper timeout handling (15s). Show user-friendly error messages for network issues. Ensure Phase 2 text capture continues working offline. Add retry option in error toast for transient failures.

## Next Steps

After specification approval:
1. Run `/speckit.plan` to generate technical implementation plan with API integration details
2. Run `/speckit.tasks` to break down into actionable tasks
3. Run `/speckit.implement` to execute Phase 3 implementation on this branch (003-elevenlabs-api-integration)
