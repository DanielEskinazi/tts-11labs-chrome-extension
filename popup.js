// DOM element references
const form = document.getElementById('api-key-form');
const input = document.getElementById('api-key-input');
const saveButton = document.getElementById('save-button');
const clearButton = document.getElementById('clear-button');
const statusMessage = document.getElementById('status-message');
const errorMessage = document.getElementById('error-message');

// Voice selection elements
const voiceSelect = document.getElementById('voice-select');
const previewButton = document.getElementById('preview-button');
const voiceError = document.getElementById('voice-error');

// Constants
const STORAGE_KEY = 'elevenlabs_api_key_config';
const API_KEY_REGEX = /^[a-fA-F0-9]{64}$/;

// Initialize popup on load
document.addEventListener('DOMContentLoaded', async () => {
  await loadApiKey();
  // Only initialize voices if API key is configured
  const hasApiKey = await checkApiKeyExists();
  if (hasApiKey) {
    initializeVoiceSelector();
  } else {
    // Show helpful message instead of error
    voiceError.textContent = 'Configure API key above to select voices.';
    voiceError.classList.remove('hidden');
  }
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
 * Check if API key exists in storage
 * @returns {Promise<boolean>}
 */
async function checkApiKeyExists() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const config = result[STORAGE_KEY];
      resolve(config && config.apiKey ? true : false);
    });
  });
}

/**
 * Load API key from storage and update UI
 */
function loadApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        showError('Failed to load API key: ' + chrome.runtime.lastError.message);
        updateStatus(false);
        resolve();
        return;
      }

      const config = result[STORAGE_KEY];
      if (config && config.apiKey) {
        input.value = maskApiKey(config.apiKey);
        updateStatus(true);
      } else {
        updateStatus(false);
      }
      resolve();
    });
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

      // Initialize voice selector now that we have an API key
      initializeVoiceSelector();
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

    // Reset voice selector
    voiceSelect.innerHTML = '<option value="">Loading voices...</option>';
    voiceSelect.disabled = true;
    previewButton.disabled = true;
    voiceError.textContent = 'Configure API key above to select voices.';
    voiceError.classList.remove('hidden');
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

/**
 * Format voice label for dropdown display
 * @param {object} voice - Voice object from ElevenLabs API
 * @returns {string} Formatted label (e.g., "Rachel - Female, American")
 */
function formatVoiceLabel(voice) {
  const name = voice.name;
  const gender = voice.labels?.gender || '';
  const accent = voice.labels?.accent || '';

  if (gender && accent) {
    const capitalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1);
    const capitalizedAccent = accent.charAt(0).toUpperCase() + accent.slice(1);
    return `${name} - ${capitalizedGender}, ${capitalizedAccent}`;
  } else if (gender) {
    const capitalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1);
    return `${name} - ${capitalizedGender}`;
  }

  return name;
}

/**
 * Initialize voice selector
 */
async function initializeVoiceSelector() {
  try {
    // Request voices from background
    const response = await chrome.runtime.sendMessage({
      type: 'GET_VOICES',
      payload: { forceRefresh: false },
      timestamp: Date.now()
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to load voices');
    }

    populateVoiceDropdown(response.voices);
    await loadSelectedVoice();

    // Enable controls
    voiceSelect.disabled = false;
    previewButton.disabled = false;

    // Hide error if previously shown
    voiceError.classList.add('hidden');
  } catch (error) {
    console.error('Failed to initialize voice selector:', error);
    voiceError.textContent = 'Failed to load voices. Using default voice.';
    voiceError.classList.remove('hidden');
  }
}

/**
 * Populate voice dropdown with options
 */
function populateVoiceDropdown(voices) {
  // Clear existing options
  voiceSelect.innerHTML = '';

  // Add options for each voice
  voices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.voice_id;
    option.textContent = formatVoiceLabel(voice);
    voiceSelect.appendChild(option);
  });
}

/**
 * Load and set selected voice in dropdown
 */
async function loadSelectedVoice() {
  const result = await chrome.storage.local.get(['selectedVoiceId']);
  const selectedVoiceId = result.selectedVoiceId;

  if (selectedVoiceId) {
    voiceSelect.value = selectedVoiceId;
  }
}

/**
 * Save voice selection
 */
async function saveVoiceSelection() {
  const voiceId = voiceSelect.value;

  await chrome.storage.local.set({ selectedVoiceId: voiceId });
  console.log('Voice preference saved:', voiceId);
}

/**
 * Preview selected voice
 */
function previewVoice() {
  const voiceId = voiceSelect.value;

  if (!voiceId) {
    return;
  }

  chrome.runtime.sendMessage({
    type: 'PREVIEW_VOICE',
    payload: {
      voiceId: voiceId,
      sampleText: 'Hello, this is a preview of this voice.'
    },
    timestamp: Date.now()
  });
}

// Event listeners for voice selection
voiceSelect.addEventListener('change', saveVoiceSelection);
previewButton.addEventListener('click', previewVoice);
