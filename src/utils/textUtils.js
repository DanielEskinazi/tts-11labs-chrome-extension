// textUtils.js - Text Parsing and Timing Utilities for Sentence Highlighting
// Provides functions for splitting text into sentences and calculating highlight timings

/**
 * Split text into sentences using punctuation detection
 * Uses regex pattern to match sentence-ending punctuation (. ! ?) followed by whitespace
 *
 * @param {string} text - The text to split into sentences
 * @returns {Array<{text: string, startOffset: number, endOffset: number, index: number}>}
 *
 * @example
 * const text = "Hello world. This is a test! How are you?";
 * const sentences = splitIntoSentences(text);
 * // Returns 3 sentence objects
 */
export function splitIntoSentences(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.warn('splitIntoSentences: Invalid or empty text provided');
    return [];
  }

  // Split on sentence-ending punctuation followed by whitespace
  // Pattern captures: one or more [.!?] followed by one or more whitespace
  const parts = text.split(/([.!?]+\s+)/);

  const sentences = [];
  let currentOffset = 0;

  // Process pairs: sentence text + punctuation+whitespace
  for (let i = 0; i < parts.length; i += 2) {
    const sentenceText = parts[i];
    const punctuation = parts[i + 1] || '';

    // Combine sentence with its punctuation
    const fullText = (sentenceText + punctuation).trim();

    if (fullText.length === 0) continue;

    sentences.push({
      text: fullText,
      startOffset: currentOffset,
      endOffset: currentOffset + fullText.length,
      index: sentences.length
    });

    currentOffset += fullText.length + 1; // +1 for space between sentences
  }

  console.log(`splitIntoSentences: Parsed ${sentences.length} sentences from ${text.length} characters`);
  return sentences;
}

/**
 * Calculate sentence timings based on proportional character count
 * Each sentence gets a duration proportional to its character count relative to total text
 * Timing adjusts automatically for playback speed changes
 *
 * @param {Array<{text: string, index: number}>} sentences - Array of sentence objects
 * @param {number} totalAudioDuration - Total audio duration in milliseconds
 * @param {number} playbackSpeed - Current playback speed (0.5 - 2.0), defaults to 1.0
 * @returns {Array<{sentenceIndex: number, startTime: number, endTime: number, duration: number}>}
 *
 * @example
 * const timings = calculateSentenceTimings(sentences, 10000, 1.0);
 * // Returns timing objects with startTime, endTime for each sentence
 */
export function calculateSentenceTimings(sentences, totalAudioDuration, playbackSpeed = 1.0) {
  if (!Array.isArray(sentences) || sentences.length === 0) {
    console.warn('calculateSentenceTimings: Invalid or empty sentences array');
    return [];
  }

  if (!totalAudioDuration || totalAudioDuration <= 0) {
    console.error('calculateSentenceTimings: Invalid audio duration:', totalAudioDuration);
    return [];
  }

  if (!playbackSpeed || playbackSpeed < 0.5 || playbackSpeed > 2.0) {
    console.warn('calculateSentenceTimings: Invalid playback speed, using 1.0:', playbackSpeed);
    playbackSpeed = 1.0;
  }

  // Calculate total character count across all sentences
  const totalChars = sentences.reduce((sum, sentence) => {
    return sum + (sentence.text ? sentence.text.length : 0);
  }, 0);

  if (totalChars === 0) {
    console.error('calculateSentenceTimings: Total character count is 0');
    return [];
  }

  const timings = [];
  let currentTime = 0;

  for (const sentence of sentences) {
    // Calculate proportion of total text this sentence represents
    const proportion = sentence.text.length / totalChars;

    // Calculate duration for this sentence, adjusted for playback speed
    // Higher speed = shorter duration (divide by speed)
    const duration = (proportion * totalAudioDuration) / playbackSpeed;

    timings.push({
      sentenceIndex: sentence.index,
      startTime: currentTime,
      endTime: currentTime + duration,
      duration: duration
    });

    currentTime += duration;
  }

  console.log(`calculateSentenceTimings: Generated ${timings.length} timings for ${totalAudioDuration}ms audio at ${playbackSpeed}x speed`);
  return timings;
}
