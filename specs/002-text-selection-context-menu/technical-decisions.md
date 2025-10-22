# Technical Decisions for Phase 2: Text Selection and Context Menu

**Feature**: Text Selection and Context Menu Integration
**Branch**: `002-text-selection-context-menu`
**Created**: 2025-10-17
**Research Focus**: Manifest V3 compliance and performance optimization

This document provides researched technical decisions for implementing Phase 2 of the Chrome extension. Each decision includes the chosen approach, rationale, alternatives considered, and implementation notes.

---

## 1. Content Script Injection Strategy

### Decision

Use **static declaration in manifest.json** with the following configuration:

```json
{
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "exclude_matches": ["chrome://*/*", "chrome-extension://*/*"],
    "js": ["content-script.js"],
    "run_at": "document_idle",
    "all_frames": false
  }]
}
```

### Rationale

**Why static declaration:**
- **Automatic injection**: Chrome handles injection automatically on page load, no manual intervention required
- **Performance**: More performant than programmatic injection for universal content scripts
- **Reliability**: Guaranteed to run on all matching pages without user interaction
- **Manifest V3 compliant**: Fully supported in Manifest V3

**Why document_idle:**
- Corresponds to the `window.onload` event or ~200ms after `DOMContentLoaded`
- Ensures DOM is fully constructed and accessible for text selection
- Doesn't block critical rendering path (better Core Web Vitals)
- Google's recommended default for most extensions
- Our extension doesn't need to intercept early page events or modify DOM before resources load

**Why all_frames: false:**
- Better performance (only injects into main frame)
- Simpler initial implementation
- Text selection typically happens in main frame on most websites
- Can be changed to `true` later if iframe support is needed

**Why matches: "<all_urls>":**
- Phase 2 requirement: work on all websites
- Users expect TTS functionality everywhere they browse
- More permissive but aligns with extension's core value proposition

### Alternatives Considered

**1. Programmatic injection (chrome.scripting.executeScript)**
- **Why rejected**: Requires user action (e.g., clicking extension icon) to inject
- Would make extension less convenient - defeats purpose of context menu integration
- Better suited for on-demand extensions, not universal tools

**2. run_at: "document_end"**
- **Why rejected**: Runs immediately after DOM construction but before all resources load
- Only ~200ms faster than `document_idle` on typical pages
- Our extension doesn't need this early access
- Slightly higher risk of interfering with page JavaScript initialization

**3. run_at: "document_start"**
- **Why rejected**: Runs before DOM is constructed
- Would require waiting for DOM ready events manually
- No benefit for text selection use case
- Only needed for extensions that modify page behavior before any DOM exists

**4. all_frames: true**
- **Deferred, not rejected**: May be needed for iframe support in future
- Adds performance overhead (content script injected into every iframe)
- Keep as enhancement for Phase 2.1 if user testing reveals iframe text selection is common

### Implementation Notes

1. **Permissions required**: Add to manifest.json:
   ```json
   "permissions": ["scripting", "activeTab"],
   "host_permissions": ["<all_urls>"]
   ```

2. **Exclusions**: Explicitly exclude `chrome://` and `chrome-extension://` pages to prevent permission errors

3. **Performance impact**: With `document_idle`, expect <10ms execution time for content script initialization (measured via DevTools Performance tab)

4. **Testing strategy**:
   - Verify injection works on 10+ popular sites (Google Docs, Medium, Twitter/X, etc.)
   - Confirm no injection on chrome:// pages
   - Measure Time to Interactive (TTI) impact (<50ms per Success Criteria SC-003)

5. **Future enhancement path**: If iframe support needed, change `all_frames: true` and test memory impact (<5MB per SC-007)

---

## 2. Message Passing Patterns

### Decision

Use **chrome.runtime.sendMessage** (one-time messages) with the following pattern:

**Content Script (sender):**
```javascript
chrome.runtime.sendMessage(
  {
    type: "TEXT_CAPTURED",
    payload: {
      text: selectedText,
      url: window.location.href,
      timestamp: new Date().toISOString()
    }
  },
  (response) => {
    if (chrome.runtime.lastError) {
      console.error("Message failed:", chrome.runtime.lastError.message);
      showToast("Error capturing text", "error");
      return;
    }
    if (response && response.success) {
      showToast(`Text captured: ${response.preview}...`, "success");
    }
  }
);
```

**Service Worker (receiver):**
```javascript
// Register at top-level (synchronous, not in promise/callback)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TEXT_CAPTURED") {
    const preview = message.payload.text.substring(0, 30);
    console.log(`Captured ${message.payload.text.length} characters from ${sender.tab.url}`);

    // Store for Phase 3
    lastCapturedText = message.payload;

    // Always send response
    sendResponse({ success: true, preview });
    return true; // Keep channel open for async response if needed
  }
});
```

### Rationale

**Why sendMessage over connect (Port API):**
- **Simplicity**: Phase 2 only needs one-way communication (content → service worker)
- **No persistent connection needed**: Each text capture is independent
- **Automatic service worker wake**: Chrome wakes service worker before message delivery
- **Built-in response handling**: Callback pattern is straightforward
- **Performance**: No overhead of maintaining long-lived connections

**Why this message structure:**
- **Type field**: Enables routing different message types in future (e.g., "AUDIO_CONTROLS" in Phase 4)
- **Payload object**: Keeps data organized and extensible
- **Metadata included**: URL and timestamp useful for debugging and future features
- **JSON-serializable**: Follows Chrome's message passing requirements

**Why error handling is critical:**
- Service worker may fail to respond (rare but possible)
- `chrome.runtime.lastError` must be checked to prevent silent failures
- User feedback via toast for errors improves UX

### Alternatives Considered

**1. chrome.runtime.connect (Port API)**
- **Why rejected for Phase 2**: Overkill for single message per user action
- Port API benefits (bidirectional, persistent, disconnect detection) not needed yet
- Adds complexity: must track ports, handle disconnections, implement message routing
- **May revisit in Phase 4**: If audio playback controls require bidirectional communication

**2. serviceWorker.controller.postMessage()**
- **Why rejected**: Chrome extension-specific API (chrome.runtime) is better integrated
- Less Chrome documentation and community support
- Doesn't automatically wake service worker
- Not recommended by Chrome extension docs for MV3

**3. Custom event dispatching (CustomEvent)**
- **Why rejected**: Cannot communicate across extension contexts
- Only works within same page/frame, not page → service worker
- Incorrect pattern for Chrome extensions

**4. Sending raw text without message envelope**
- **Why rejected**: No extensibility for future message types
- Harder to add metadata (URL, timestamp)
- Violates best practices for maintainable code

### Implementation Notes

1. **Listener registration timing**: CRITICAL - Must register `chrome.runtime.onMessage.addListener` at **top-level** of service worker script (synchronous execution)
   ```javascript
   // CORRECT - Top-level registration
   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => { ... });

   // WRONG - Async registration (listener won't exist when service worker wakes)
   chrome.storage.local.get('config', () => {
     chrome.runtime.onMessage.addListener(...); // TOO LATE!
   });
   ```

2. **Response acknowledgment**: Always call `sendResponse()` or return `true` to keep channel open
   - Return `true` if response will be sent asynchronously
   - Chrome will throw error if neither happens

3. **Service worker wake behavior**:
   - Chrome automatically wakes service worker when message arrives
   - Service worker stays alive for 30 seconds after last message
   - Calling any Chrome API extends timer by 30 seconds
   - Long-lived connections (Ports) extend to 5 minutes but force-disconnect after

4. **Error scenarios to handle**:
   - Service worker fails to start (network/memory issues): `chrome.runtime.lastError` will be set
   - Service worker crashes mid-operation: Response callback never called (timeout needed)
   - Content script unloads before response: Sender disconnects, service worker should handle gracefully

5. **Message broadcast scope**: `chrome.runtime.sendMessage` broadcasts to:
   - Background service worker (primary target)
   - Popup (if open)
   - Options page (if open)
   - Other extension pages
   - Use message `type` field to filter in each receiver

6. **Testing strategy**:
   - Test with service worker inactive (wait 30+ seconds between actions)
   - Verify service worker wakes and handles message correctly
   - Test rapid successive messages (queue handling)
   - Simulate service worker crash (chrome://serviceworker-internals)

7. **Performance**:
   - Message passing overhead: <1ms for small payloads (<10KB)
   - Service worker wake time: ~10-50ms (Chrome optimizes for extensions)
   - Total round-trip: <100ms (target for toast confirmation per SC-001)

---

## 3. Toast Notification Implementation

### Decision

Use **Shadow DOM** with the following implementation strategy:

**DOM Injection:**
```javascript
function showToast(message, type = "success") {
  // Create host element
  const host = document.createElement("div");
  host.id = "elevenlabs-tts-toast-host";
  document.body.appendChild(host);

  // Attach shadow DOM (closed mode for maximum isolation)
  const shadow = host.attachShadow({ mode: "closed" });

  // Inject styles and content
  shadow.innerHTML = `
    <style>
      .toast {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647; /* Max z-index */
        padding: 12px 20px;
        border-radius: 8px;
        background: ${type === "success" ? "#10b981" : "#ef4444"};
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity 0.2s, transform 0.2s;
        pointer-events: none; /* Don't block clicks */
      }
      .toast.show {
        opacity: 1;
        transform: translateY(0);
      }
    </style>
    <div class="toast">${escapeHtml(message)}</div>
  `;

  const toast = shadow.querySelector(".toast");

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => host.remove(), 200); // Wait for fade-out
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
```

### Rationale

**Why Shadow DOM over regular DOM:**
- **Complete CSS isolation**: Page styles cannot affect toast, toast styles cannot leak to page
- **JavaScript encapsulation**: Page scripts cannot access or modify shadow root (closed mode)
- **Namespace independence**: Can use simple class names like `.toast` without conflicts
- **Professional standard**: Used by modern frameworks (React, Vue) for component isolation
- **Prevents accidental interference**: Even with aggressive page CSS (e.g., `* { color: red !important }`), toast remains intact

**Why closed shadow mode:**
- Prevents page JavaScript from accessing `shadowRoot` property
- Maximum isolation for security and reliability
- Slightly better performance (no need to maintain external references)

**Why fixed positioning with max z-index:**
- Always visible above page content
- `z-index: 2147483647` is maximum 32-bit integer (highest possible)
- Fixed to viewport, not page scroll position
- Top-right corner conventional for non-intrusive notifications

**Why CSS transitions over requestAnimationFrame:**
- Declarative and easier to maintain
- GPU-accelerated by browser (better performance)
- Smoother animations with less JavaScript overhead
- 200ms duration is perceptible but not distracting

**Why pointer-events: none:**
- Toast doesn't need to be clickable in Phase 2
- Prevents blocking user interactions with page content underneath
- Can be changed to `auto` if click-to-dismiss added later

### Alternatives Considered

**1. Regular DOM injection (no Shadow DOM)**
- **Why rejected**: High risk of CSS conflicts with page styles
- Page's global CSS could break toast appearance
- Toast's CSS could accidentally affect page layout
- Tested on sites with aggressive CSS resets - fails unpredictably

**2. Shadow DOM with open mode**
- **Why deferred, not rejected**: `mode: "open"` allows `host.shadowRoot` access
- Slightly more debuggable during development
- Use closed mode for production, open mode for debugging if needed
- Security benefit of closed mode outweighs debugging convenience

**3. Chrome notifications API (chrome.notifications.create)**
- **Why rejected**: System-level notifications, not in-page
- Less control over appearance and positioning
- Requires additional permission ("notifications")
- Doesn't feel integrated with browsing experience
- More intrusive - appears outside browser window

**4. HTML5 Notification API (new Notification())**
- **Why rejected**: Similar to chrome.notifications
- Requires user permission prompt (bad UX)
- System-level, not page-level
- Overkill for simple feedback

**5. iframe injection**
- **Why rejected**: More complex than Shadow DOM
- Requires separate HTML file or data URL
- Performance overhead (separate document context)
- Same security benefits but worse performance
- Shadow DOM is modern standard for this use case

**6. requestAnimationFrame for animations**
- **Why rejected**: More complex code for same result
- CSS transitions are GPU-accelerated
- RAF useful for complex physics-based animations, overkill here
- CSS transitions better for simple fade/translate

### Implementation Notes

1. **z-index strategy**:
   - `2147483647` is maximum safe integer for z-index
   - Most websites use z-index < 10000
   - Modals/overlays typically use z-index < 100000
   - Our toast will always be on top unless page uses `2147483647` (extremely rare)

2. **Position calculation**:
   - `top: 20px; right: 20px` works for most layouts
   - Consider adding `left: auto; bottom: auto` to override any inherited values
   - Test on RTL (right-to-left) language sites if internationalization planned

3. **Cleanup and memory management**:
   - Always remove host element after toast fades out
   - Use `setTimeout` to wait for CSS transition to complete before removal
   - Check for existing toast and remove before showing new one (prevent stacking):
     ```javascript
     const existing = document.getElementById("elevenlabs-tts-toast-host");
     if (existing) existing.remove();
     ```

4. **Performance considerations**:
   - Shadow DOM attachment: ~1-2ms overhead
   - CSS transitions: GPU-accelerated, negligible CPU impact
   - DOM insertion/removal: <1ms on modern browsers
   - Total overhead: <10ms per toast (well within budget)

5. **Browser compatibility**:
   - Shadow DOM supported in Chrome 53+ (our target is Chrome 88+)
   - `attachShadow()` widely supported in all Chromium browsers
   - CSS transitions supported in all modern browsers

6. **Accessibility considerations** (future enhancement):
   - Current implementation is visual-only
   - Consider adding ARIA live region for screen readers:
     ```html
     <div role="status" aria-live="polite" aria-atomic="true">
       ${message}
     </div>
     ```
   - Not critical for Phase 2 but good for Phase 3/4

7. **Security - HTML escaping**:
   - Always escape user content before injecting into shadow DOM
   - Use `textContent` or manual escaping function
   - Prevents XSS if captured text contains malicious HTML
   - Example: `<script>alert('xss')</script>` should display as text, not execute

8. **Testing strategy**:
   - Test on pages with extreme CSS (CSS resets, global `* {}` rules)
   - Verify toast appears on pages with high z-index elements (modals, dropdowns)
   - Test rapid successive toasts (should replace, not stack)
   - Verify clean removal (check with Chrome DevTools Elements panel)
   - Test on pages with CSP restrictions (shadow DOM should work)

9. **Animation timing**:
   - Fade in: 200ms (spec requires <200ms per SC-008)
   - Display: 3000ms (3 seconds as specified)
   - Fade out: 200ms
   - Total: 3400ms ±100ms (within tolerance)

10. **Edge cases**:
    - **Page removes body element**: Wrap in try-catch, fail gracefully
    - **Page overrides setTimeout**: Store reference to native setTimeout in IIFE
    - **Page with no body yet**: Wait for DOMContentLoaded (shouldn't happen with `document_idle`)

---

## 4. Service Worker Lifecycle and State Management

### Decision

Use **chrome.storage.session** for ephemeral state with in-memory caching pattern:

**Service Worker Implementation:**
```javascript
// In-memory cache (cleared when service worker terminates)
let textCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Event listener registration - MUST be at top-level (synchronous)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TEXT_CAPTURED") {
    handleTextCapture(message, sender, sendResponse);
    return true; // Keep channel open for async response
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "read-with-elevenlabs") {
    handleContextMenuClick(info, tab);
  }
});

// Handle text capture
async function handleTextCapture(message, sender, sendResponse) {
  const { text, url, timestamp } = message.payload;

  // Update in-memory cache
  textCache = { text, url, timestamp, tabId: sender.tab.id };
  cacheTimestamp = Date.now();

  // Persist to session storage (survives service worker restarts)
  await chrome.storage.session.set({
    lastCapturedText: textCache
  });

  // Log for debugging
  console.log(`[${new Date().toISOString()}] Captured ${text.length} chars from ${url}`);

  // Send response
  sendResponse({
    success: true,
    preview: text.substring(0, 30)
  });
}

// Retrieve text with cache-aware logic
async function getLastCapturedText() {
  // Check in-memory cache first (fast path)
  if (textCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return textCache;
  }

  // Cache miss or expired - load from session storage
  const result = await chrome.storage.session.get("lastCapturedText");

  if (result.lastCapturedText) {
    // Restore to in-memory cache
    textCache = result.lastCapturedText;
    cacheTimestamp = Date.now();
    return textCache;
  }

  return null;
}

// Service worker lifecycle logging (optional, for debugging)
self.addEventListener("install", () => {
  console.log("[Service Worker] Installed");
});

self.addEventListener("activate", () => {
  console.log("[Service Worker] Activated");
});
```

### Rationale

**Why chrome.storage.session over in-memory only:**
- **Service worker ephemeral nature**: Chrome terminates service workers after 30 seconds of inactivity
- **State persistence across wake cycles**: Session storage survives service worker restarts
- **Scoped to browser session**: Data automatically cleared when browser closes (good for privacy)
- **No quota limits for small data**: Session storage more generous than local storage for ephemeral data
- **Manifest V3 recommended pattern**: Google explicitly recommends storage APIs over global variables

**Why hybrid cache (in-memory + session storage):**
- **Performance**: In-memory access is instant (no async I/O)
- **Resilience**: Session storage ensures data survives service worker termination
- **Cache invalidation**: TTL prevents stale data (30 min is reasonable for text capture)
- **Best of both worlds**: Fast reads when service worker is active, persistent when terminated

**Why NOT chrome.storage.local:**
- Phase 2 doesn't need persistent storage across browser sessions
- Text captures are ephemeral - no need to keep after user closes browser
- Session storage is more privacy-friendly (auto-cleanup)
- Can upgrade to local storage in Phase 4 if history/queue feature added

**Why NOT localStorage:**
- **Not available in service workers**: localStorage is synchronous API, blocked in service worker context
- Attempting to use localStorage will throw `ReferenceError: localStorage is not defined`
- This is a Manifest V3 breaking change from Manifest V2 background pages

**Why top-level event listener registration:**
- **Critical for Manifest V3**: Service workers wake up when events fire
- Chrome maintains internal registry of event listeners registered at top-level
- Async registration (inside promises/callbacks) will miss events after service worker restarts
- Listeners must be present **synchronously** during script initialization

### Alternatives Considered

**1. In-memory only (global variables)**
- **Why rejected**: Data lost when service worker terminates (every 30 seconds of inactivity)
- User captures text, waits 1 minute, clicks TTS button → data gone
- Terrible UX, violates Phase 2 requirement for reliability

**2. chrome.storage.local (persistent storage)**
- **Why deferred, not rejected**: Not needed for Phase 2
- Persistent across browser restarts - overkill for ephemeral text
- Larger quota but slower performance
- **May use in Phase 4**: For text-to-speech queue or history feature

**3. IndexedDB**
- **Why rejected**: Massive overkill for simple key-value storage
- More complex API (async transaction-based)
- Better for large datasets or complex queries
- Session storage sufficient for Phase 2

**4. chrome.storage.sync**
- **Why rejected**: Syncs across user's devices
- Privacy concern: text selections shouldn't sync across devices
- Limited quota (100KB) and write rate limits
- Not appropriate for ephemeral data

**5. Long-lived Port connections to keep service worker alive**
- **Why rejected**: Prevents service worker from terminating (defeats purpose of MV3)
- Chrome force-disconnects ports after 5 minutes anyway
- Wastes system resources keeping service worker alive unnecessarily
- Anti-pattern for Manifest V3 extensions

**6. Alarms API to keep service worker active**
- **Why rejected**: Same issues as Port connections
- Designed for periodic tasks, not state persistence
- Workaround for architectural problem, not a solution

### Implementation Notes

1. **Service worker wake/sleep behavior**:
   - **Termination**: After 30 seconds of inactivity (no API calls, no events)
   - **Wake triggers**:
     - Event listener firing (e.g., chrome.runtime.onMessage, chrome.contextMenus.onClicked)
     - User interaction (clicking context menu)
     - Alarm/timer firing
   - **Activity extension**: Any Chrome API call resets 30-second timer
   - **Force termination**: Single request taking >5 minutes

2. **Event listener best practices**:
   ```javascript
   // CORRECT - Top-level, synchronous registration
   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
     // Handler code
     return true; // Keep channel open if async
   });

   // WRONG - Async registration (will miss events after service worker restart)
   chrome.storage.session.get('config', (config) => {
     chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
       // This listener won't exist when service worker wakes from terminated state
     });
   });

   // CORRECT - Async logic inside handler, listener registered at top-level
   chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
     const config = await chrome.storage.session.get('config');
     // Use config
     sendResponse({ success: true });
     return true;
   });
   ```

3. **State persistence checklist**:
   - ✅ Event listeners registered at top-level (synchronous)
   - ✅ No global state assumed to persist across restarts
   - ✅ Critical state stored in chrome.storage.session
   - ✅ Optional in-memory cache for performance (with invalidation)
   - ✅ No dependencies on localStorage (not available in service workers)

4. **Chrome.storage.session details**:
   - **Quota**: More generous than local storage for small data
   - **Scope**: Per-extension, per-browser-session
   - **Lifetime**: Cleared when browser closes (not when tabs close)
   - **Performance**: Async but fast (<5ms for small data)
   - **Availability**: Chrome 102+ (our target is 88+, so check version or use local as fallback)

5. **Fallback strategy** (if chrome.storage.session not available):
   ```javascript
   const storage = chrome.storage.session || chrome.storage.local;
   await storage.set({ lastCapturedText: textCache });
   ```

6. **Testing service worker lifecycle**:
   - **Manual termination**: chrome://serviceworker-internals → Stop
   - **Verify wake-up**: Trigger event (context menu click), check console logs
   - **State persistence test**:
     1. Capture text
     2. Wait 30+ seconds (service worker terminates)
     3. Trigger another action (should retrieve from session storage)
     4. Verify data is still available

7. **Debugging tips**:
   - Service worker console: chrome://extensions → Extension → Inspect views: service worker
   - View storage: chrome://extensions → Extension → Inspect views → Application tab → Storage
   - Monitor wake/sleep: Add console.log in self.addEventListener('activate')

8. **Message handling while service worker inactive**:
   - **Automatic wake**: Chrome wakes service worker before delivering message
   - **No special handling needed**: Event listener will be ready when message arrives
   - **Wake latency**: ~10-50ms (imperceptible to user)
   - **Timeout consideration**: Content script should have 5-second timeout for response

9. **State that should NOT be stored**:
   - Large data (>1MB) - use IndexedDB instead
   - Sensitive data (passwords, API keys) - use chrome.storage.local with encryption or let user re-enter
   - Data that changes rapidly - in-memory cache only

10. **Performance optimizations**:
    - In-memory cache eliminates async I/O for hot path
    - TTL prevents stale data (30 minutes reasonable for text capture)
    - Lazy loading: Only read from storage when needed (on-demand)
    - Batch writes if multiple updates (not needed for Phase 2)

11. **Chrome.storage.session limitations** (Chrome 102+):
    - Check availability: `if ('session' in chrome.storage)`
    - Fallback to local storage for older Chrome versions
    - Phase 2 can require Chrome 102+ or implement fallback

---

## Summary of Decisions

| Area | Decision | Key Rationale |
|------|----------|---------------|
| **Content Script Injection** | Static declaration in manifest.json with `document_idle` | Automatic, performant, doesn't block rendering |
| **Message Passing** | `chrome.runtime.sendMessage` (one-time messages) | Simple, sufficient for Phase 2, automatic service worker wake |
| **Toast Notifications** | Shadow DOM with closed mode | Complete CSS isolation, professional standard, prevents conflicts |
| **Service Worker State** | `chrome.storage.session` + in-memory cache | Survives restarts, performant, privacy-friendly |

---

## Implementation Checklist

- [ ] Add content script to manifest.json with `document_idle` and `<all_urls>`
- [ ] Register `chrome.runtime.onMessage.addListener` at top-level of service worker
- [ ] Implement Shadow DOM toast with CSS isolation and max z-index
- [ ] Use `chrome.storage.session` for state persistence (with fallback to local)
- [ ] Add in-memory cache with TTL for performance
- [ ] Implement error handling for message passing (`chrome.runtime.lastError`)
- [ ] Add HTML escaping for toast messages (prevent XSS)
- [ ] Test service worker wake/sleep behavior (30-second timeout)
- [ ] Verify extension works on 10+ popular websites
- [ ] Measure performance impact (<50ms page load, <10ms content script init)

---

## References

### Chrome Developer Documentation
- [Manifest V3 Content Scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [chrome.runtime API](https://developer.chrome.com/docs/extensions/reference/api/runtime)

### Web Standards
- [Shadow DOM Specification](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [CSS Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transitions)

### Performance Best Practices
- [Core Web Vitals](https://web.dev/vitals/)
- [Extension Performance](https://developer.chrome.com/docs/extensions/develop/concepts/performance)

---

**Next Steps**: Proceed to `/speckit.plan` to generate detailed implementation plan using these technical decisions.
