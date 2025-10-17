# Research: Basic Extension Setup

**Feature**: Basic Extension Setup (Phase 1)
**Date**: 2025-10-17
**Status**: Complete

## Overview

This document consolidates technical research for implementing Phase 1 of the ElevenLabs TTS Chrome Extension. Phase 1 focuses on creating a minimal Manifest V3 extension with popup UI for API key management and secure storage.

## Technology Decisions

### 1. Manifest V3 vs Manifest V2

**Decision**: Use Manifest V3

**Rationale**:
- Manifest V3 is mandatory for all new Chrome extensions since January 2023
- Manifest V2 will be fully deprecated and unsupported
- Chrome Web Store requires V3 for new submissions
- V3 improves security (service workers, CSP enforcement)
- Constitution mandates V3 compliance (NON-NEGOTIABLE principle)

**Alternatives Considered**:
- Manifest V2: Rejected due to deprecation and Chrome Web Store requirements
- Cross-browser extension (WebExtensions API): Deferred to future phase, starting Chrome-first

**Key Implications**:
- Must use service workers instead of persistent background pages (Phase 3+)
- Cannot use blocking webRequest API
- Must declare all permissions explicitly
- CSP prevents inline scripts

### 2. Storage Mechanism

**Decision**: chrome.storage.local API

**Rationale**:
- Native Chrome extension storage API
- Persists across browser sessions automatically
- Survives extension updates
- Properly handles Chrome storage quota (5MB default)
- Constitution requires chrome.storage (NOT localStorage)
- No need for external storage services in Phase 1

**Alternatives Considered**:
- localStorage: Rejected - not accessible to service workers, violates V3 best practices
- IndexedDB: Rejected - overcomplicated for single API key storage
- chrome.storage.sync: Rejected - Phase 1 is local-only, sync adds complexity

**Implementation Pattern**:
```javascript
// Save API key
chrome.storage.local.set({ 'elevenlabs_api_key': apiKey }, callback);

// Retrieve API key
chrome.storage.local.get(['elevenlabs_api_key'], (result) => {
  const apiKey = result.elevenlabs_api_key;
});
```

### 3. UI Framework / Library

**Decision**: Vanilla JavaScript (no frameworks)

**Rationale**:
- Phase 1 UI is minimal (1 popup page, 3 input fields, 2 buttons)
- No need for React/Vue/Angular overhead
- Reduces bundle size (meets < 5MB, < 500KB/file constraints)
- Faster load times (< 1 second popup requirement)
- Simplifies CSP compliance (no build tooling, no JSX)
- Easy to test manually in Chrome

**Alternatives Considered**:
- React: Rejected - adds 40KB+ minified, requires build step, overkill for simple popup
- Vue: Rejected - similar overhead, unnecessary complexity
- Svelte: Rejected - requires build step, Phase 1 doesn't need reactivity

**Best Practices**:
- Separate concerns: HTML structure, CSS styling, JS behavior
- Use DOM APIs directly (querySelector, addEventListener)
- Implement simple state management in plain JS
- Keep popup.js modular with clear functions

### 4. Input Validation Strategy

**Decision**: Client-side format validation only (no API verification)

**Rationale**:
- Phase 1 scope excludes network calls (per constitution)
- API key verification happens in Phase 2/3 (ElevenLabs API integration)
- Format validation prevents obvious errors (empty, whitespace, invalid characters)
- Provides immediate feedback (< 500ms requirement)

**Validation Rules**:
- API key must not be empty
- Trim leading/trailing whitespace
- ElevenLabs API keys are typically 32-character hex strings
- Basic regex pattern: `/^[a-f0-9]{32}$/i`

**Alternatives Considered**:
- Real-time API verification: Rejected - requires network call, out of Phase 1 scope
- No validation: Rejected - violates FR-004 (must validate format)

**Implementation Approach**:
```javascript
function validateApiKey(key) {
  const trimmed = key.trim();
  if (!trimmed) return { valid: false, error: 'API key cannot be empty' };
  if (!/^[a-f0-9]{32}$/i.test(trimmed)) {
    return { valid: false, error: 'Invalid API key format' };
  }
  return { valid: true, value: trimmed };
}
```

### 5. API Key Display (Masking)

**Decision**: Mask API key with dots, show last 4 characters

**Rationale**:
- Security best practice (prevents shoulder surfing)
- FR-007 requires masked display
- Common pattern (credit cards, passwords)
- Users can verify correct key by last 4 chars

**Pattern**:
```
Original: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Displayed: ••••••••••••••••••••••••••••o5p6
```

**Alternatives Considered**:
- Full masking: Rejected - users can't verify which key is stored
- No masking: Rejected - security violation (FR-007)
- Click-to-reveal: Deferred - adds UI complexity, not needed for Phase 1

### 6. Icon Design

**Decision**: Simple text-based icon generation (online tool or design software)

**Rationale**:
- Phase 1 needs 3 icon sizes: 16x16, 48x48, 128x128
- Professional appearance required (SC-007)
- No custom design resources available for this phase
- Free icon generators or Figma/Canva can create adequate icons

**Approach**:
- Use initials "EL" or speaker icon
- Blue/purple color scheme (ElevenLabs brand colors)
- Ensure clarity at 16x16 (toolbar size)
- Export as PNG (required format)

**Alternatives Considered**:
- Professional designer: Rejected - Phase 1 budget constraint
- SVG icons: Rejected - Chrome requires PNG for extension icons
- Stock icons: Considered - ensure licensing permits commercial use

## Best Practices

### Chrome Extension Security

1. **Content Security Policy (CSP)**
   - Manifest V3 enforces strict CSP by default
   - No inline scripts (`<script>` tags in HTML)
   - No inline event handlers (`onclick` attributes)
   - Load all JS via external files

2. **Input Sanitization**
   - FR-015 requires XSS prevention
   - Use `textContent` instead of `innerHTML` for user input
   - Validate and sanitize before storage
   - Escape special characters if displaying stored values

3. **Minimal Permissions**
   - Request only "storage" permission in Phase 1
   - Constitution requires justifying all permissions
   - More permissions = more security review scrutiny

### Chrome Extension Architecture

1. **Popup Lifecycle**
   - Popup HTML/JS loads every time user clicks icon
   - State persists via chrome.storage, not in-memory variables
   - Popup can close anytime (user clicks away)
   - Don't rely on global variables across popup opens

2. **Error Handling**
   - Chrome storage API uses callbacks (not promises by default)
   - Wrap all chrome.storage calls in error handlers
   - Check `chrome.runtime.lastError` in callbacks
   - Provide user-friendly error messages (FR-010, FR-014)

3. **Testing Strategy**
   - Load extension via chrome://extensions (Enable Developer Mode)
   - Click "Load unpacked" and select project directory
   - Test scenarios: install, save key, retrieve key, validate input
   - Check Console (F12) for errors
   - Test persistence: close Chrome, reopen, verify key remains

## Technical Constraints

### Size Limits
- Total extension: < 5MB (constitution)
- Individual files: < 500KB (constitution)
- Phase 1 estimated: ~50-100KB total (well under limit)

### Performance Targets
- Popup load: < 1 second (SC-002)
- Input validation feedback: < 500ms (SC-008)
- Chrome storage operations: ~10-50ms typical

### Browser Compatibility
- Minimum Chrome version: 88 (Manifest V3 support)
- No need to support other browsers in Phase 1
- Future phases may add Firefox/Edge support

## File Structure

```
/
├── manifest.json        # ~200 lines (Manifest V3 config)
├── popup.html           # ~80 lines (UI structure)
├── popup.js             # ~150 lines (logic + storage)
├── popup.css            # ~100 lines (styling)
└── icons/
    ├── icon16.png       # ~1-2 KB
    ├── icon48.png       # ~3-5 KB
    └── icon128.png      # ~8-12 KB
```

**Total Estimated Size**: 50-100 KB

## Development Workflow

1. **Setup**: Create manifest.json with Manifest V3 structure
2. **UI**: Build popup.html with form fields and styling
3. **Logic**: Implement popup.js for validation and storage
4. **Icons**: Generate/add icon files
5. **Test**: Load unpacked in Chrome, verify all user stories
6. **Iterate**: Fix issues, retest until all FR requirements met

## Testing Checklist

### Installation (User Story 1 - P1)
- [ ] Extension loads without errors in chrome://extensions
- [ ] Extension icon appears in Chrome toolbar
- [ ] Clicking icon opens popup window
- [ ] Popup displays API key input field and save button

### API Key Management (User Story 1 - P1)
- [ ] Entering valid API key and clicking save stores key
- [ ] Reopening popup displays masked API key
- [ ] Invalid API key shows error message
- [ ] Empty API key shows error message
- [ ] API key with whitespace is trimmed before saving
- [ ] Clearing API key and saving removes stored key

### Persistence (User Story 1 - P1)
- [ ] API key persists after closing popup
- [ ] API key persists after restarting Chrome
- [ ] API key persists after reloading extension

### Status Indicators (User Story 2 - P2)
- [ ] Popup shows "API key required" when no key is stored
- [ ] Popup shows "Configured and ready" when key is stored
- [ ] User can update existing API key
- [ ] User can delete existing API key

### Visual Appearance (User Story 3 - P3)
- [ ] Extension icon is visible and recognizable in toolbar
- [ ] Extension icons display correctly in chrome://extensions
- [ ] Popup UI is clean and professional

### Edge Cases
- [ ] Handles API key with leading/trailing whitespace correctly
- [ ] Prevents saving empty API key
- [ ] Shows user-friendly error when storage fails
- [ ] Popup works correctly when offline
- [ ] API key survives extension uninstall/reinstall (note: this may actually clear storage)

## References

- [Chrome Extension Manifest V3 Guide](https://developer.chrome.com/docs/extensions/mv3/)
- [chrome.storage API Documentation](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Extension Security Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)
- [Content Security Policy for Extensions](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-migration/#content-security-policy)

## Conclusion

Phase 1 research is complete. All technical decisions are documented with clear rationale. No unknowns remain (NEEDS CLARIFICATION markers resolved). The implementation path is straightforward: vanilla JavaScript with Chrome APIs, Manifest V3 compliance, and manual testing approach.

**Ready for Phase 1 Design**: Proceed to generate data-model.md, contracts/, and quickstart.md.
