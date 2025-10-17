// DOM element references
const form = document.getElementById('api-key-form');
const input = document.getElementById('api-key-input');
const saveButton = document.getElementById('save-button');
const clearButton = document.getElementById('clear-button');
const statusMessage = document.getElementById('status-message');
const errorMessage = document.getElementById('error-message');

// Constants
const STORAGE_KEY = 'elevenlabs_api_key_config';
const API_KEY_REGEX = /^[a-fA-F0-9]{64}$/;

// Initialize popup on load
document.addEventListener('DOMContentLoaded', () => {
  loadApiKey();
});

// Form submit handler
form.addEventListener('submit', (e) => {
  e.preventDefault();
  saveApiKey();
});

// Clear button handler
clearButton.addEventListener('click', () => {
  clearApiKey();
});

/**
 * Load API key from storage and update UI
 */
function loadApiKey() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (chrome.runtime.lastError) {
      showError('Failed to load API key: ' + chrome.runtime.lastError.message);
      updateStatus(false);
      return;
    }

    const config = result[STORAGE_KEY];
    if (config && config.apiKey) {
      input.value = maskApiKey(config.apiKey);
      updateStatus(true);
    } else {
      updateStatus(false);
    }
  });
}

/**
 * Save API key to storage
 */
function saveApiKey() {
  const apiKey = input.value.trim();

  // Validate API key format
  const validation = validateApiKey(apiKey);
  if (!validation.valid) {
    showError(validation.error);
    return;
  }

  // Create/update configuration object
  const config = {
    apiKey: validation.value,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Check if updating existing key (preserve createdAt)
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    if (result[STORAGE_KEY] && result[STORAGE_KEY].createdAt) {
      config.createdAt = result[STORAGE_KEY].createdAt;
    }

    // Save to storage
    chrome.storage.local.set({ [STORAGE_KEY]: config }, () => {
      if (chrome.runtime.lastError) {
        showError('Failed to save API key: ' + chrome.runtime.lastError.message);
        return;
      }

      // Update UI
      input.value = maskApiKey(config.apiKey);
      updateStatus(true);
      hideError();
    });
  });
}

/**
 * Clear API key from storage
 */
function clearApiKey() {
  chrome.storage.local.remove([STORAGE_KEY], () => {
    if (chrome.runtime.lastError) {
      showError('Failed to clear API key: ' + chrome.runtime.lastError.message);
      return;
    }

    input.value = '';
    updateStatus(false);
    hideError();
  });
}

/**
 * Validate API key format
 * @param {string} key - API key to validate
 * @returns {{valid: boolean, error?: string, value?: string}}
 */
function validateApiKey(key) {
  if (!key || key.length === 0) {
    return { valid: false, error: 'API key cannot be empty' };
  }

  if (!API_KEY_REGEX.test(key)) {
    return {
      valid: false,
      error: 'Invalid API key format. Expected 64-character hexadecimal string.'
    };
  }

  return { valid: true, value: key };
}

/**
 * Mask API key for display (show last 4 characters)
 * @param {string} key - Full API key
 * @returns {string} Masked API key
 */
function maskApiKey(key) {
  if (!key || key.length < 4) return key;
  const lastFour = key.slice(-4);
  const dots = '•'.repeat(key.length - 4);
  return dots + lastFour;
}

/**
 * Update status message based on configuration state
 * @param {boolean} isConfigured - Whether API key is configured
 */
function updateStatus(isConfigured) {
  statusMessage.className = 'status ' + (isConfigured ? 'configured' : 'not-configured');
  statusMessage.textContent = isConfigured
    ? '✓ Configured and ready'
    : '⚠ API key required';
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.classList.add('hidden');
  errorMessage.textContent = '';
}
