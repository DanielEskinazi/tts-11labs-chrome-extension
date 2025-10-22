/**
 * ElevenLabs API Client
 *
 * Handles all interactions with the ElevenLabs Text-to-Speech API including:
 * - API request construction
 * - Text-to-speech conversion
 * - Error handling and timeout management
 * - Request cancellation
 */

// API Configuration
export const API_BASE_URL = 'https://api.elevenlabs.io/v1';
export const DEFAULT_VOICE_ID = 'nPczCjzI2devNBz1zQrb'; // Brian voice
export const MAX_TEXT_LENGTH = 5000;
export const API_TIMEOUT = 15000; // 15 seconds

// Active request tracking for cancellation
let activeAbortController = null;

/**
 * Validate API key is present and non-empty
 * @param {string} apiKey - The API key to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export function validateApiKey(apiKey) {
  return apiKey !== null && apiKey !== undefined && apiKey.trim().length > 0;
}

/**
 * Validate text length before sending to API
 * @param {string} text - The text to validate
 * @returns {boolean} - True if valid length, false otherwise
 */
export function validateTextLength(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  return text.length > 0 && text.length <= MAX_TEXT_LENGTH;
}

/**
 * Build API request configuration
 * @param {string} text - The text to convert to speech
 * @param {string} apiKey - The ElevenLabs API key
 * @param {string} voiceId - The voice ID to use (defaults to Brian)
 * @returns {object} - Request configuration object
 */
export function buildApiRequest(text, apiKey, voiceId = DEFAULT_VOICE_ID) {
  const url = `${API_BASE_URL}/text-to-speech/${voiceId}`;

  const headers = {
    'Accept': 'audio/mpeg',
    'Content-Type': 'application/json',
    'xi-api-key': apiKey
  };

  const body = JSON.stringify({
    text: text,
    model_id: 'eleven_turbo_v2_5',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.5
    }
  });

  return {
    url,
    options: {
      method: 'POST',
      headers,
      body
    }
  };
}

/**
 * Convert text to speech using ElevenLabs API
 * @param {string} text - The text to convert
 * @param {string} apiKey - The ElevenLabs API key
 * @returns {Promise<Blob>} - Audio data as a blob
 */
export async function textToSpeech(text, apiKey) {
  // Cancel any pending requests first
  cancelPendingRequests();

  // Create new abort controller for this request
  activeAbortController = new AbortController();
  const timeoutId = setTimeout(() => activeAbortController.abort(), API_TIMEOUT);

  try {
    const { url, options } = buildApiRequest(text, apiKey);

    // Add abort signal to fetch options
    const fetchOptions = {
      ...options,
      signal: activeAbortController.signal
    };

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const audioBlob = await response.blob();
    return audioBlob;
  } finally {
    clearTimeout(timeoutId);
    activeAbortController = null;
  }
}

/**
 * Cancel any pending TTS requests
 */
export function cancelPendingRequests() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}
