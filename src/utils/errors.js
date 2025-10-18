/**
 * Error Handling Utilities
 *
 * Maps API errors to user-friendly messages and provides error type categorization
 */

/**
 * Error types for categorization
 */
export const ErrorTypes = {
  API_KEY_MISSING: 'API_KEY_MISSING',
  API_KEY_INVALID: 'API_KEY_INVALID',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  TEXT_TOO_LONG: 'TEXT_TOO_LONG',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Map API error to user-friendly message
 * @param {Error|Response} error - The error or response object
 * @param {number} statusCode - HTTP status code (if available)
 * @returns {object} - { type: ErrorTypes, message: string }
 */
export function mapApiErrorToUserMessage(error, statusCode = null) {
  // Handle HTTP status codes
  if (statusCode) {
    switch (statusCode) {
      case 401:
        return {
          type: ErrorTypes.API_KEY_INVALID,
          message: 'API key is invalid or expired. Please update your key in settings.'
        };
      case 429:
        return {
          type: ErrorTypes.RATE_LIMIT,
          message: 'API quota exceeded. Please check your ElevenLabs account.'
        };
      case 503:
        return {
          type: ErrorTypes.SERVER_ERROR,
          message: 'Service temporarily unavailable. Please try again later.'
        };
      default:
        if (statusCode >= 500) {
          return {
            type: ErrorTypes.SERVER_ERROR,
            message: 'Server error occurred. Please try again later.'
          };
        }
    }
  }

  // Handle error types
  if (error && error.name === 'AbortError') {
    return {
      type: ErrorTypes.TIMEOUT,
      message: 'Request timed out. Please try again.'
    };
  }

  if (error && (error.message.includes('fetch') || error.message.includes('network'))) {
    return {
      type: ErrorTypes.NETWORK_ERROR,
      message: 'Network error. Please check your internet connection.'
    };
  }

  // Default error
  return {
    type: ErrorTypes.UNKNOWN,
    message: 'An unexpected error occurred. Please try again.'
  };
}
