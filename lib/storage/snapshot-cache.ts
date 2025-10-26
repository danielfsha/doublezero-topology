/**
 * Data Cache using sessionStorage
 *
 * Caches snapshot, ISIS, and processed topology data separately.
 * Uses sessionStorage so cache is cleared when browser tab closes.
 *
 * Version 2: Refactored to support independent snapshot/ISIS tracking
 */

/**
 * Data source for snapshot or ISIS
 */
export type DataSource = "s3" | "upload";

/**
 * Snapshot data structure
 */
export interface SnapshotData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  source: DataSource;
  epoch: number | null;
  timestamp: number;
  size: number;
  filename: string;
}

/**
 * ISIS data structure
 */
export interface IsisData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  source: DataSource;
  filename: string;
  timestamp: number;
  size: number;
}

/**
 * Processed topology data structure
 */
export interface ProcessedTopologyData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topology: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  locations: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summary: any;
  processedAt: number;
  sources: {
    snapshot: SnapshotData;
    isis: IsisData;
  };
}

/**
 * Storage keys (v2)
 */
const SNAPSHOT_CACHE_KEY = "dztopo:snapshot:v2";
const ISIS_CACHE_KEY = "dztopo:isis:v2";
const PROCESSED_CACHE_KEY = "dztopo:processed:v2";
const CACHE_VERSION = "v2";

/**
 * Maximum age for cache (24 hours in milliseconds)
 */
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000;

/**
 * Check if sessionStorage is available
 *
 * @returns true if sessionStorage is available
 */
function isStorageAvailable(): boolean {
  try {
    const test = "__storage_test__";
    sessionStorage.setItem(test, test);
    sessionStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if cached data is expired
 *
 * @param timestamp - Timestamp to check
 * @returns true if expired
 */
function isExpired(timestamp: number): boolean {
  const age = Date.now() - timestamp;
  return age > MAX_CACHE_AGE;
}

// ============================================================================
// Snapshot Cache Functions
// ============================================================================

/**
 * Cache snapshot data in sessionStorage
 *
 * @param snapshot - Snapshot data to cache
 * @returns true if successfully cached, false if storage full or unavailable
 */
export function cacheSnapshot(snapshot: SnapshotData): boolean {
  if (!isStorageAvailable()) {
    console.warn("[WARN] sessionStorage not available - snapshot cache disabled");
    return false;
  }

  try {
    const cacheData = {
      version: CACHE_VERSION,
      ...snapshot,
    };

    const serialized = JSON.stringify(cacheData);

    // Check if size exceeds typical sessionStorage limit (5MB)
    const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
    if (sizeInMB > 5) {
      console.warn(`[WARN] Snapshot too large to cache (${sizeInMB.toFixed(1)}MB > 5MB limit)`);
      return false;
    }

    sessionStorage.setItem(SNAPSHOT_CACHE_KEY, serialized);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.warn("[WARN] sessionStorage quota exceeded - snapshot not cached");
      return false;
    }
    console.error("[ERROR] Failed to cache snapshot:", error);
    return false;
  }
}

/**
 * Get cached snapshot from sessionStorage
 *
 * @returns Cached snapshot if available and valid, null otherwise
 */
export function getCachedSnapshot(): SnapshotData | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const cached = sessionStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached);

    // Check version
    if (parsed.version !== CACHE_VERSION) {
      console.warn("[WARN] Snapshot cache version mismatch - invalidating");
      clearSnapshotCache();
      return null;
    }

    // Check age
    if (isExpired(parsed.timestamp)) {
      console.warn("[WARN] Snapshot cache expired - invalidating");
      clearSnapshotCache();
      return null;
    }

    // Return cached data without version field
    const { version: _, ...snapshot } = parsed;
    return snapshot as SnapshotData;
  } catch (error) {
    console.error("[ERROR] Failed to read snapshot cache:", error);
    return null;
  }
}

/**
 * Clear snapshot cache
 */
export function clearSnapshotCache(): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    sessionStorage.removeItem(SNAPSHOT_CACHE_KEY);
    // When snapshot changes, clear processed topology too
    clearProcessedCache();
  } catch (error) {
    console.error("[ERROR] Failed to clear snapshot cache:", error);
  }
}

// ============================================================================
// ISIS Cache Functions
// ============================================================================

/**
 * Cache ISIS data in sessionStorage
 *
 * @param isis - ISIS data to cache
 * @returns true if successfully cached, false if storage full or unavailable
 */
export function cacheIsis(isis: IsisData): boolean {
  if (!isStorageAvailable()) {
    console.warn("[WARN] sessionStorage not available - ISIS cache disabled");
    return false;
  }

  try {
    const cacheData = {
      version: CACHE_VERSION,
      ...isis,
    };

    const serialized = JSON.stringify(cacheData);
    sessionStorage.setItem(ISIS_CACHE_KEY, serialized);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.error("[ERROR] sessionStorage quota exceeded - ISIS not cached");
      return false;
    }
    console.error("[ERROR] Failed to cache ISIS:", error);
    return false;
  }
}

/**
 * Get cached ISIS from sessionStorage
 *
 * @returns Cached ISIS if available and valid, null otherwise
 */
export function getCachedIsis(): IsisData | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const cached = sessionStorage.getItem(ISIS_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached);

    // Check version
    if (parsed.version !== CACHE_VERSION) {
      console.warn("[WARN] ISIS cache version mismatch - invalidating");
      clearIsisCache();
      return null;
    }

    // Check age
    if (isExpired(parsed.timestamp)) {
      console.warn("[WARN] ISIS cache expired - invalidating");
      clearIsisCache();
      return null;
    }

    // Return cached data without version field
    const { version: _, ...isis } = parsed;
    return isis as IsisData;
  } catch (error) {
    console.error("[ERROR] Failed to read ISIS cache:", error);
    return null;
  }
}

/**
 * Clear ISIS cache
 */
export function clearIsisCache(): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    sessionStorage.removeItem(ISIS_CACHE_KEY);
    // When ISIS changes, clear processed topology too
    clearProcessedCache();
  } catch (error) {
    console.error("[ERROR] Failed to clear ISIS cache:", error);
  }
}

// ============================================================================
// Processed Topology Cache Functions
// ============================================================================

/**
 * Cache processed topology in sessionStorage
 *
 * @param topology - Processed topology data to cache
 * @returns true if successfully cached, false if storage full or unavailable
 */
export function cacheProcessedTopology(topology: ProcessedTopologyData): boolean {
  if (!isStorageAvailable()) {
    console.warn("[WARN] sessionStorage not available - processed topology cache disabled");
    return false;
  }

  try {
    const cacheData = {
      version: CACHE_VERSION,
      ...topology,
    };

    const serialized = JSON.stringify(cacheData);

    // Check if size exceeds typical sessionStorage limit (5MB)
    const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
    if (sizeInMB > 5) {
      console.warn(`[WARN] Processed topology too large to cache (${sizeInMB.toFixed(1)}MB > 5MB limit)`);
      return false;
    }

    sessionStorage.setItem(PROCESSED_CACHE_KEY, serialized);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.warn("[WARN] sessionStorage quota exceeded - processed topology not cached");
      return false;
    }
    console.error("[ERROR] Failed to cache processed topology:", error);
    return false;
  }
}

/**
 * Get cached processed topology from sessionStorage
 *
 * @returns Cached processed topology if available and valid, null otherwise
 */
export function getCachedProcessedTopology(): ProcessedTopologyData | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const cached = sessionStorage.getItem(PROCESSED_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached);

    // Check version
    if (parsed.version !== CACHE_VERSION) {
      console.warn("[WARN] Processed topology cache version mismatch - invalidating");
      clearProcessedCache();
      return null;
    }

    // Check age
    if (isExpired(parsed.processedAt)) {
      console.warn("[WARN] Processed topology cache expired - invalidating");
      clearProcessedCache();
      return null;
    }

    // Return cached data without version field
    const { version: _, ...topology } = parsed;
    return topology as ProcessedTopologyData;
  } catch (error) {
    console.error("[ERROR] Failed to read processed topology cache:", error);
    return null;
  }
}

/**
 * Clear processed topology cache
 */
export function clearProcessedCache(): void {
  if (!isStorageAvailable()) {
    return;
  }

  try {
    sessionStorage.removeItem(PROCESSED_CACHE_KEY);
  } catch (error) {
    console.error("[ERROR] Failed to clear processed topology cache:", error);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  clearSnapshotCache();
  clearIsisCache();
  clearProcessedCache();
}

/**
 * Get total cache size in bytes
 *
 * @returns Total size of all cached data in bytes
 */
export function getTotalCacheSize(): number {
  if (!isStorageAvailable()) {
    return 0;
  }

  try {
    let total = 0;

    const snapshot = sessionStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (snapshot) {
      total += snapshot.length * 2; // 2 bytes per character in UTF-16
    }

    const isis = sessionStorage.getItem(ISIS_CACHE_KEY);
    if (isis) {
      total += isis.length * 2;
    }

    const processed = sessionStorage.getItem(PROCESSED_CACHE_KEY);
    if (processed) {
      total += processed.length * 2;
    }

    return total;
  } catch {
    return 0;
  }
}

/**
 * Get human-readable age string
 *
 * @param timestamp - Timestamp to calculate age from
 * @returns Human-readable string like "2 hours ago"
 */
export function getAgeString(timestamp: number): string {
  const age = Date.now() - timestamp;
  const seconds = Math.floor(age / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }
  return "Just now";
}

/**
 * Check if S3 data is fresh (less than 1 hour old)
 *
 * @param source - Data source
 * @param timestamp - Timestamp to check
 * @returns true if fresh
 */
export function isFresh(source: DataSource, timestamp: number): boolean {
  if (source !== "s3") {
    return false;
  }

  const age = Date.now() - timestamp;
  return age < 60 * 60 * 1000; // 1 hour
}

/**
 * Format file size in human-readable format
 *
 * @param bytes - Size in bytes
 * @returns Formatted string like "56.2 MB"
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================================================
// Legacy Support (Backward Compatibility)
// ============================================================================

/**
 * Legacy: Cached snapshot structure (v1)
 * @deprecated Use separate snapshot/ISIS caching instead
 */
export interface CachedSnapshot {
  epoch: number | null;
  timestamp: number;
  source: DataSource;
  data: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    snapshot: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isisDb: any | null;
  };
  metadata: {
    snapshotSize: number;
    isisDbSize?: number;
  };
}

/**
 * Legacy: Get cache age in milliseconds
 * @deprecated Use getAgeString() instead
 */
export function getCacheAge(): number | null {
  const cached = getCachedSnapshot();
  if (!cached) {
    return null;
  }

  return Date.now() - cached.timestamp;
}

/**
 * Legacy: Get human-readable cache age
 * @deprecated Use getAgeString(timestamp) instead
 */
export function getCacheAgeString(): string | null {
  const age = getCacheAge();
  if (age === null) {
    return null;
  }

  return getAgeString(Date.now() - age);
}

/**
 * Legacy: Check if cache is fresh
 * @deprecated Use isFresh(source, timestamp) instead
 */
export function isCacheFresh(): boolean {
  const cached = getCachedSnapshot();
  if (!cached) {
    return false;
  }

  return isFresh(cached.source, cached.timestamp);
}

/**
 * Legacy: Invalidate cache
 * @deprecated Use clearSnapshotCache() or clearAllCaches() instead
 */
export function invalidateCache(): void {
  clearAllCaches();
}

/**
 * Legacy: Get cache size
 * @deprecated Use getTotalCacheSize() instead
 */
export function getCacheSize(): number {
  return getTotalCacheSize();
}
