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
