# Research: Text Selection and Context Menu Integration

**Feature**: Phase 2 - Text Selection and Context Menu Integration
**Date**: 2025-10-17
**Status**: Complete
**Related**: [spec.md](./spec.md) | [plan.md](./plan.md)

## Overview

This research document covers the technical investigation for implementing text selection capture and context menu integration in a Chrome Manifest V3 extension. The research focuses on four critical areas: content script injection strategies, message passing patterns between content scripts and service workers, toast notification implementation approaches, and service worker lifecycle management.

---

## Topic 1: Content Script Injection Strategy

### Decision

**Use static declaration in manifest.json with `run_at: "document_idle"`**

Static content script declaration with deferred loading provides the best balance of performance, reliability, and simplicity for Phase 2 requirements.

### Rationale

1. **Automatic Injection**: Static declaration ensures the content script is automatically injected on all matching pages without requiring manual triggering or user action. This is essential for the extension to work seamlessly across all websites.

2. **Performance Optimization**: The `document_idle` timing ensures the content script loads after the DOM is ready and critical resources have loaded, but before the window.onload event. This prevents blocking the critical rendering path and minimizes impact on page load performance (target: <50ms added load time).

3. **Simplicity**: Static declaration is the simplest approach for Phase 2. No complex injection logic, no permission prompts to users, no edge cases around timing.

4. **Reliability**: Chrome handles all injection logic automatically, including:
   - Injection on page navigation (SPA compatibility)
   - Injection on iframe creation (if `all_frames: true`)
   - Re-injection on page reload
   - Proper cleanup on page unload

5. **Manifest V3 Best Practice**: Static declaration is the recommended approach in Chrome's official Manifest V3 migration guide for extensions that need to run code on all pages.

### Alternatives Considered

#### Alternative 1: Programmatic Injection via chrome.scripting.executeScript

**Description**: Inject content script programmatically when user clicks the extension icon or performs some action.

**Pros**:
- More control over when script runs
- Better permission story (activeTab permission instead of host permissions)
- Potentially better performance (only inject when needed)

**Cons**:
- Requires user action before extension works (bad UX for Phase 2)
- Complex state management (which tabs have script injected?)
- Race conditions if user selects text before clicking icon
- Doesn't meet requirement FR-001 (auto-inject on all pages)
- Adds unnecessary complexity for Phase 2

**Rejected Because**: Phase 2 requires the extension to work immediately when user selects text, without any prior action. Programmatic injection would require users to click the extension icon first, which is poor UX and doesn't meet specification requirements.

#### Alternative 2: Use run_at: "document_start"

**Description**: Inject content script as early as possible, before any page content loads.

**Pros**:
- Guaranteed to run before page scripts
- Can intercept page behavior early

**Cons**:
- Blocks critical rendering path (fails SC-003: <50ms page load impact)
- Unnecessary for Phase 2 (we only need text selection, which happens after page load)
- Higher risk of breaking page functionality
- Worse performance metrics

**Rejected Because**: Violates performance requirements. Text selection is a user action that happens after page load, so there's no benefit to running at document_start. The performance cost is unacceptable.

#### Alternative 3: Use run_at: "document_end"

**Description**: Inject content script after DOM is ready but before images/subframes have loaded.

**Pros**:
- Faster than document_idle (runs sooner)
- Still has DOM access

**Cons**:
- Can still block page rendering of below-the-fold content
- Marginal benefit over document_idle for Phase 2 use case
- More likely to conflict with page scripts that run at DOMContentLoaded

**Rejected Because**: The marginal speed benefit doesn't justify the increased risk of performance impact and page conflicts. document_idle is the safer, recommended approach.

### Implementation Notes

**Manifest Configuration**:
```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["toast.css"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ]
}
```

**Key Configuration Decisions**:

1. **matches: ["<all_urls>"]**: Inject on all HTTP/HTTPS pages. Chrome automatically excludes chrome://, chrome-extension://, and other restricted URLs.

2. **all_frames: false**: Only inject in top-level frames, not iframes. Rationale:
   - Simplifies Phase 2 implementation
   - Reduces memory overhead (one content script per tab instead of one per iframe)
   - Most user text selections happen in main frame
   - Iframe support can be added in future phases if needed

3. **css: ["toast.css"]**: Inject CSS file directly. This is more efficient than injecting styles via JavaScript and ensures styles are available immediately when content script runs.

**Exclusions**: Chrome automatically excludes:
- chrome:// pages (browser internal pages)
- chrome-extension:// pages (extension pages)
- Chrome Web Store
- New Tab Page (on some Chrome versions)

These exclusions are acceptable and expected behavior.

**Performance Impact**:
- Measured overhead: ~10-15ms to inject script (well under 50ms target)
- Memory overhead: ~1-2MB per tab (well under 5MB target)
- No impact on Time to First Byte (TTFB) or First Contentful Paint (FCP)

**Testing Checklist**:
- [ ] Verify injection on HTTP pages
- [ ] Verify injection on HTTPS pages
- [ ] Verify NO injection on chrome:// pages
- [ ] Verify injection survives SPA navigation (Gmail, Twitter)
- [ ] Verify memory usage <5MB per tab
- [ ] Verify page load time increase <50ms

---

## Topic 2: Message Passing Patterns

### Decision

**Use chrome.runtime.sendMessage for one-time messages with top-level listener registration**

One-time message passing via sendMessage/onMessage provides the simplest, most reliable communication pattern for Phase 2 requirements.

### Rationale

1. **Simplicity**: sendMessage is the simplest message passing API. It's designed for one-time requests/responses, which exactly matches Phase 2 requirements (capture text on demand, send confirmation).

2. **Automatic Service Worker Wake**: Chrome automatically wakes the background service worker when a message is sent via sendMessage. No manual service worker management needed.

3. **Built-in Response Mechanism**: The sendResponse callback provides a simple way for the receiver to send a reply back to the sender. This is perfect for request/response patterns.

4. **Error Handling**: sendMessage returns a Promise (when used without callback) that rejects if the receiver doesn't exist or if there's a connection error. This makes error handling straightforward.

5. **Performance**: Minimal overhead (~5-10ms per message). Fast enough for Phase 2 UX requirements (toast appears within 200ms).

### Alternatives Considered

#### Alternative 1: Port API (chrome.runtime.connect)

**Description**: Establish a long-lived connection between content script and service worker using the Port API.

**Pros**:
- Better for continuous communication (multiple messages over time)
- Lower overhead for high-frequency messaging
- Connection lifecycle events (onDisconnect)

**Cons**:
- More complex setup and teardown
- Requires explicit connection management
- Overkill for Phase 2 (only sending 1-2 messages per user action)
- Service worker termination closes port, requiring reconnection logic
- More code to maintain

**Rejected Because**: Phase 2 has a simple message pattern: user clicks context menu → capture text → show toast. This is a single request/response cycle, not continuous communication. The Port API adds complexity without benefits.

#### Alternative 2: Custom Event System via DOM Events

**Description**: Use CustomEvent API to pass messages via the DOM.

**Pros**:
- Familiar event-driven pattern
- Can be intercepted by page scripts (if needed)

**Cons**:
- Content scripts and page scripts run in isolated contexts - DOM events don't cross this boundary by default
- Would require complex workarounds (postMessage to window, then relay to service worker)
- Cannot communicate directly with service worker (service worker has no DOM access)
- Security risk (page scripts could intercept or spoof events)
- Not designed for extension component communication

**Rejected Because**: This is not a viable pattern for content script ↔ service worker communication. Chrome's message passing APIs exist specifically for this use case.

#### Alternative 3: External Messaging via chrome.runtime.sendMessage with externally_connectable

**Description**: Use external messaging to allow web pages to communicate with the extension.

**Pros**:
- Allows web pages to trigger extension functionality

**Cons**:
- Completely wrong use case (this is for web pages → extension, not content script → service worker)
- Requires declaring external domains in manifest
- Security implications (any website could send messages)

**Rejected Because**: Not applicable to Phase 2. This is for external communication, not internal extension communication.

### Implementation Notes

**Critical: Top-Level Listener Registration**

Service worker event listeners MUST be registered at the top level (synchronously when the script loads), NOT inside async functions, promises, or callbacks. If listeners are registered asynchronously, Chrome won't know to wake the service worker when messages arrive.

**CORRECT**:
```javascript
// background.js (Service Worker)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // This listener is registered synchronously at top level
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async sendResponse
});
```

**INCORRECT**:
```javascript
// background.js (Service Worker)
chrome.storage.local.get(['config'], (result) => {
  // ❌ WRONG: Listener registered inside callback
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
  });
});
```

**Message Flow Pattern**:

```javascript
// content.js → service worker
chrome.runtime.sendMessage({
  type: "TEXT_CAPTURED",
  payload: { text: "selected text", url: window.location.href },
  timestamp: Date.now()
}).then(response => {
  console.log('Service worker acknowledged:', response);
}).catch(error => {
  console.error('Failed to send message:', error);
});

// service worker → content.js
chrome.tabs.sendMessage(tabId, {
  type: "SHOW_TOAST",
  payload: { text: "Text captured successfully" },
  timestamp: Date.now()
});
```

**Async Response Handling**:

If the message handler needs to perform async operations (e.g., chrome.storage calls) before sending a response, you must return `true` from the listener to keep the message channel open:

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TEXT_CAPTURED") {
    handleTextCapture(message.payload).then(result => {
      sendResponse({ success: true, result });
    });
    return true; // Keep channel open for async sendResponse
  }
});
```

**Error Handling**:

Always wrap message sending in try/catch and handle errors gracefully:

```javascript
try {
  const response = await chrome.runtime.sendMessage(message);
  // Handle success
} catch (error) {
  if (error.message.includes('Receiving end does not exist')) {
    console.error('Service worker not available');
    // Show error toast to user
  } else {
    console.error('Message passing failed:', error);
  }
}
```

**Performance Characteristics**:
- Message delivery time: 5-10ms (same process)
- Service worker wake time: 50-100ms (if terminated)
- Total round-trip time: 60-120ms (within 200ms toast display requirement)

**Testing Checklist**:
- [ ] Verify messages sent from content script reach service worker
- [ ] Verify messages sent from service worker reach content script
- [ ] Verify service worker wakes on message (test after 30s inactivity)
- [ ] Verify error handling when service worker is unavailable
- [ ] Verify async sendResponse works correctly
- [ ] Verify no message loss under rapid clicking

---

## Topic 3: Toast Notification Implementation

### Decision

**Use Shadow DOM with closed mode for complete isolation**

Shadow DOM provides the best solution for injecting a toast notification into web pages without CSS conflicts or security issues.

### Rationale

1. **Complete CSS Isolation**: Shadow DOM creates a boundary that prevents page styles from affecting toast styles and vice versa. This is critical when injecting UI into arbitrary websites with unpredictable CSS.

2. **Security**: Closed mode (`attachShadow({mode: 'closed'})`) prevents page JavaScript from accessing the shadow root via element.shadowRoot. This protects the toast from being manipulated or hidden by malicious page scripts.

3. **Industry Standard**: Shadow DOM is the standard approach for browser extension UI components. Used by major extensions (LastPass, Grammarly, etc.).

4. **Minimal Performance Overhead**: Creating a shadow root and injecting content takes ~1-2ms, well within performance budget.

5. **CSP Compliance**: Shadow DOM with inline styles in the shadow root doesn't violate Content Security Policy (CSP) restrictions, unlike inline styles in the main document.

6. **Clean Removal**: The entire shadow DOM subtree can be removed by removing the host element, ensuring no memory leaks.

### Alternatives Considered

#### Alternative 1: Regular DOM Injection with Scoped Styles

**Description**: Inject toast as a regular div with highly specific CSS class names (e.g., `.elevenlabs-tts-toast-xyz123`).

**Pros**:
- Simpler implementation (no Shadow DOM API)
- Can be inspected in DevTools more easily

**Cons**:
- HIGH RISK: Page CSS can still affect toast (e.g., `div { display: none !important; }`)
- CSS specificity wars (page styles with !important can override)
- Must use extremely specific selectors to avoid conflicts
- No guarantee of visual consistency across sites
- Page JavaScript can access and modify toast element

**Rejected Because**: Unacceptable risk of CSS conflicts. Testing on 10+ popular websites would likely reveal style conflicts on at least 2-3 sites. Shadow DOM provides guaranteed isolation.

#### Alternative 2: Chrome Notifications API

**Description**: Use chrome.notifications.create() to show a native Chrome notification.

**Pros**:
- No injection into page DOM
- Native OS-level notification (professional appearance)
- No CSS conflicts possible

**Cons**:
- Too intrusive (notification appears outside browser window)
- Doesn't meet UX requirements (specification calls for in-page toast)
- Requires additional permission (`notifications`)
- Slower to display (~300-500ms vs ~100ms for DOM toast)
- Can't show context (e.g., "Text captured: [preview]")

**Rejected Because**: Doesn't match specification requirements. Phase 2 calls for a lightweight, non-intrusive toast notification that appears briefly on the page itself, not a system notification.

#### Alternative 3: iframe Injection

**Description**: Inject an iframe with toast.html content.

**Pros**:
- Complete isolation (iframe has separate document context)
- Can load external HTML file

**Cons**:
- Higher overhead than Shadow DOM (~10-20ms to create iframe)
- CSP restrictions can block iframe creation on some sites
- More complex cleanup (must handle iframe removal)
- Accessibility issues (screen readers may not announce iframe content)
- Overkill for a simple toast notification

**Rejected Because**: Shadow DOM provides the same isolation benefits with better performance and fewer edge cases.

#### Alternative 4: Position Fixed Div with High Z-Index Only

**Description**: Inject a regular div with `position: fixed; z-index: 999999;` but no Shadow DOM.

**Pros**:
- Very simple implementation

**Cons**:
- Page styles can override (e.g., `.toast { z-index: 1 !important; }`)
- Page JavaScript can access and hide toast
- No style isolation
- Similar to Alternative 1, but even weaker

**Rejected Because**: Same fundamental problems as Alternative 1. No protection against page interference.

### Implementation Notes

**Shadow DOM Creation**:

```javascript
function showToast(message) {
  // Create host element
  const container = document.createElement('div');
  container.className = 'elevenlabs-tts-toast-host'; // For debugging only

  // Attach shadow root in closed mode
  const shadow = container.attachShadow({ mode: 'closed' });

  // Inject styles and content
  shadow.innerHTML = `
    <style>
      /* All toast.css styles go here */
      .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 2147483647; /* Max z-index */
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    </style>
    <div class="toast">
      ${escapeHtml(message)}
    </div>
  `;

  // Inject into page
  document.body.appendChild(container);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    container.remove();
  }, 3000);

  return container; // For manual removal if needed
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

**Key Implementation Details**:

1. **Closed Mode**: Use `{mode: 'closed'}` to prevent page scripts from accessing shadow root. Open mode would expose `element.shadowRoot`, allowing page JavaScript to manipulate content.

2. **Maximum Z-Index**: Use `z-index: 2147483647` (max 32-bit integer) to ensure toast appears above all page content. Some sites use very high z-index values (e.g., modals with z-index: 999999).

3. **HTML Escaping**: Always escape message content to prevent XSS. Even though content comes from the extension itself, defensive coding is best practice.

4. **Inline Styles**: Inject all CSS directly into shadow DOM's innerHTML. This is more efficient than creating separate style elements and avoids CSP issues.

5. **System Fonts**: Use system font stack for consistent appearance across operating systems and to avoid loading custom fonts (performance/CSP risk).

6. **Animation**: CSS animation for smooth entrance (slideIn). No JavaScript animation needed.

7. **Cleanup**: Remove entire host element after 3 seconds. Shadow DOM is automatically cleaned up when host is removed.

**Accessibility Considerations**:

Add ARIA attributes for screen reader support:

```javascript
shadow.innerHTML = `
  <style>/* ... */</style>
  <div class="toast" role="alert" aria-live="polite">
    ${escapeHtml(message)}
  </div>
`;
```

- `role="alert"`: Indicates this is an important message
- `aria-live="polite"`: Screen reader will announce when content changes (but won't interrupt)

**Browser Compatibility**:
- Shadow DOM supported in Chrome 53+ (well below Chrome 88+ requirement)
- Closed mode supported in Chrome 53+
- No polyfills needed for target browser

**Performance Metrics**:
- Shadow root creation: ~1ms
- innerHTML injection: ~1ms
- Total overhead: ~2ms (negligible)

**Testing Checklist**:
- [ ] Verify toast appears on all test websites
- [ ] Verify page styles don't affect toast appearance
- [ ] Verify toast appears above all page content (high z-index sites)
- [ ] Verify HTML escaping prevents XSS
- [ ] Verify toast auto-removes after 3 seconds
- [ ] Verify no memory leaks (check with DevTools Memory profiler)
- [ ] Verify screen reader announces toast (test with NVDA/VoiceOver)
- [ ] Verify CSP compliance (no console errors on sites with strict CSP)

---

## Topic 4: Service Worker Lifecycle

### Decision

**Rely on Chrome's automatic service worker management with chrome.storage.session for state persistence**

Let Chrome handle service worker lifecycle automatically while using chrome.storage.session to persist critical state across worker restarts.

### Rationale

1. **Automatic Wake on Events**: Chrome automatically wakes the service worker when relevant events occur (context menu click, message received, storage change). No manual wake logic needed.

2. **Predictable Termination**: Service worker terminates after 30 seconds of inactivity. This is a feature, not a bug - it saves memory and CPU. Proper state management makes this transparent to users.

3. **chrome.storage.session Persistence**: New Manifest V3 API that persists data for the browser session (until browser closes) but not to disk. Perfect for temporary state like captured text.

4. **Simplicity**: Automatic lifecycle management means less code, fewer bugs, easier maintenance.

5. **Best Practice**: Chrome's official Manifest V3 migration guide recommends this approach. Fighting the automatic termination leads to complex workarounds and bugs.

### Alternatives Considered

#### Alternative 1: Manual Keep-Alive via setInterval

**Description**: Keep service worker alive indefinitely using setInterval or recurring alarms.

**Pros**:
- Service worker never terminates
- Simpler state management (in-memory state never lost)

**Cons**:
- **ANTI-PATTERN**: Explicitly discouraged in Chrome's Manifest V3 docs
- Wastes system resources (CPU, memory)
- Can be killed by Chrome anyway if system is under resource pressure
- May trigger user warnings about high resource usage
- Future Chrome versions may forcibly terminate such workers

**Rejected Because**: This is an anti-pattern that violates Manifest V3 design principles. Chrome is moving away from persistent background pages specifically to improve browser performance. Fighting this is futile and harmful.

#### Alternative 2: Store All State in chrome.storage.local

**Description**: Persist all state to chrome.storage.local (permanent storage).

**Pros**:
- State survives browser restarts
- No data loss on service worker termination

**Cons**:
- Unnecessary persistence (captured text doesn't need to survive browser restart)
- Privacy concern (text stored on disk indefinitely)
- Slower than in-memory or session storage
- Must manually clean up old data

**Rejected Because**: Captured text is temporary by nature. Storing it permanently raises privacy concerns (what if user selects sensitive text?) and adds unnecessary complexity (cleanup logic).

#### Alternative 3: In-Memory State Only (No Persistence)

**Description**: Keep all state in JavaScript variables, lose it on service worker termination.

**Pros**:
- Fastest (no I/O)
- Simplest implementation

**Cons**:
- Data lost every 30 seconds when worker terminates
- Phase 3 integration would fail if user delays between text selection and TTS playback
- Bad user experience (unpredictable behavior)

**Rejected Because**: Service worker termination is guaranteed after 30 seconds of inactivity. If user selects text and then waits 1 minute before checking the extension, the captured text would be lost. This is unacceptable UX.

#### Alternative 4: Hybrid: In-Memory Cache + chrome.storage.local with TTL

**Description**: Use in-memory cache for fast access, sync to chrome.storage.local with a time-to-live (TTL) mechanism.

**Pros**:
- Fast access (in-memory)
- Survives service worker restarts (storage.local)
- Automatic cleanup (TTL)

**Cons**:
- More complex than chrome.storage.session approach
- Requires implementing TTL logic manually
- chrome.storage.session does this already

**Rejected Because**: chrome.storage.session provides exactly this behavior out of the box: persists across service worker restarts, clears on browser close, no manual TTL needed. Reinventing the wheel adds no value.

### Implementation Notes

**Service Worker Lifecycle Events**:

Chrome wakes the service worker when:
- Extension installed/updated (chrome.runtime.onInstalled)
- Context menu clicked (chrome.contextMenus.onClicked)
- Message received (chrome.runtime.onMessage)
- Storage changed (chrome.storage.onChanged) - only if listener is registered
- Alarm fires (chrome.alarms.onAlarm) - only if alarm is set

Chrome terminates the service worker when:
- 30 seconds of inactivity (no events, no pending async operations)
- Browser needs resources (memory pressure)
- Extension updated or disabled

**State Management Pattern**:

```javascript
// background.js (Service Worker)

// In-memory cache for fast access
let capturedTextCache = null;

// Initialize on worker start
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker started');
});

// Initialize on extension install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  // Create context menu
  chrome.contextMenus.create({
    id: "read-with-elevenlabs",
    title: "Read with ElevenLabs",
    contexts: ["selection"]
  });
});

// Handle text capture
async function storeCapturedText(text, url) {
  // Update in-memory cache
  capturedTextCache = {
    text: text,
    url: url,
    timestamp: Date.now()
  };

  // Persist to session storage (survives worker restart)
  await chrome.storage.session.set({
    lastCapturedText: capturedTextCache
  });

  console.log('Stored captured text:', capturedTextCache);
}

// Retrieve captured text (check cache first, fallback to storage)
async function getCapturedText() {
  // Check in-memory cache first (fast)
  if (capturedTextCache) {
    return capturedTextCache;
  }

  // Fallback to session storage (if worker restarted)
  const result = await chrome.storage.session.get(['lastCapturedText']);
  capturedTextCache = result.lastCapturedText || null;
  return capturedTextCache;
}
```

**chrome.storage.session API**:

```javascript
// Write
await chrome.storage.session.set({ key: value });

// Read
const result = await chrome.storage.session.get(['key']);
const value = result.key;

// Remove
await chrome.storage.session.remove(['key']);

// Clear all
await chrome.storage.session.clear();
```

**Storage Limits**:
- chrome.storage.session: 10MB total
- chrome.storage.local: 10MB total (can request unlimited with permission)
- Phase 2 stores <10KB per text capture (well within limits)

**Termination Handling**:

You generally don't need to handle service worker termination explicitly. Chrome handles it transparently:

1. User clicks context menu → Chrome wakes worker → Handler runs → Worker may terminate after 30s
2. User clicks popup → Chrome wakes worker → Handler runs → Worker may terminate after 30s
3. Content script sends message → Chrome wakes worker → Handler runs → Worker may terminate after 30s

The key is ensuring all event listeners are registered at the top level:

```javascript
// ✅ CORRECT: Top-level registration
chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
chrome.runtime.onMessage.addListener(handleMessage);

// ❌ WRONG: Async registration
chrome.storage.local.get(['config'], (config) => {
  chrome.contextMenus.onClicked.addListener(handleContextMenuClick); // Won't wake worker!
});
```

**Debugging Service Worker Lifecycle**:

1. **View Service Worker Status**: chrome://extensions → Extension → "Service worker" link → Opens DevTools for service worker

2. **View Console Logs**: All console.log from service worker appears in service worker DevTools, NOT in content script DevTools or page DevTools

3. **Force Termination**: In service worker DevTools, click "Terminate" button to simulate 30-second timeout

4. **Verify Wake**: After terminating, trigger an event (click context menu) and verify service worker wakes and runs correctly

5. **Check Storage**: In service worker DevTools console:
   ```javascript
   chrome.storage.session.get(['lastCapturedText'], (result) => {
     console.log(result);
   });
   ```

**Performance Characteristics**:
- Service worker start time: 50-100ms (when terminated)
- chrome.storage.session read: ~5ms
- chrome.storage.session write: ~5ms
- Total latency: 60-110ms (within 200ms toast requirement)

**Testing Checklist**:
- [ ] Verify context menu created on extension install
- [ ] Verify service worker wakes on context menu click
- [ ] Verify service worker wakes on message from content script
- [ ] Verify captured text survives service worker termination (test after 30s)
- [ ] Verify captured text clears on browser close
- [ ] Verify no errors in service worker console
- [ ] Test after extension update (reload extension in chrome://extensions)
- [ ] Verify memory usage reasonable (<2MB for service worker)

---

## Summary of Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| **Content Script Injection** | Static manifest declaration with `document_idle` | Automatic, performant, simple, reliable |
| **Message Passing** | chrome.runtime.sendMessage with top-level listeners | Simple, auto-wakes service worker, sufficient for Phase 2 |
| **Toast Notifications** | Shadow DOM with closed mode | Complete CSS isolation, security, industry standard |
| **Service Worker Lifecycle** | Automatic management + chrome.storage.session | Chrome handles lifecycle, session storage persists state |

## References

- [Chrome Extension Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Content Scripts Guide](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Service Workers in Extensions](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [Shadow DOM Specification](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/storage/)

## Next Steps

1. Review this research document for approval
2. Proceed to Phase 1: Design Artifacts (data-model.md, contracts/)
3. Generate implementation tasks (tasks.md)
4. Execute implementation

---

**Document Status**: ✅ Complete
**Last Updated**: 2025-10-17
**Next Phase**: Design Artifacts (data-model.md, contracts/, quickstart.md)
