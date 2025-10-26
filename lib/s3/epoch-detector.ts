/**
 * Epoch Detection Algorithm
 *
 * Automatically detects the latest available epoch in the S3 bucket.
 * Does NOT assume sequential numbering (e.g., epoch 33 may not exist).
 *
 * Strategy: Try epochs from high to low using HEAD requests
 * to avoid downloading full files.
 */

import { checkEpochExists, type FileType } from "./public-bucket";

/**
 * Default starting epoch for detection
 * (assumes epochs won't exceed 100 in near future)
 */
const DEFAULT_START_EPOCH = 100;

/**
 * Minimum known epoch (earliest available)
 */
const MIN_EPOCH = 32;

/**
 * Detect the latest available epoch in the S3 bucket
 *
 * Uses binary search-like approach with fallback to linear search:
 * 1. Check if start epoch exists
 * 2. If yes, try higher (doubling)
 * 3. If no, search downward linearly
 *
 * @param startEpoch - Starting epoch to check (default: 100)
 * @param fileType - Type of file to check for
 * @returns Latest available epoch number, or null if none found
 */
export async function detectLatestEpoch(
  startEpoch: number = DEFAULT_START_EPOCH,
  fileType: FileType = "snapshot"
): Promise<number | null> {
  // First, do a quick check if the start epoch exists
  const startExists = await checkEpochExists(startEpoch, fileType);

  if (startExists) {
    // If start epoch exists, try to find a higher one
    let searchEpoch = startEpoch * 2;
    while (searchEpoch <= 999) {
      const exists = await checkEpochExists(searchEpoch, fileType);
      if (exists) {
        startEpoch = searchEpoch;
        searchEpoch *= 2;
      } else {
        break;
      }
    }

    // Now do linear search downward from startEpoch to find exact latest
    for (let epoch = startEpoch; epoch <= 999; epoch++) {
      const nextExists = await checkEpochExists(epoch + 1, fileType);
      if (!nextExists) {
        return epoch; // Found the latest
      }
    }

    return startEpoch;
  }

  // Start epoch doesn't exist, search downward linearly
  for (let epoch = startEpoch - 1; epoch >= MIN_EPOCH; epoch--) {
    const exists = await checkEpochExists(epoch, fileType);
    if (exists) {
      return epoch;
    }
  }

  // No epochs found
  return null;
}

/**
 * Detect latest epoch with progress callback
 *
 * Useful for showing progress in UI during detection
 *
 * @param startEpoch - Starting epoch to check
 * @param fileType - Type of file to check for
 * @param onProgress - Callback for progress updates (current epoch being checked)
 * @returns Latest available epoch number, or null if none found
 */
export async function detectLatestEpochWithProgress(
  startEpoch: number = DEFAULT_START_EPOCH,
  fileType: FileType = "snapshot",
  onProgress?: (currentEpoch: number, maxEpoch: number) => void
): Promise<number | null> {
  const maxSearchEpoch = startEpoch;

  for (let epoch = maxSearchEpoch; epoch >= MIN_EPOCH; epoch--) {
    if (onProgress) {
      onProgress(epoch, maxSearchEpoch);
    }

    const exists = await checkEpochExists(epoch, fileType);
    if (exists) {
      return epoch;
    }
  }

  return null;
}

/**
 * Check if a specific epoch exists (wrapper for better API)
 *
 * @param epoch - Epoch number to check
 * @param fileType - Type of file to check for
 * @returns true if epoch exists, false otherwise
 */
export async function isEpochAvailable(
  epoch: number,
  fileType: FileType = "snapshot"
): Promise<boolean> {
  return await checkEpochExists(epoch, fileType);
}

/**
 * Get a list of available epochs in a given range
 *
 * Note: This can be slow for large ranges. Use sparingly.
 *
 * @param startEpoch - Start of range (inclusive)
 * @param endEpoch - End of range (inclusive)
 * @param fileType - Type of file to check for
 * @returns Array of available epoch numbers
 */
export async function getAvailableEpochs(
  startEpoch: number,
  endEpoch: number,
  fileType: FileType = "snapshot"
): Promise<number[]> {
  const available: number[] = [];

  // Limit range to prevent too many requests
  const range = Math.abs(endEpoch - startEpoch);
  if (range > 50) {
    throw new Error("Range too large. Maximum 50 epochs per query.");
  }

  const start = Math.min(startEpoch, endEpoch);
  const end = Math.max(startEpoch, endEpoch);

  for (let epoch = start; epoch <= end; epoch++) {
    const exists = await checkEpochExists(epoch, fileType);
    if (exists) {
      available.push(epoch);
    }
  }

  return available;
}
