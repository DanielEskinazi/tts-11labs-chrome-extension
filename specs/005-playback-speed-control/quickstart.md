# Quickstart Guide: Playback Speed Control

**Feature**: Playback Speed Control
**Branch**: `005-playback-speed-control`
**Date**: 2025-10-19
**Status**: Phase 1 Design

## Overview

This guide helps developers quickly implement, test, and debug the playback speed control feature. It assumes feature 004 (audio playback controls) is already complete and working.

## Prerequisites

Before working on this feature, ensure you have:
- Chrome browser (version 88+ for Manifest V3 support)
- Feature 004 (audio playback controls) fully implemented and tested
- Chrome extension already installed in developer mode
- Basic understanding of HTMLAudioElement.playbackRate API

---

## Development Setup

### 1. Verify Feature 004 Is Working

Before adding speed controls, ensure the audio control panel is functional:

```bash
# Check that feature 004 branch is merged or current branch includes it
git log --oneline --graph | head -20

# Verify these files exist with control panel code:
ls -la content.js offscreen.js background.js src/api/audio.js
```

**Manual Test**:
1. Load extension in chrome://extensions/
2. Navigate to any webpage (e.g., Wikipedia)
3. Select text, trigger TTS (context menu)
4. Verify control panel appears with pause/play and stop buttons
5. Test pause, resume, stop functionality

**If feature 004 is not working, stop here and complete it first.**

---

## Implementation Checklist

Use this checklist to track implementation progress:

### Phase 1: Core Speed Control (P1)

- [ ] Add `setPlaybackSpeed(rate)` method to AudioPlayer class (src/api/audio.js)
- [ ] Add speed preset constants (0.5x - 2.0x) in content.js
- [ ] Create speed control dropdown UI in control panel Shadow DOM
- [ ] Add click handlers for speed preset buttons
- [ ] Add SET_PLAYBACK_SPEED message handler in offscreen.js
- [ ] Add CONTROL_SPEED_CHANGED message router in background.js
- [ ] Test manual speed changes during playback

### Phase 2: Persistence (P2)

- [ ] Add `getPlaybackSpeed()` helper to src/utils/storage.js
- [ ] Add `setPlaybackSpeed(rate)` helper to src/utils/storage.js
- [ ] Save speed to chrome.storage.local when user changes it
- [ ] Load saved speed when audio starts (modify PLAY_AUDIO handler)
- [ ] Apply saved speed before playback begins
- [ ] Test persistence across browser sessions

### Phase 3: Visual Indicator (P3)

- [ ] Add current speed display to dropdown toggle button
- [ ] Highlight active preset in dropdown menu
- [ ] Update indicator when speed changes
- [ ] Test UI updates correctly reflect audio speed

---

## Quick Implementation Steps

### Step 1: Add setPlaybackSpeed to AudioPlayer

**File**: `src/api/audio.js`

Add this method to the AudioPlayer class:

```javascript
/**
 * Set playback speed
 * @param {number} rate - Playback speed (0.5 - 2.0)
 * @returns {boolean} Success status
 */
setPlaybackSpeed(rate) {
  // Validate rate
  if (typeof rate !== 'number' || rate < 0.5 || rate > 2.0) {
    console.error('[AudioPlayer] Invalid playback rate:', rate);
    return false;
  }

  if (!this.audio) {
    console.warn('[AudioPlayer] No audio element to set speed on');
    return false;
  }

  try {
    this.audio.playbackRate = rate;
    console.log(`[AudioPlayer] Playback speed set to ${rate}x`);
    return true;
  } catch (error) {
    console.error('[AudioPlayer] Failed to set playback rate:', error);
    return false;
  }
}
```

**Test**:
```javascript
// In browser console (offscreen document context)
audioPlayer.setPlaybackSpeed(1.5); // Should return true
audioPlayer.audio.playbackRate; // Should be 1.5
```

---

### Step 2: Add Speed Control UI to Control Panel

**File**: `content.js`

Modify `showControlPanel()` function to include speed dropdown:

```javascript
// In showControlPanel() Shadow DOM innerHTML, add before closing </div>:

<div class="speed-control">
  <button id="speed-toggle" class="speed-toggle" aria-label="Playback speed" aria-haspopup="true">
    <span id="speed-current">1x</span>
    <span class="arrow">▼</span>
  </button>
  <div id="speed-menu" class="speed-menu hidden" role="menu">
    <button class="speed-preset" data-speed="0.5" role="menuitem">0.5x</button>
    <button class="speed-preset" data-speed="0.75" role="menuitem">0.75x</button>
    <button class="speed-preset active" data-speed="1.0" role="menuitem">1x</button>
    <button class="speed-preset" data-speed="1.25" role="menuitem">1.25x</button>
    <button class="speed-preset" data-speed="1.5" role="menuitem">1.5x</button>
    <button class="speed-preset" data-speed="1.75" role="menuitem">1.75x</button>
    <button class="speed-preset" data-speed="2.0" role="menuitem">2x</button>
  </div>
</div>
```

**CSS** (add to Shadow DOM `<style>`):

```css
.speed-control {
  position: relative;
}

.speed-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 14px;
}

.speed-toggle .arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.speed-toggle[aria-expanded="true"] .arrow {
  transform: rotate(180deg);
}

.speed-menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 8px;
  background: rgba(0, 0, 0, 0.95);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.speed-menu.hidden {
  display: none;
}

.speed-preset {
  width: 100%;
  padding: 8px 16px;
  text-align: left;
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
}

.speed-preset:hover {
  background: rgba(255, 255, 255, 0.1);
}

.speed-preset.active {
  background: rgba(255, 255, 255, 0.2);
  font-weight: bold;
}
```

---

### Step 3: Add Click Handlers

**File**: `content.js`

After creating the Shadow DOM, add event listeners:

```javascript
// In showControlPanel(), after attaching pause/stop listeners:

const speedToggle = shadow.querySelector('#speed-toggle');
const speedMenu = shadow.querySelector('#speed-menu');
const speedPresets = shadow.querySelectorAll('.speed-preset');

// Toggle dropdown
speedToggle.addEventListener('click', () => {
  const isExpanded = speedMenu.classList.toggle('hidden');
  speedToggle.setAttribute('aria-expanded', !isExpanded);
});

// Handle preset clicks
speedPresets.forEach(preset => {
  preset.addEventListener('click', async () => {
    const speed = parseFloat(preset.dataset.speed);
    await handleSpeedChange(speed);

    // Close dropdown
    speedMenu.classList.add('hidden');
    speedToggle.setAttribute('aria-expanded', 'false');
  });
});

// Close dropdown when clicking outside (optional enhancement)
document.addEventListener('click', (e) => {
  if (!shadow.contains(e.target)) {
    speedMenu.classList.add('hidden');
    speedToggle.setAttribute('aria-expanded', 'false');
  }
});
```

**Add handleSpeedChange function**:

```javascript
async function handleSpeedChange(newSpeed) {
  console.log('Speed preset clicked:', newSpeed);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CONTROL_SPEED_CHANGED',
      payload: { speed: newSpeed },
      timestamp: Date.now()
    });

    if (response.success) {
      updateSpeedUI(newSpeed);
    } else {
      console.error('Speed change failed:', response.error);
    }
  } catch (error) {
    console.error('Failed to send speed change message:', error);
  }
}

function updateSpeedUI(speed) {
  if (!controlPanelShadow) return;

  const speedCurrent = controlPanelShadow.querySelector('#speed-current');
  const speedPresets = controlPanelShadow.querySelectorAll('.speed-preset');

  // Update toggle button text
  speedCurrent.textContent = `${speed}x`;

  // Update active preset
  speedPresets.forEach(preset => {
    if (parseFloat(preset.dataset.speed) === speed) {
      preset.classList.add('active');
    } else {
      preset.classList.remove('active');
    }
  });
}
```

---

### Step 4: Add Message Handlers

**File**: `background.js`

Add to message listener:

```javascript
else if (message.type === 'CONTROL_SPEED_CHANGED') {
  const { speed } = message.payload;

  // Validate
  if (typeof speed !== 'number' || speed < 0.5 || speed > 2.0) {
    sendResponse({ success: false, error: 'Invalid speed value' });
    return false;
  }

  // Save preference (P2 - can be added later)
  chrome.storage.local.set({ playbackSpeed: speed })
    .catch(err => console.error('Failed to save speed:', err));

  // Forward to offscreen
  chrome.runtime.sendMessage({
    type: 'SET_PLAYBACK_SPEED',
    payload: { speed },
    timestamp: Date.now()
  })
    .then(result => sendResponse(result))
    .catch(error => sendResponse({ success: false, error: error.message }));

  return true; // Async response
}
```

**File**: `offscreen.js`

Add to message listener:

```javascript
case 'SET_PLAYBACK_SPEED':
  if (audioPlayer) {
    const success = audioPlayer.setPlaybackSpeed(message.payload.speed);
    sendResponse({ success });
  } else {
    sendResponse({ success: false, error: 'No audio player' });
  }
  return false;
```

---

## Testing Guide

### Manual Test: Basic Speed Change

1. Start audio playback (select text, trigger TTS)
2. Verify control panel appears
3. Click speed toggle button (should show dropdown)
4. Click "1.5x" preset
5. **Expected**: Audio immediately speeds up to 1.5x, no pause/restart
6. Click "0.75x" preset
7. **Expected**: Audio slows down to 0.75x smoothly

**Debug Console Logs**:
```
Speed preset clicked: 1.5
CONTROL_SPEED_CHANGED message sent
[AudioPlayer] Playback speed set to 1.5x
Speed UI updated to 1.5x
```

### Manual Test: Persistence (P2)

1. Set speed to 1.5x
2. Stop audio
3. Close browser completely
4. Reopen browser, load extension
5. Start new audio
6. **Expected**: Audio starts at 1.5x automatically

### Edge Case Tests

**Test 1: Speed change during loading**
- Trigger TTS, immediately click speed preset
- Expected: Speed applied once audio starts

**Test 2: Rapid speed changes**
- Click 1.5x, then immediately 2.0x, then 1.0x
- Expected: Final speed is 1.0x, no errors

**Test 3: Invalid stored value**
- Manually corrupt storage: `chrome.storage.local.set({ playbackSpeed: 999 })`
- Start audio
- Expected: Fallback to 1.0x, warning logged

---

## Debugging Tips

### Issue: Dropdown doesn't appear

**Check**:
```javascript
// In content script console
const host = document.querySelector('.elevenlabs-tts-controls-host');
const shadow = host.shadowRoot; // Will be null (closed mode)

// Instead, add debug logging in showControlPanel():
console.log('Speed toggle element:', shadow.querySelector('#speed-toggle'));
console.log('Speed menu element:', shadow.querySelector('#speed-menu'));
```

### Issue: Speed doesn't change

**Check offscreen console**:
```javascript
// Look for these logs:
[AudioPlayer] Playback speed set to 1.5x  // ✅ Working
[AudioPlayer] No audio element to set speed on  // ❌ Problem

// Manually test in offscreen console:
audioPlayer.audio.playbackRate = 1.5;
console.log(audioPlayer.audio.playbackRate); // Should be 1.5
```

### Issue: Persistence not working

**Check storage**:
```javascript
// In background console:
chrome.storage.local.get('playbackSpeed', (result) => {
  console.log('Stored speed:', result.playbackSpeed);
});

// Should show: Stored speed: 1.5
```

---

## Common Issues

### Dropdown Overlaps Page Content

**Solution**: Increase z-index or adjust positioning

```css
.speed-menu {
  z-index: 2147483648; /* Higher than control panel */
}
```

### Speed Resets on Pause/Resume

**Problem**: playbackRate not preserved across pause/resume

**Solution**: AudioPlayer.pause() and resume() should NOT reset playbackRate. Verify:

```javascript
// In AudioPlayer.pause()
pause() {
  this.audio.pause(); // Only pauses, doesn't touch playbackRate
}

// In AudioPlayer.resume()
async resume() {
  await this.audio.play(); // Only resumes, playbackRate unchanged
}
```

---

## Performance Checklist

- [ ] Speed dropdown opens in < 100ms
- [ ] Speed change applies in < 100ms
- [ ] No audio glitches or pops during speed change
- [ ] UI updates (active preset highlight) in < 50ms
- [ ] Storage operations non-blocking (async)
- [ ] No memory leaks (dropdown cleanup on panel removal)

---

## Next Steps

After completing implementation and testing:

1. Run `/speckit.tasks` to generate task breakdown
2. Execute tasks incrementally (P1 → P2 → P3)
3. Test each priority level before moving to next
4. Update tasks.md with completion status
5. Create PR when feature is complete

---

**References**:
- MDN: [HTMLMediaElement.playbackRate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate)
- Feature 004: Audio Playback Controls (prerequisite)
- Contracts: [messages.md](./contracts/messages.md)
- Data Model: [data-model.md](./data-model.md)

---

**Document Status**: Complete - Quickstart guide ready for developer onboarding.
