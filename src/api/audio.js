/**
 * Audio Playback Manager
 *
 * Manages audio playback for TTS including:
 * - Audio loading from blob URLs
 * - Play/pause/resume/stop controls
 * - Playback state tracking
 * - Resource cleanup
 * - Autoplay policy detection
 */

/**
 * AudioPlayer class for managing TTS audio playback
 */
export class AudioPlayer {
  constructor() {
    this.audio = null;
    this.blobUrl = null;
    this.status = 'idle'; // idle, loading, playing, paused, error
    this.currentPosition = 0;
    this.duration = 0;
    this.isCleaningUp = false; // Track if we're in cleanup mode

    // Event handlers
    this.onPlaybackEnd = null;
    this.onPlaybackError = null;
    this.onStatusChange = null;
  }

  /**
   * Get current playback state
   * @returns {object} State object with status, position, duration
   */
  getState() {
    return {
      status: this.status,
      currentPosition: this.currentPosition,
      duration: this.duration,
      hasAudio: this.audio !== null
    };
  }

  /**
   * Update status and trigger callback
   * @private
   */
  _updateStatus(newStatus) {
    this.status = newStatus;
    if (this.onStatusChange) {
      this.onStatusChange(newStatus);
    }
  }

  /**
   * Load audio from blob data
   * @param {Blob} audioBlob - The audio data to load
   * @returns {Promise<void>}
   */
  async loadAudio(audioBlob) {
    try {
      console.log('[AudioPlayer] Starting loadAudio, blob:', audioBlob);
      this._updateStatus('loading');

      // Clean up any existing audio first
      this.cleanup();

      // Create blob URL for audio
      console.log('[AudioPlayer] Creating blob URL...');
      this.blobUrl = URL.createObjectURL(audioBlob);
      console.log('[AudioPlayer] Blob URL created:', this.blobUrl);

      // Create audio element
      console.log('[AudioPlayer] Creating Audio element...');
      this.audio = new Audio(this.blobUrl);
      console.log('[AudioPlayer] Audio element created');

      // Set up event listeners
      return new Promise((resolve, reject) => {
        this.audio.addEventListener('loadedmetadata', () => {
          this.duration = this.audio.duration;
          console.log(`[AudioPlayer] Audio loaded: ${this.duration}s duration`);
          resolve();
        });

        this.audio.addEventListener('error', (event) => {
          // Ignore errors during cleanup (happens when blob URL is revoked)
          if (this.isCleaningUp) {
            console.log('[AudioPlayer] Ignoring error during cleanup');
            return;
          }

          // Ignore spurious errors with no error object (happens after cleanup when blob URL is revoked)
          if (!this.audio.error) {
            console.log('[AudioPlayer] Ignoring spurious error event (no error object, likely from cleanup)');
            return;
          }

          const errorDetails = {
            errorCode: this.audio.error?.code,
            errorMessage: this.audio.error?.message,
            networkState: this.audio.networkState,
            readyState: this.audio.readyState,
            src: this.audio.src?.substring(0, 50) + '...',
            eventType: event.type
          };
          console.error('[AudioPlayer] Audio element error event:', JSON.stringify(errorDetails, null, 2));
          this._updateStatus('error');
          if (this.onPlaybackError) {
            this.onPlaybackError(event);
          }
          reject(new Error('Failed to load audio'));
        });

        this.audio.addEventListener('ended', () => {
          console.log('[AudioPlayer] Audio playback ended');
          this._updateStatus('idle');
          if (this.onPlaybackEnd) {
            this.onPlaybackEnd();
          }
        });

        this.audio.addEventListener('timeupdate', () => {
          this.currentPosition = this.audio.currentTime;
        });
      });
    } catch (error) {
      console.error('[AudioPlayer] Error in loadAudio:', error);
      console.error('[AudioPlayer] Error stack:', error.stack);
      this._updateStatus('error');
      throw error;
    }
  }

  /**
   * Play the loaded audio
   * @returns {Promise<void>}
   */
  async play() {
    if (!this.audio) {
      throw new Error('No audio loaded');
    }

    try {
      await this.audio.play();
      this._updateStatus('playing');
      console.log('Audio playback started');
    } catch (error) {
      // Handle autoplay policy blocking
      if (error.name === 'NotAllowedError') {
        console.warn('Autoplay blocked by browser policy');
        throw new Error('AUTOPLAY_BLOCKED');
      }
      console.error('Play error:', error);
      this._updateStatus('error');
      throw error;
    }
  }

  /**
   * Pause playback
   */
  pause() {
    if (!this.audio) {
      console.warn('No audio to pause');
      return;
    }

    if (this.status === 'playing') {
      this.audio.pause();
      this._updateStatus('paused');
      console.log('Audio paused at', this.currentPosition);
    }
  }

  /**
   * Resume playback from paused position
   */
  async resume() {
    if (!this.audio) {
      console.warn('No audio to resume');
      return;
    }

    if (this.status === 'paused') {
      try {
        await this.audio.play();
        this._updateStatus('playing');
        console.log('Audio resumed from', this.currentPosition);
      } catch (error) {
        console.error('Resume error:', error);
        this._updateStatus('error');
        throw error;
      }
    }
  }

  /**
   * Stop playback and reset position
   */
  stop() {
    if (!this.audio) {
      console.warn('No audio to stop');
      return;
    }

    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentPosition = 0;
    this._updateStatus('idle');
    console.log('Audio stopped');
  }

  /**
   * Clean up audio resources
   */
  cleanup() {
    this.isCleaningUp = true; // Set flag to ignore errors during cleanup

    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }

    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }

    this.currentPosition = 0;
    this.duration = 0;
    this._updateStatus('idle');
    console.log('Audio resources cleaned up');

    this.isCleaningUp = false; // Reset flag
  }
}
