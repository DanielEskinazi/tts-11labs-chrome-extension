# ElevenLabs Text-to-Speech Chrome Extension

## Project Overview
A Chrome extension that converts selected text or entire web pages to speech using the ElevenLabs API. Users can highlight text to have it read aloud or convert entire articles/pages to audio with customizable voices and playback controls.

## Core Features

### MVP Features (Phase 1)
- [ ] **API Key Management**: Secure storage of ElevenLabs API key via popup interface
- [ ] **Text Selection Reading**: Right-click context menu to read highlighted text
- [ ] **Basic Audio Controls**: Play, pause, stop functionality
- [ ] **Keyboard Shortcuts**: 
  - `Alt+R`: Read selected text
  - `Alt+P`: Play/Pause
  - `Alt+S`: Stop
  - `Alt+A`: Read entire page

### Enhanced Features (Phase 2)
- [ ] **Full Page Reading**: Smart content extraction (main content only, skip nav/ads)
- [ ] **Voice Selection**: Dropdown to choose from user's ElevenLabs voices
- [ ] **Playback Speed**: 0.5x to 2.0x speed control
- [ ] **Progress Indicator**: Visual indicator of reading progress
- [ ] **Audio Caching**: Cache recent conversions to reduce API calls
- [ ] **Skip Controls**: Jump forward/backward by sentence

## Technical Requirements

### Chrome Extension Manifest V3
```json
{
  "manifest_version": 3,
  "name": "ElevenLabs Reader",
  "version": "1.0.0",
  "description": "Convert text to speech using ElevenLabs AI voices",
  "permissions": [
    "storage",
    "contextMenus",
    "activeTab",
    "scripting"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }],
  "commands": {
    "read-selection": {
      "suggested_key": { "default": "Alt+R" },
      "description": "Read selected text"
    },
    "play-pause": {
      "suggested_key": { "default": "Alt+P" },
      "description": "Play/Pause audio"
    },
    "stop": {
      "suggested_key": { "default": "Alt+S" },
      "description": "Stop audio"
    },
    "read-page": {
      "suggested_key": { "default": "Alt+A" },
      "description": "Read entire page"
    }
  }
}
```

### File Structure
```
elevenlabs-reader/
├── manifest.json
├── popup.html
├── popup.js
├── popup.css
├── background.js
├── content.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── lib/
    └── readability.js (for content extraction)
```

## Implementation Details

### 1. Popup Interface (popup.html/js)
```javascript
// Key functionality:
// - API key input field with secure storage
// - Voice selection dropdown (populated from API)
// - Test connection button
// - Save settings functionality
```

### 2. Content Script (content.js)
```javascript
// Key functionality:
// - Detect text selection
// - Extract page content for full-page reading
// - Send selected/page text to background script
// - Show visual indicators during reading
```

### 3. Background Service Worker (background.js)
```javascript
// Key functionality:
// - Handle ElevenLabs API calls
// - Manage audio playback
// - Context menu creation
// - Command shortcuts handling
// - Audio caching system
```

### 4. ElevenLabs API Integration
```javascript
// API Endpoints:
// - GET /v1/voices - Retrieve available voices
// - POST /v1/text-to-speech/{voice_id} - Convert text to speech
// - GET /v1/user - Get user info and character limits

// Request format:
const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
  method: 'POST',
  headers: {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: selectedText,
    model_id: "eleven_monolingual_v1",
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5
    }
  })
});
```

## Development Phases

### Phase 1: Basic Setup (Day 1)
1. Create extension structure and manifest
2. Build popup UI for API key input
3. Implement secure storage using Chrome Storage API
4. Add icons and basic styling

### Phase 2: Text Selection (Day 2)
1. Implement content script for text detection
2. Add context menu for selected text
3. Create communication between content and background scripts
4. Test text selection across different websites

### Phase 3: API Integration (Day 3)
1. Implement ElevenLabs API connection
2. Add voice fetching functionality
3. Implement text-to-speech conversion
4. Handle API errors and rate limits

### Phase 4: Audio Playback (Day 4)
1. Create audio player in background script
2. Implement play/pause/stop controls
3. Add keyboard shortcuts
4. Handle audio streaming/buffering

### Phase 5: Full Page Reading (Day 5)
1. Integrate Readability.js or similar for content extraction
2. Implement page parsing logic
3. Add reading progress indicators
4. Test on various website types

### Phase 6: Polish & Testing (Day 6-7)
1. Add loading states and error messages
2. Implement audio caching
3. Add playback speed controls
4. Comprehensive testing and bug fixes

## Error Handling

### API Errors
- Invalid API key: Show clear message in popup
- Rate limit exceeded: Queue requests or show cooldown timer
- Network errors: Retry with exponential backoff

### Content Errors
- No text selected: Show tooltip reminder
- Page extraction failed: Fallback to basic text extraction
- Audio playback errors: Provide troubleshooting steps

## Testing Checklist
- [ ] API key storage and retrieval
- [ ] Text selection on various websites
- [ ] Context menu functionality
- [ ] Keyboard shortcuts work globally
- [ ] Audio playback controls
- [ ] Voice switching
- [ ] Full page reading accuracy
- [ ] Error handling for all scenarios
- [ ] Performance with long texts
- [ ] Memory management for cached audio

## Future Enhancements
- Download audio files for offline listening
- Reading history and bookmarks
- Sync settings across devices
- Custom voice creation integration
- PDF and Google Docs support
- Reading speed ramping (slow start, normal speed)
- Sentence highlighting during playback
- Mobile companion app

## Resources
- [ElevenLabs API Documentation](https://docs.elevenlabs.io/api-reference/quick-start/introduction)
- [Chrome Extension Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Readability.js](https://github.com/mozilla/readability) for content extraction

## Development Notes
- Keep the extension lightweight and fast
- Minimize permissions requested
- Use event pages instead of persistent background pages
- Implement proper cleanup for audio resources
- Consider CORS limitations for content scripts
- Test with various ElevenLabs subscription tiers