# Data Model: Basic Extension Setup

**Feature**: Basic Extension Setup (Phase 1)
**Date**: 2025-10-17
**Storage**: chrome.storage.local

## Overview

This document defines the data entities and storage schema for Phase 1 of the ElevenLabs TTS Chrome Extension. Phase 1 stores only API key configuration data locally using chrome.storage.local API.

## Entities

### 1. API Key Configuration

**Purpose**: Stores the user's ElevenLabs API key and associated metadata for extension configuration.

**Storage Location**: chrome.storage.local (key: `elevenlabs_api_key_config`)

**Fields**:

| Field | Type | Required | Description | Validation Rules |
|-------|------|----------|-------------|------------------|
| `apiKey` | string | Yes | ElevenLabs API key (32-character hex string) | Non-empty, matches `/^[a-f0-9]{32}$/i` |
| `createdAt` | number | Yes | Unix timestamp (ms) when API key was first saved | Positive integer |
| `updatedAt` | number | Yes | Unix timestamp (ms) when API key was last updated | Positive integer, >= createdAt |
| `masked` | string | No (computed) | Masked version for UI display | Format: `••••...••••[last4]` |

**State Transitions**:
- **Not Configured → Configured**: User enters and saves valid API key
- **Configured → Updated**: User modifies existing API key and saves
- **Configured → Not Configured**: User clears/deletes API key

**Relationships**: None (Phase 1 has single entity)

**Invariants**:
- `updatedAt` must always be >= `createdAt`
- `apiKey` must be valid format when present
- `masked` value is never stored, only computed at runtime

### 2. Popup UI State (Client-Side Only)

**Purpose**: Tracks transient UI state within popup session (not persisted to storage).

**Storage Location**: JavaScript variables in popup.js (in-memory only)

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `isConfigured` | boolean | Whether API key exists in storage |
| `validationError` | string \| null | Current validation error message |
| `isSaving` | boolean | Whether save operation is in progress |
| `showMasked` | boolean | Whether to display masked or unmasked key (Phase 1: always masked) |

**Lifecycle**: Created on popup load, destroyed when popup closes

## Storage Schema

### chrome.storage.local Schema

```json
{
  "elevenlabs_api_key_config": {
    "apiKey": "a1b2c3d4e5f6789012345678901234567",
    "createdAt": 1697500000000,
    "updatedAt": 1697500000000
  }
}
```

**Storage Key**: `elevenlabs_api_key_config`

**Max Size**: ~200 bytes (well within 5MB chrome.storage.local quota)

**Quota Management**: Not needed for Phase 1 (single small object)

## Data Operations

### Create/Update API Key

**Operation**: Save new or update existing API key

**Input**:
- `apiKey` (string): Raw API key from user input

**Process**:
1. Validate API key format (trim whitespace, check regex)
2. If validation fails, return error
3. Retrieve existing config from storage (if exists)
4. Create/update config object:
   - If new: Set `createdAt` to `Date.now()`
   - Always: Set `updatedAt` to `Date.now()`
   - Set `apiKey` to validated value
5. Save config to chrome.storage.local
6. Handle errors (storage full, permission denied)

**Output**: Success or error message

**Error Cases**:
- Invalid API key format → Validation error
- Chrome storage error → Storage error
- Permission denied → Permission error

### Retrieve API Key

**Operation**: Load API key configuration from storage

**Input**: None

**Process**:
1. Call `chrome.storage.local.get(['elevenlabs_api_key_config'])`
2. Check for chrome.runtime.lastError
3. Return config object or null if not found

**Output**: API Key Configuration object or null

**Error Cases**:
- Chrome storage error → Storage error
- Permission denied → Permission error

### Delete API Key

**Operation**: Remove API key from storage

**Input**: None

**Process**:
1. Call `chrome.storage.local.remove(['elevenlabs_api_key_config'])`
2. Handle errors

**Output**: Success or error message

**Error Cases**:
- Chrome storage error → Storage error
- Permission denied → Permission error

### Compute Masked Display

**Operation**: Generate masked version of API key for UI

**Input**:
- `apiKey` (string): Full API key

**Process**:
1. Extract last 4 characters: `apiKey.slice(-4)`
2. Generate dots: `'•'.repeat(apiKey.length - 4)`
3. Concatenate: `dots + last4`

**Output**: Masked string (e.g., `••••••••••••••••••••••••••••o5p6`)

**Error Cases**: None (pure function)

## Validation Rules

### API Key Validation

**Format**: 32-character hexadecimal string (0-9, a-f, case-insensitive)

**Regex**: `/^[a-f0-9]{32}$/i`

**Pre-processing**: Trim leading/trailing whitespace

**Error Messages**:
- Empty string: `"API key cannot be empty"`
- Invalid format: `"Invalid API key format. Expected 32-character hex string."`
- Whitespace only: `"API key cannot be empty"`

## Security Considerations

### Data Protection

1. **Storage Security**
   - API keys stored in chrome.storage.local (encrypted at rest by Chrome)
   - Not accessible to web pages (extension-only storage)
   - Persists across browser sessions
   - Cleared if extension is uninstalled

2. **Display Security**
   - Always display masked version in UI (FR-007)
   - Mask pattern: `••••...••••[last4chars]`
   - Never log API key to console

3. **Input Sanitization**
   - Use `textContent` instead of `innerHTML` to prevent XSS
   - Validate format before storage
   - Trim whitespace to prevent accidental padding

### Privacy Considerations

1. **No External Transmission**
   - Phase 1 does not send API key to any servers
   - No analytics or telemetry in Phase 1
   - API key verification happens in Phase 2/3

2. **User Control**
   - Users can view (masked), update, and delete API key at any time
   - Clear indication of configuration status

## Migration Path (Future Phases)

### Phase 2/3 Additions

When adding ElevenLabs API integration:
- Add `isVerified` (boolean): Whether API key has been verified with ElevenLabs
- Add `lastVerifiedAt` (number): Timestamp of last successful verification
- Add `voiceId` (string): Selected voice ID for TTS

### Phase 4+ Additions

When adding audio settings:
- Add `playbackSpeed` (number): Playback speed multiplier (0.5-2.0)
- Add `audioCache` (object): Cached audio data (separate storage key to manage quota)

## Testing Scenarios

### Data Integrity Tests

1. **Save Valid API Key**
   - Input: Valid 32-char hex string
   - Expected: Config object created with correct timestamps
   - Verify: `createdAt` and `updatedAt` are set, `apiKey` matches input

2. **Update Existing API Key**
   - Pre-condition: API key already exists
   - Input: Different valid 32-char hex string
   - Expected: Config updated, `updatedAt` > `createdAt`
   - Verify: `createdAt` unchanged, `updatedAt` increased

3. **Delete API Key**
   - Pre-condition: API key exists
   - Action: Delete API key
   - Expected: Config removed from storage
   - Verify: `chrome.storage.local.get()` returns null

4. **Persistence After Browser Restart**
   - Pre-condition: API key saved
   - Action: Close and reopen Chrome
   - Expected: API key still present in storage
   - Verify: Config object unchanged

### Edge Case Tests

1. **API Key with Whitespace**
   - Input: `"  a1b2c3d4...  "` (with leading/trailing spaces)
   - Expected: Whitespace trimmed before save
   - Verify: Stored key has no whitespace

2. **Empty API Key**
   - Input: `""` or `"   "` (whitespace only)
   - Expected: Validation error
   - Verify: Storage not updated, error displayed

3. **Storage Error Simulation**
   - Scenario: Simulate chrome.storage error
   - Expected: User-friendly error message
   - Verify: UI shows error, does not crash

4. **Masked Display**
   - Input: `"a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"`
   - Expected: Display `"••••••••••••••••••••••••••••o5p6"`
   - Verify: Only last 4 chars visible

## Conclusion

Phase 1 data model is simple and focused: single entity (API Key Configuration) stored in chrome.storage.local. All validation rules, state transitions, and security considerations are clearly defined. Ready for implementation.
