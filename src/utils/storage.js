/**
 * Chrome Storage Utilities
 *
 * Wrapper functions for chrome.storage API to simplify storage operations:
 * - API key retrieval
 * - Settings management
 * - Session data access
 */

/**
 * Get the ElevenLabs API key from chrome.storage.local
 * @returns {Promise<string|null>} - The API key or null if not set
 */
export async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['elevenlabs_api_key_config'], (result) => {
      // The popup stores the key in a config object with structure: { apiKey, createdAt, updatedAt }
      const config = result.elevenlabs_api_key_config;
      resolve(config?.apiKey || null);
    });
  });
}

/**
 * Get extension settings from chrome.storage.local
 * @returns {Promise<object>} - Settings object
 */
export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || {});
    });
  });
}

/**
 * Save extension settings to chrome.storage.local
 * @param {object} settings - Settings to save
 * @returns {Promise<void>}
 */
export async function setSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, () => {
      resolve();
    });
  });
}

/**
 * Get selected voice ID from chrome.storage.local
 * @returns {Promise<string|null>} - The selected voice ID or null if not set
 */
export async function getVoicePreference() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['selectedVoiceId'], (result) => {
      resolve(result.selectedVoiceId || null);
    });
  });
}

/**
 * Save selected voice ID to chrome.storage.local
 * @param {string} voiceId - The voice ID to save
 * @returns {Promise<void>}
 */
export async function setVoicePreference(voiceId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ selectedVoiceId: voiceId }, () => {
      resolve();
    });
  });
}

/**
 * Get cached voices from chrome.storage.local
 * @returns {Promise<object|null>} - Cache object or null if invalid/expired
 */
export async function getVoiceCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['voiceCache'], (result) => {
      const cache = result.voiceCache;

      if (!cache || !cache.cachedAt || !Array.isArray(cache.voices)) {
        resolve(null);
        return;
      }

      // Check if cache is still valid (24 hours)
      const age = Date.now() - cache.cachedAt;
      const ttl = cache.ttl || 86400000; // 24 hours in milliseconds

      if (age < ttl) {
        resolve(cache);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Cache voices in chrome.storage.local with 24-hour TTL
 * @param {Array} voices - Array of voice objects to cache
 * @returns {Promise<void>}
 */
export async function setVoiceCache(voices) {
  return new Promise((resolve) => {
    const cache = {
      voices,
      cachedAt: Date.now(),
      ttl: 86400000 // 24 hours
    };

    chrome.storage.local.set({ voiceCache: cache }, () => {
      resolve();
    });
  });
}
