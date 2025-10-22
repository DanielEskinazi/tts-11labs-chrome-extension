# Feature Specification: Text Selection and Context Menu Integration

**Feature Branch**: `002-text-selection-context-menu`
**Created**: 2025-10-17
**Status**: Draft
**Phase**: 2 of 4 (follows Phase 1: Basic Extension Setup)

## User Scenarios & Testing

### User Story 1 - Select Text and Trigger TTS via Context Menu (Priority: P1) 🎯 MVP

As a user browsing any website, I want to select text and right-click to access a "Read with ElevenLabs" option, so that I can trigger text-to-speech without leaving the page or opening the extension popup.

**Why this priority**: This is the core interaction pattern for the entire extension. Without this, users cannot use TTS functionality on web pages. This is the minimum viable product for Phase 2.

**Independent Test**: Can be fully tested by: (1) selecting text on any web page, (2) right-clicking to open context menu, (3) verifying "Read with ElevenLabs" option appears, (4) clicking the option and verifying text is captured and confirmation shown. Delivers the complete user flow even if TTS audio playback isn't implemented yet.

**Acceptance Scenarios**:

1. **Given** I am on any web page with text content, **When** I select a paragraph of text and right-click, **Then** I see "Read with ElevenLabs" in the context menu
2. **Given** I have selected text and opened the context menu, **When** I click "Read with ElevenLabs", **Then** the selected text is captured and I see a visual confirmation (toast notification)
3. **Given** I have no text selected, **When** I right-click on the page, **Then** the "Read with ElevenLabs" option does not appear in the context menu
4. **Given** I select text and trigger TTS, **When** the text is captured successfully, **Then** a green toast appears with message "Text captured: [first 30 chars]..."
5. **Given** I select very long text (>5000 characters), **When** I trigger TTS, **Then** I see a warning notification "Text is very long, this may take a while"

---

### User Story 2 - Seamless Experience Across Different Websites (Priority: P2)

As a user who reads content across various websites (news, blogs, documentation, social media), I want the extension to work consistently on all sites without breaking page functionality, so that I can trust it won't interfere with my browsing experience.

**Why this priority**: Users will test this extension on their most-used websites. If it breaks any of those sites or behaves inconsistently, they'll uninstall immediately. This builds trust and ensures broad usability.

**Independent Test**: Can be tested by visiting 10+ popular websites (Google Docs, Medium, Twitter/X, Reddit, Wikipedia, GitHub, Gmail, NYTimes, Stack Overflow, Amazon), selecting text on each, and verifying: (1) context menu appears correctly, (2) text selection works normally, (3) no console errors, (4) page functionality remains intact.

**Acceptance Scenarios**:

1. **Given** I am on a website with custom JavaScript (e.g., Google Docs), **When** I select text and trigger TTS, **Then** the site's native functionality (copy/paste, formatting) continues to work normally
2. **Given** I am on a website with strict Content Security Policy (CSP), **When** the extension content script loads, **Then** no CSP violations appear in console and extension functions correctly
3. **Given** I am on a single-page application (SPA) like Gmail, **When** I navigate between different views, **Then** the extension continues to work without requiring page reload
4. **Given** I am on a website with iframes or shadow DOM, **When** I select text within these elements, **Then** the extension can still capture the text correctly
5. **Given** I am on a mobile-responsive website, **When** I select text on different screen sizes, **Then** the context menu appears correctly without layout issues

---

### User Story 3 - Fast and Lightweight Extension (Priority: P3)

As a user who values browser performance, I want the extension to load quickly and not slow down page rendering, so that my browsing experience remains smooth.

**Why this priority**: Users are sensitive to extensions that slow down their browser. Poor performance leads to immediate uninstalls and negative reviews. This ensures the extension is invisible until needed.

**Independent Test**: Can be tested by: (1) measuring page load times with and without extension, (2) verifying extension adds <50ms to initial page load, (3) checking memory usage remains minimal (<5MB), (4) confirming no performance degradation on low-end devices.

**Acceptance Scenarios**:

1. **Given** I open a new web page, **When** the page loads with the extension active, **Then** the page renders within 50ms of baseline (extension disabled)
2. **Given** I have the extension installed, **When** I check browser memory usage, **Then** the extension's content scripts use less than 5MB of memory per tab
3. **Given** I am browsing a complex web application (e.g., Figma, Google Maps), **When** the page is rendering graphics or animations, **Then** the extension does not cause frame drops or stuttering
4. **Given** I open the browser's DevTools Performance tab, **When** I analyze page load, **Then** the extension's content script execution time is under 10ms
5. **Given** I am on a website with many images and scripts, **When** the extension initializes, **Then** it does not block or delay the page's critical rendering path

---

### Edge Cases

- **What happens when no text is selected?** Context menu option should not appear at all (Chrome will automatically hide it based on "contexts": ["selection"])
- **What happens when very long text is selected (>10,000 characters)?** Show a warning toast to user, but still capture the text. Phase 3 will handle chunking for API calls.
- **What happens when selected text contains special characters (emojis, non-Latin scripts, HTML entities)?** Text should be captured exactly as rendered in the browser, preserving Unicode characters. HTML tags should be stripped if present.
- **What happens when text is selected across multiple HTML elements (e.g., spanning paragraphs)?** Capture the full selected text including line breaks and whitespace, preserving user's intent.
- **What happens when extension is used on a page with no text (e.g., image-only page)?** Context menu option will not appear since there's no text to select.
- **What happens on HTTPS vs HTTP pages?** Extension should work identically on both. Manifest V3 allows content scripts on all URLs by default.
- **What happens when page dynamically loads content (infinite scroll, AJAX)?** Extension should continue to work on newly loaded content without requiring page refresh.
- **What happens if service worker is inactive when user clicks context menu?** Chrome automatically wakes the service worker before the click event, so this should be handled automatically.
- **What happens when multiple instances of text selection happen rapidly?** Each selection should be independent. Last selection wins if user clicks context menu multiple times quickly.
- **What happens on pages with contenteditable or input fields?** Extension should work on contenteditable regions but may conflict with native context menus on input fields (defer to native behavior).

## Requirements

### Functional Requirements

- **FR-001**: Extension MUST inject a content script into all web pages (excluding chrome:// and extension:// pages)
- **FR-002**: Extension MUST register a context menu item labeled "Read with ElevenLabs" that appears only when text is selected
- **FR-003**: Content script MUST capture the currently selected text when the context menu item is clicked
- **FR-004**: Content script MUST send the captured text to the background service worker via chrome.runtime.sendMessage
- **FR-005**: Service worker MUST receive messages from content scripts and acknowledge receipt
- **FR-006**: Extension MUST show a visual confirmation (toast notification) to the user after text is captured, displaying the first 30 characters of captured text
- **FR-007**: Toast notification MUST appear for 3 seconds and then fade out automatically
- **FR-008**: Toast notification MUST be styled to not interfere with page layout (fixed positioning, high z-index)
- **FR-009**: Extension MUST handle empty or whitespace-only selections gracefully (context menu should not appear)
- **FR-010**: Extension MUST trim leading/trailing whitespace from captured text before sending to service worker
- **FR-011**: Extension MUST preserve line breaks and paragraph structure in captured text
- **FR-012**: Extension MUST handle text selections containing special characters (Unicode, emojis) correctly
- **FR-013**: Service worker MUST store the most recent captured text in memory for Phase 3 API integration
- **FR-014**: Extension MUST not break existing page functionality (event listeners, forms, JavaScript)
- **FR-015**: Content script MUST load asynchronously and not block page rendering
- **FR-016**: Extension MUST work on dynamically loaded content (SPA, AJAX, infinite scroll)
- **FR-017**: Context menu icon MUST use the extension's 16x16 icon for visual consistency
- **FR-018**: Extension MUST handle CSP (Content Security Policy) restrictions without violations
- **FR-019**: Extension MUST work on both HTTP and HTTPS pages
- **FR-020**: Service worker MUST log captured text length and timestamp for debugging purposes

### Key Entities

- **Selected Text**: The text currently highlighted by the user on a web page. Attributes: raw text content (string), length (integer), source URL (string), timestamp (ISO 8601), selection range (DOM Range object for internal use).

- **Context Menu Item**: The "Read with ElevenLabs" option in the browser's right-click menu. Attributes: label (string), icon (16x16 PNG), visibility condition (only when text selected), click handler (sends message to service worker).

- **Toast Notification**: Visual feedback element shown to user after text capture. Attributes: message text (string), duration (3 seconds), style (fixed position, green background, high z-index), animation (fade in/out).

- **Message**: Communication between content script and service worker. Attributes: type (string: "TEXT_CAPTURED"), payload (object: {text, url, timestamp}), sender (content script), receiver (service worker).

## Success Criteria

### Measurable Outcomes

- **SC-001**: User can select text and see the context menu item appear within 100ms of right-clicking (measured via DevTools Performance profiling)
- **SC-002**: Context menu item appears only when text is actually selected, with 100% accuracy (no false positives on images, empty space, etc.)
- **SC-003**: Extension adds less than 50ms to initial page load time (measured by comparing Time to Interactive with and without extension)
- **SC-004**: Extension works correctly on at least 10 popular websites (Google Docs, Medium, Twitter/X, Reddit, Wikipedia, GitHub, Gmail, NYTimes, Stack Overflow, Amazon) with 100% success rate
- **SC-005**: Captured text exactly matches user's selection with no truncation or corruption in 100% of test cases (including special characters, Unicode, emojis)
- **SC-006**: No JavaScript console errors appear during normal usage across tested websites (0 console errors in production build)
- **SC-007**: Memory usage per tab remains under 5MB for content script (measured via Chrome Task Manager)
- **SC-008**: Toast notification appears within 200ms of clicking context menu item and is visible for 3 seconds ±100ms
- **SC-009**: Extension continues to function correctly after 30 minutes of active browsing including navigation and dynamic content loading (persistence test)
- **SC-010**: User can successfully capture and receive confirmation for text selections ranging from 1 character to 10,000 characters

## Scope

### In Scope

- Context menu integration with Chrome's native right-click menu
- Content script injection on all web pages (excluding chrome://, chrome-extension://)
- Text selection capture from any web page element
- Message passing between content script and service worker
- Toast notification UI for visual feedback
- Basic text validation and trimming
- Support for HTTP and HTTPS pages
- Dynamic content handling (SPAs, AJAX)
- Special character and Unicode support
- Performance optimization for fast page loads

### Out of Scope (Future Phases)

- **Phase 3**: Actual TTS API calls to ElevenLabs
- **Phase 3**: Audio playback functionality
- **Phase 3**: Text preprocessing and cleaning (removing HTML tags, fixing formatting)
- **Phase 3**: API key validation before sending text
- **Phase 4**: Voice selection UI
- **Phase 4**: Audio playback controls (pause, resume, speed)
- **Phase 4**: Text-to-speech queue for multiple selections
- **Future**: Keyboard shortcut for triggering TTS
- **Future**: Custom context menu positioning
- **Future**: Text highlighting during playback
- **Future**: Offline mode / caching

## Assumptions

1. **Chrome Version**: Users are on Chrome 88+ (Manifest V3 support). Edge and other Chromium browsers are compatible but not primary targets for Phase 2 testing.

2. **API Key Configuration**: Assumed user has already completed Phase 1 and has a valid ElevenLabs API key stored. Phase 2 will not validate the API key; that validation happens in Phase 3.

3. **Internet Connectivity**: Assumed users are online. Phase 2 doesn't require network calls, but Phase 3 will. No offline mode in scope.

4. **Text Selection Method**: Users will use standard mouse-based text selection (click and drag). Keyboard selection (Shift+Arrow keys) should also work due to standard browser behavior. Touch selection on mobile/tablets not tested in Phase 2.

5. **Page Language**: Extension will work on pages in any language. Toast notifications and context menu will be in English only for Phase 2. Internationalization (i18n) is out of scope.

6. **Content Security Policy**: Assumed most websites have standard CSP that allows extension content scripts. Some high-security sites (banking, government) may block extension functionality entirely; this is expected and acceptable.

7. **Performance Baseline**: "Fast" means perceptible delay <100ms for context menu, <50ms added page load time. Based on industry standards for browser extensions.

8. **Text Length Limits**: Practical limit of 10,000 characters per selection based on typical reading patterns. ElevenLabs API has its own limits that will be enforced in Phase 3.

9. **Service Worker Persistence**: Chrome may unload the service worker after 30 seconds of inactivity. Extension will rely on Chrome to wake the service worker when needed (automatic behavior).

10. **Browser Permissions**: Users will grant necessary permissions during installation. Permission requests are defined in manifest.json (Phase 2 adds: contextMenus, activeTab, scripting permissions).

## Dependencies

### Technical Dependencies

- **Phase 1 Completion**: Requires manifest.json, basic extension structure, and API key storage from Phase 1
- **Chrome Manifest V3**: All code must comply with Manifest V3 specifications
- **Chrome APIs**: Depends on chrome.contextMenus, chrome.runtime, chrome.scripting, chrome.tabs

### User Dependencies

- **Phase 1 Setup**: User must have completed Phase 1 (API key configuration) before Phase 2 is useful
- **Browser Support**: Chrome 88+ or compatible Chromium browser

### External Dependencies

None for Phase 2. Phase 3 will add dependency on ElevenLabs API.

## Risks & Mitigations

### Risk 1: Performance Impact on Heavy Websites
**Likelihood**: Medium
**Impact**: High (users will uninstall)
**Mitigation**: Use passive event listeners, minimize DOM queries, load content script asynchronously, test on heavy sites (Google Docs, Figma)

### Risk 2: CSP Violations on Secure Websites
**Likelihood**: Medium
**Impact**: Medium (extension won't work on some sites)
**Mitigation**: Use proper script injection methods (chrome.scripting.executeScript), avoid inline styles, test on sites with strict CSP (GitHub, banking sites). Document known incompatible sites.

### Risk 3: Conflict with Page's Native Context Menu
**Likelihood**: Low
**Impact**: Low (minor UX issue)
**Mitigation**: Use Chrome's built-in context menu API which handles conflicts automatically. Test on pages with custom right-click menus (Google Docs, Figma).

### Risk 4: Service Worker Unloads Mid-Operation
**Likelihood**: Low
**Impact**: Medium (text capture fails)
**Mitigation**: Chrome automatically wakes service workers before message passing. Add error handling in content script for failed messages. Store state in chrome.storage.local if needed.

### Risk 5: Text Selection Breaks on Dynamic Content
**Likelihood**: Medium
**Impact**: Medium (inconsistent UX)
**Mitigation**: Test extensively on SPAs (Gmail, Twitter, React apps). Use MutationObserver if needed to detect DOM changes. Content script runs on all frames by default.

## Next Steps

After specification approval:
1. Run `/speckit.clarify` to ask targeted clarification questions (if any remain)
2. Run `/speckit.plan` to generate technical implementation plan
3. Run `/speckit.tasks` to break down into actionable tasks
4. Run `/speckit.implement` to execute implementation
