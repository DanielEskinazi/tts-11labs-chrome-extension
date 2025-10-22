// offscreen.js - Offscreen Document for Audio Playback
// Runs in a window context with access to Audio API and URL.createObjectURL

import { AudioPlayer } from './src/api/audio.js';

// Audio player instance
let audioPlayer = null;

console.log('Offscreen document loaded for audio playback');

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Offscreen received message:', message.type);

  // Validate message structure
  if (!message || !message.type) {
    console.warn('Invalid message structure received:', message);
    sendResponse({ success: false, error: 'Invalid message structure' });
    return false;
  }

  // Handle different message types
  switch (message.type) {
    case 'LOAD_AUDIO':
      handleLoadAudio(message.payload)
        .then(result => sendResponse({ success: true, payload: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response

    case 'PLAY_AUDIO':
      handlePlayAudio()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response

    case 'PAUSE_AUDIO':
      handlePauseAudio();
      sendResponse({ success: true });
      return false;

    case 'RESUME_AUDIO':
      handleResumeAudio()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Async response

    case 'STOP_AUDIO':
      handleStopAudio();
      sendResponse({ success: true });
      return false;

    case 'SET_PLAYBACK_SPEED':
      if (audioPlayer) {
        const success = audioPlayer.setPlaybackSpeed(message.payload.speed);
        sendResponse({ success, appliedSpeed: success ? message.payload.speed : null });
      } else {
        sendResponse({ success: false, error: 'No audio player' });
      }
      return false;

    case 'GET_AUDIO_STATE':
      const state = getAudioState();
      sendResponse({ success: true, payload: state });
      return false;

    default:
      // Ignore messages not meant for offscreen document (e.g., CONTROL_PAUSE_CLICKED, TEXT_CAPTURED, TTS_REQUEST)
      // These are handled by background.js
      console.log('[Offscreen] Ignoring message type:', message.type, '(not for offscreen)');
      return false; // Don't send response for messages we're not handling
  }
});

/**
 * Handle LOAD_AUDIO message
 * @param {object} payload - Contains audioData (base64 string or ArrayBuffer) and optional format
 */
async function handleLoadAudio(payload) {
  try {
    const { audioData, format } = payload;

    console.log('[Offscreen] Received audio data:', typeof audioData, `format: ${format}`);
    console.log('[Offscreen] Audio data length:', audioData?.length || audioData?.byteLength || 'unknown');

    // Convert base64 or ArrayBuffer to Blob
    let audioBlob;
    if (format === 'base64' || typeof audioData === 'string') {
      // Base64 string - convert to binary
      console.log('[Offscreen] Converting base64 to blob...');
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
    } else {
      // ArrayBuffer
      console.log('[Offscreen] Converting ArrayBuffer to blob...');
      audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
    }

    console.log(`[Offscreen] Loading audio blob: ${audioBlob.size} bytes`);

    // Create AudioPlayer if not exists
    if (!audioPlayer) {
      audioPlayer = new AudioPlayer();

      // Set up status change listener
      audioPlayer.onStatusChange = (newStatus) => {
        console.log('[Offscreen] Audio status changed to:', newStatus);
        // Notify background script of state change
        chrome.runtime.sendMessage({
          type: 'AUDIO_STATE_CHANGED',
          payload: {
            status: newStatus,
            currentPosition: audioPlayer.currentPosition,
            duration: audioPlayer.duration
          },
          timestamp: Date.now()
        }).catch(err => console.error('Failed to notify background of state change:', err));
      };

      // Set up completion listener
      audioPlayer.onPlaybackEnd = () => {
        console.log('Audio playback completed');
        // Notify background script
        chrome.runtime.sendMessage({
          type: 'AUDIO_PLAYBACK_ENDED',
          payload: {},
          timestamp: Date.now()
        }).catch(err => console.error('Failed to notify background:', err));
      };

      // Set up error listener
      audioPlayer.onPlaybackError = (event) => {
        // Ignore spurious errors with no error object (happens after cleanup)
        if (!audioPlayer.audio?.error) {
          console.log('[Offscreen] Ignoring spurious error event (no error object, likely from cleanup)');
          return;
        }

        // Extract error details from Audio element
        const errorDetails = {
          errorCode: audioPlayer.audio?.error?.code || 'unknown',
          errorMessage: audioPlayer.audio?.error?.message || 'No error message',
          networkState: audioPlayer.audio?.networkState,
          readyState: audioPlayer.audio?.readyState,
          eventType: event?.type || 'unknown',
          // Map error codes to readable names
          errorType: (() => {
            const code = audioPlayer.audio?.error?.code;
            if (code === 1) return 'MEDIA_ERR_ABORTED';
            if (code === 2) return 'MEDIA_ERR_NETWORK';
            if (code === 3) return 'MEDIA_ERR_DECODE';
            if (code === 4) return 'MEDIA_ERR_SRC_NOT_SUPPORTED';
            return 'UNKNOWN_ERROR';
          })()
        };

        console.error('[Offscreen] Audio playback error:', JSON.stringify(errorDetails, null, 2));

        // Notify background script
        chrome.runtime.sendMessage({
          type: 'AUDIO_PLAYBACK_ERROR',
          payload: { error: JSON.stringify(errorDetails) },
          timestamp: Date.now()
        }).catch(err => console.error('Failed to notify background:', err));
      };
    } else {
      // Stop and cleanup existing audio
      audioPlayer.stop();
      audioPlayer.cleanup();
    }

    // Load the audio
    console.log('About to call audioPlayer.loadAudio...');
    await audioPlayer.loadAudio(audioBlob);

    console.log('Audio loaded successfully');
    return {
      duration: audioPlayer.duration,
      size: audioBlob.size
    };

  } catch (error) {
    console.error('Failed to load audio in offscreen document:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    throw error;
  }
}

/**
 * Handle PLAY_AUDIO message
 */
async function handlePlayAudio() {
  if (!audioPlayer) {
    throw new Error('No audio loaded');
  }

  try {
    await audioPlayer.play();
    console.log('Audio playback started');
  } catch (error) {
    console.error('Failed to play audio:', error);
    throw error;
  }
}

/**
 * Handle PAUSE_AUDIO message
 */
function handlePauseAudio() {
  if (!audioPlayer) {
    console.warn('No audio player to pause');
    return;
  }

  audioPlayer.pause();
  console.log('Audio paused');
}

/**
 * Handle RESUME_AUDIO message
 */
async function handleResumeAudio() {
  if (!audioPlayer) {
    throw new Error('No audio loaded');
  }

  try {
    await audioPlayer.resume();
    console.log('Audio resumed');
  } catch (error) {
    console.error('Failed to resume audio:', error);
    throw error;
  }
}

/**
 * Handle STOP_AUDIO message
 */
function handleStopAudio() {
  if (!audioPlayer) {
    console.warn('No audio player to stop');
    return;
  }

  audioPlayer.stop();
  console.log('Audio stopped');
}

/**
 * Get current audio state
 */
function getAudioState() {
  if (!audioPlayer) {
    return {
      status: 'idle',
      currentPosition: 0,
      duration: 0,
      hasAudio: false
    };
  }

  return audioPlayer.getState();
}
