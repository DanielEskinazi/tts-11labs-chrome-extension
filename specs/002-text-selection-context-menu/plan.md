# Implementation Plan: Text Selection and Context Menu Integration

**Branch**: `002-text-selection-context-menu` | **Date**: 2025-10-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-text-selection-context-menu/spec.md`

## Summary

Implement Phase 2 of the ElevenLabs TTS Chrome Extension: text selection and context menu integration. This phase adds the ability for users to select text on any web page and trigger text-to-speech via a right-click context menu option. The implementation uses a content script for text capture, message passing to a background service worker, and a toast notification for visual feedback. No actual TTS functionality is implemented in this phase (deferred to Phase 3).

## Technical Context

**Language/Version**: JavaScript ES2020+ (Chrome extension runtime environment)
**Primary Dependencies**: None (vanilla JavaScript, uses built-in Chrome APIs only)
**Storage**: chrome.storage.session for captured text (survives service worker restarts), chrome.storage.local for persistent settings (from Phase 1)
**Testing**: Manual testing in Chrome browser (chrome://extensions load unpacked)
**Target Platform**: Chrome 88+ (Manifest V3 minimum requirement)
**Project Type**: Chrome Extension (browser extension with content scripts, service worker, popup UI)
**Performance Goals**: <50ms added page load time, <100ms context menu appearance, <5MB memory per tab
**Constraints**: Manifest V3 compliance (NON-NEGOTIABLE), CSP compliant (no inline scripts/styles), <5MB total extension size, <500KB per file
**Scale/Scope**: Single-user local installation, content script injected into all web pages, service worker for message handling, 3 new files (content.js, background.js, toast.css)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Phase-First Development (Principle I)

**Status**: ✅ COMPLIANT

- Phase 2 follows completed Phase 1 (Basic Setup)
- Phase 2 is self-contained: content script, context menu, message passing, toast UI
- No Phase 3 features (TTS API integration, audio playback) are included
- Testing checkpoint defined: text selection works, context menu appears, toast shows confirmation
- Phase 2 can be tested independently without Phase 3

### Manifest V3 Compliance (Principle II - NON-NEGOTIABLE)

**Status**: ✅ COMPLIANT

- Using Manifest V3 background service worker (not persistent background page)
- New permissions justified: `contextMenus` (for right-click menu), `activeTab` (for text selection), `scripting` (for content script injection)
- Using chrome.storage.session API (not localStorage)
- Content script has no inline scripts (CSP compliant)
- Service worker properly handles lifecycle (automatic wake on events)

### Security & Privacy First (Principle III)

**Status**: ✅ COMPLIANT

- Captured text stored in chrome.storage.session only (not transmitted to any server in Phase 2)
- API key not validated or used in Phase 2 (deferred to Phase 3)
- Toast notification uses Shadow DOM with closed mode (prevents page JavaScript access)
- HTML escaping prevents XSS in toast messages
- No external API calls in Phase 2 (all local)

### Chrome Extension Best Practices (Principle IV)

**Status**: ✅ COMPLIANT

- Content script (`content.js`) handles text selection and DOM interaction
- Background service worker (`background.js`) manages context menu and message routing
- Popup UI (from Phase 1) remains for settings
- Message passing via chrome.runtime.sendMessage (proper API)
- Resource cleanup implemented (event listeners, toast removal)
- Total extension size well under 5MB (estimated <100KB for Phase 2 additions)

### Testing Before Proceeding (Principle V)

**Status**: ✅ COMPLIANT

- Manual testing plan defined for Phase 2
- Test scenarios: 10+ popular websites (Google Docs, Medium, Twitter, Reddit, Wikipedia, GitHub, Gmail, NYTimes, Stack Overflow, Amazon)
- Keyboard shortcuts not applicable (Phase 4)
- Error scenarios: no text selected, long text, special characters, CSP violations
- Console checking for errors and warnings
- Memory leak validation via Chrome Task Manager

**GATE RESULT**: ✅ PASS - All principles satisfied, no violations

## Project Structure

### Documentation (this feature)

```
specs/002-text-selection-context-menu/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── message-schema.json
│   └── toast-api.json
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
/
├── manifest.json        # UPDATED: Add content_scripts, background, new permissions
├── background.js        # NEW: Service worker for context menu and message handling
├── content.js           # NEW: Content script for text selection and toast display
├── toast.css            # NEW: Styles for toast notification (Shadow DOM)
├── popup.html           # UNCHANGED (from Phase 1)
├── popup.js             # UNCHANGED (from Phase 1)
├── popup.css            # UNCHANGED (from Phase 1)
└── icons/               # UNCHANGED (from Phase 1)
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

**Structure Decision**: Single project structure (Chrome extension at repository root). Phase 2 adds 3 new files and updates manifest.json. No backend/frontend separation needed as this is a browser extension. Future phases will continue adding files to root directory (e.g., `audio.js` in Phase 4).

## Complexity Tracking

*No constitution violations - this section is empty*

## Architecture

### Extension Components

**1. Content Script (`content.js`)**
- **Purpose**: Injected into all web pages to capture text selection and show toast notifications
- **Scope**: Runs in isolated environment with access to page DOM but not page JavaScript context
- **Lifecycle**: Loads when page loads, persists until page closes or reloads
- **Key Responsibilities**:
  - Listen for chrome.runtime messages from service worker
  - Get selected text via `window.getSelection()`
  - Create and display toast notification using Shadow DOM
  - Send captured text to service worker via chrome.runtime.sendMessage

**2. Background Service Worker (`background.js`)**
- **Purpose**: Manages context menu, receives messages from content scripts, stores captured text
- **Scope**: Runs in background, no DOM access, can access all Chrome APIs
- **Lifecycle**: Starts on extension load, terminates after 30 seconds of inactivity, auto-wakes on events
- **Key Responsibilities**:
  - Register context menu item on extension install
  - Handle context menu clicks
  - Send message to active tab's content script to capture text
  - Receive captured text from content script
  - Store captured text in chrome.storage.session
  - Log captured text for debugging

**3. Manifest Configuration (`manifest.json`)**
- **Purpose**: Declares extension metadata, permissions, and entry points
- **Updates for Phase 2**:
  - Add `background.service_worker` pointing to `background.js`
  - Add `content_scripts` with `matches: ["<all_urls>"]` and `js: ["content.js"]`, `css: ["toast.css"]`
  - Add permissions: `contextMenus`, `activeTab`, `scripting`
  - Update version to 1.1.0 (Phase 1 was 1.0.0)

### Data Flow

```
User selects text on web page
    ↓
User right-clicks → Chrome shows context menu with "Read with ElevenLabs"
    ↓
User clicks menu item → Chrome fires chrome.contextMenus.onClicked event
    ↓
Background service worker receives event
    ↓
Service worker sends message to content script: {type: "CAPTURE_TEXT"}
    ↓
Content script receives message → Gets window.getSelection()
    ↓
Content script trims and validates text
    ↓
Content script sends message back to service worker: {type: "TEXT_CAPTURED", payload: {text, url, timestamp}}
    ↓
Service worker receives message → Stores in chrome.storage.session
    ↓
Service worker sends confirmation to content script: {type: "SHOW_TOAST", payload: {text}}
    ↓
Content script creates Shadow DOM toast → Shows notification for 3 seconds → Removes toast
```

### Message Schema

All messages use this structure:
```javascript
{
  type: string,           // Message type: "CAPTURE_TEXT", "TEXT_CAPTURED", "SHOW_TOAST"
  payload: object | null, // Message-specific data
  timestamp: number       // Unix timestamp in milliseconds
}
```

### Performance Strategy

**Content Script Performance**:
- Inject at `document_idle` (after page loads, doesn't block rendering)
- Use passive event listeners where possible
- Minimize DOM queries
- Shadow DOM overhead: ~1-2ms per toast (negligible)

**Service Worker Performance**:
- Lightweight message handling (<10ms)
- Chrome automatically wakes service worker on events (no manual management needed)
- chrome.storage.session is fast (~5ms read/write)

**Memory Management**:
- Content script: <2MB per tab (lightweight)
- Service worker: <1MB (no DOM, minimal state)
- Toast cleanup: Remove from DOM after 3 seconds

## Key Technical Decisions

### Decision 1: Content Script Injection Method

**Chosen**: Static declaration in manifest.json with `document_idle`

**Rationale**:
- Automatic injection on all pages (no manual triggering needed)
- `document_idle` doesn't block critical rendering path
- Simplest approach for Phase 2 (no complex logic needed)

**Alternatives Considered**:
- Programmatic injection via chrome.scripting.executeScript: Rejected - requires user action first, more complex
- `document_end`: Rejected - may block rendering, `document_idle` is safer

**Implementation**: Add to manifest.json:
```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"],
  "css": ["toast.css"],
  "run_at": "document_idle",
  "all_frames": false
}]
```

### Decision 2: Message Passing Pattern

**Chosen**: chrome.runtime.sendMessage for one-time messages

**Rationale**:
- Simple API for Phase 2 (single message per text capture)
- Chrome automatically wakes service worker on sendMessage
- Sufficient for current requirements (no long-lived connection needed)

**Alternatives Considered**:
- Port API (chrome.runtime.connect): Rejected - overkill for single messages, adds complexity
- Custom event system: Rejected - reinvents Chrome's message passing

**Implementation**:
- Content script: `chrome.runtime.sendMessage({type: "TEXT_CAPTURED", payload})`
- Service worker: `chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {...})`

**Critical Note**: Event listeners MUST be registered at top-level (synchronously), not inside promises/callbacks, or service worker won't wake properly.

### Decision 3: Toast Notification Implementation

**Chosen**: Shadow DOM with closed mode

**Rationale**:
- Complete CSS isolation (prevents page styles from affecting toast)
- Prevents page JavaScript from accessing toast DOM
- Industry standard for browser extension UI components
- Minimal performance overhead (~1-2ms)

**Alternatives Considered**:
- Regular DOM injection: Rejected - high risk of CSS conflicts with page styles
- Chrome notifications API: Rejected - too intrusive, doesn't match UX requirements
- iframe: Rejected - more overhead than Shadow DOM, CSP issues

**Implementation**:
```javascript
const container = document.createElement('div');
const shadow = container.attachShadow({mode: 'closed'});
shadow.innerHTML = `<style>/* toast.css contents */</style><div class="toast">...</div>`;
document.body.appendChild(container);
```

### Decision 4: Service Worker State Management

**Chosen**: chrome.storage.session + in-memory cache hybrid

**Rationale**:
- chrome.storage.session survives service worker restarts (persists for browser session)
- In-memory cache for fast access during active period
- Privacy-friendly (clears on browser close)
- Meets Phase 2 requirements (store for Phase 3 integration)

**Alternatives Considered**:
- In-memory only: Rejected - data lost on service worker termination (every 30 seconds)
- chrome.storage.local: Rejected - persists forever, not needed for temporary text capture
- localStorage: Rejected - not available in service workers

**Implementation**:
```javascript
let capturedTextCache = null; // In-memory cache

async function storeCapturedText(text, url) {
  capturedTextCache = {text, url, timestamp: Date.now()};
  await chrome.storage.session.set({lastCapturedText: capturedTextCache});
}
```

### Decision 5: Context Menu Configuration

**Chosen**: Single menu item with dynamic visibility (contexts: ["selection"])

**Rationale**:
- Chrome automatically shows/hides menu based on text selection
- Simple implementation for Phase 2
- Matches user expectations (appears only when relevant)

**Alternatives Considered**:
- Always visible menu item: Rejected - clutters context menu when not relevant
- Multiple menu items: Rejected - not needed for Phase 2 (only one action)

**Implementation**:
```javascript
chrome.contextMenus.create({
  id: "read-with-elevenlabs",
  title: "Read with ElevenLabs",
  contexts: ["selection"],
  documentUrlPatterns: ["http://*/*", "https://*/*"]
});
```

## Phase 0: Research Findings

See `research.md` for complete technical research. Key findings:

1. **Content Script Injection**: Use static manifest declaration with `document_idle` for best performance
2. **Message Passing**: Use sendMessage API, ensure top-level listener registration
3. **Toast Notifications**: Shadow DOM with closed mode for CSS isolation
4. **Service Worker Lifecycle**: Terminates after 30 seconds, auto-wakes on events, use chrome.storage.session for state

## Phase 1: Design Artifacts

See individual files for complete details:

- `data-model.md`: Entities (SelectedText, ContextMenuItem, ToastNotification, Message)
- `contracts/message-schema.json`: Message structure specification
- `contracts/toast-api.json`: Toast notification API contract
- `quickstart.md`: Step-by-step implementation guide

## Next Steps

After plan approval:
1. Review generated artifacts (research.md, data-model.md, contracts/, quickstart.md)
2. Run `/speckit.tasks` to generate actionable task breakdown
3. Run `/speckit.implement` to execute implementation
