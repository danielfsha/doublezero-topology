/**
 * Unit tests for Data Cache (v2)
 *
 * Tests sessionStorage caching functionality for snapshot, ISIS, and processed topology.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cacheSnapshot,
  getCachedSnapshot,
  clearSnapshotCache,
  cacheIsis,
  getCachedIsis,
  clearIsisCache,
  cacheProcessedTopology,
  getCachedProcessedTopology,
  clearProcessedCache,
  clearAllCaches,
  getTotalCacheSize,
  getAgeString,
  isFresh,
  formatSize,
  type SnapshotData,
  type IsisData,
  type ProcessedTopologyData,
} from "@/lib/storage/snapshot-cache";

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};

beforeEach(() => {
  // Clear mock storage before each test
  Object.keys(mockSessionStorage).forEach((key) => {
    delete mockSessionStorage[key];
  });

  // Mock sessionStorage methods
  global.sessionStorage = {
    getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockSessionStorage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockSessionStorage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(mockSessionStorage).forEach((key) => {
        delete mockSessionStorage[key];
      });
    }),
    length: 0,
    key: vi.fn(() => null),
  } as Storage;
});

describe("Data Cache v2", () => {
  const mockSnapshotData: SnapshotData = {
    data: { test: "snapshot" },
    source: "s3",
    epoch: 34,
    timestamp: Date.now(),
    size: 56000000,
    filename: "mn-epoch-34-snapshot.json",
  };

  const mockIsisData: IsisData = {
    data: { test: "isis" },
    source: "upload",
    filename: "isis-db-2025.10.30.json",
    timestamp: Date.now(),
    size: 877000,
  };

  const mockProcessedTopology: ProcessedTopologyData = {
    topology: [{ id: 1 }],
    locations: [{ id: 1 }],
    summary: { total: 88 },
    processedAt: Date.now(),
    sources: {
      snapshot: mockSnapshotData,
      isis: mockIsisData,
    },
  };

  // ============================================================================
  // Snapshot Cache Tests
  // ============================================================================

  describe("Snapshot Cache", () => {
    describe("cacheSnapshot", () => {
      it("should cache snapshot successfully", () => {
        const result = cacheSnapshot(mockSnapshotData);

        expect(result).toBe(true);
        expect(sessionStorage.setItem).toHaveBeenCalled();
      });

      it("should store snapshot with version v2", () => {
        cacheSnapshot(mockSnapshotData);

        const stored = mockSessionStorage["dztopo:snapshot:v2"];
        expect(stored).toBeTruthy();

        const parsed = JSON.parse(stored);
        expect(parsed.version).toBe("v2");
        expect(parsed.epoch).toBe(34);
        expect(parsed.filename).toBe("mn-epoch-34-snapshot.json");
      });

      it("should handle QuotaExceededError", () => {
        (sessionStorage.setItem as any).mockImplementationOnce(() => {
          const error = new Error("Quota exceeded");
          error.name = "QuotaExceededError";
          throw error;
        });

        const result = cacheSnapshot(mockSnapshotData);
        expect(result).toBe(false);
      });

      it("should cache upload source correctly", () => {
        const uploadSnapshot: SnapshotData = {
          ...mockSnapshotData,
          source: "upload",
        };

        const result = cacheSnapshot(uploadSnapshot);
        expect(result).toBe(true);

        const cached = getCachedSnapshot();
        expect(cached?.source).toBe("upload");
      });
    });

    describe("getCachedSnapshot", () => {
      it("should return null when no cache exists", () => {
        const result = getCachedSnapshot();
        expect(result).toBeNull();
      });

      it("should return cached snapshot when valid", () => {
        cacheSnapshot(mockSnapshotData);
        const result = getCachedSnapshot();

        expect(result).toBeTruthy();
        expect(result?.epoch).toBe(34);
        expect(result?.source).toBe("s3");
        expect(result?.filename).toBe("mn-epoch-34-snapshot.json");
      });

      it("should return null for expired cache (24+ hours old)", () => {
        const expiredSnapshot: SnapshotData = {
          ...mockSnapshotData,
          timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        };

        cacheSnapshot(expiredSnapshot);
        const result = getCachedSnapshot();

        expect(result).toBeNull();
      });

      it("should return null for wrong version", () => {
        // Manually set old version
        mockSessionStorage["dztopo:snapshot:v2"] = JSON.stringify({
          version: "v1",
          ...mockSnapshotData,
        });

        const result = getCachedSnapshot();
        expect(result).toBeNull();
      });
    });

    describe("clearSnapshotCache", () => {
      it("should clear snapshot cache", () => {
        cacheSnapshot(mockSnapshotData);
        expect(getCachedSnapshot()).toBeTruthy();

        clearSnapshotCache();
        expect(getCachedSnapshot()).toBeNull();
      });

      it("should also clear processed cache when snapshot cleared", () => {
        cacheSnapshot(mockSnapshotData);
        cacheIsis(mockIsisData);
        cacheProcessedTopology(mockProcessedTopology);

        expect(getCachedProcessedTopology()).toBeTruthy();

        clearSnapshotCache();
        expect(getCachedProcessedTopology()).toBeNull();
      });
    });
  });

  // ============================================================================
  // ISIS Cache Tests
  // ============================================================================

  describe("ISIS Cache", () => {
    describe("cacheIsis", () => {
      it("should cache ISIS successfully", () => {
        const result = cacheIsis(mockIsisData);

        expect(result).toBe(true);
        expect(sessionStorage.setItem).toHaveBeenCalled();
      });

      it("should store ISIS with version v2", () => {
        cacheIsis(mockIsisData);

        const stored = mockSessionStorage["dztopo:isis:v2"];
        expect(stored).toBeTruthy();

        const parsed = JSON.parse(stored);
        expect(parsed.version).toBe("v2");
        expect(parsed.filename).toBe("isis-db-2025.10.30.json");
      });

      it("should handle QuotaExceededError", () => {
        (sessionStorage.setItem as any).mockImplementationOnce(() => {
          const error = new Error("Quota exceeded");
          error.name = "QuotaExceededError";
          throw error;
        });

        const result = cacheIsis(mockIsisData);
        expect(result).toBe(false);
      });

      it("should cache S3 source correctly", () => {
        const s3Isis: IsisData = {
          ...mockIsisData,
          source: "s3",
        };

        const result = cacheIsis(s3Isis);
        expect(result).toBe(true);

        const cached = getCachedIsis();
        expect(cached?.source).toBe("s3");
      });
    });

    describe("getCachedIsis", () => {
      it("should return null when no cache exists", () => {
        const result = getCachedIsis();
        expect(result).toBeNull();
      });

      it("should return cached ISIS when valid", () => {
        cacheIsis(mockIsisData);
        const result = getCachedIsis();

        expect(result).toBeTruthy();
        expect(result?.filename).toBe("isis-db-2025.10.30.json");
        expect(result?.source).toBe("upload");
      });

      it("should return null for expired cache (24+ hours old)", () => {
        const expiredIsis: IsisData = {
          ...mockIsisData,
          timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        };

        cacheIsis(expiredIsis);
        const result = getCachedIsis();

        expect(result).toBeNull();
      });

      it("should return null for wrong version", () => {
        mockSessionStorage["dztopo:isis:v2"] = JSON.stringify({
          version: "v1",
          ...mockIsisData,
        });

        const result = getCachedIsis();
        expect(result).toBeNull();
      });
    });

    describe("clearIsisCache", () => {
      it("should clear ISIS cache", () => {
        cacheIsis(mockIsisData);
        expect(getCachedIsis()).toBeTruthy();

        clearIsisCache();
        expect(getCachedIsis()).toBeNull();
      });

      it("should also clear processed cache when ISIS cleared", () => {
        cacheSnapshot(mockSnapshotData);
        cacheIsis(mockIsisData);
        cacheProcessedTopology(mockProcessedTopology);

        expect(getCachedProcessedTopology()).toBeTruthy();

        clearIsisCache();
        expect(getCachedProcessedTopology()).toBeNull();
      });
    });
  });

  // ============================================================================
  // Processed Topology Cache Tests
  // ============================================================================

  describe("Processed Topology Cache", () => {
    describe("cacheProcessedTopology", () => {
      it("should cache processed topology successfully", () => {
        const result = cacheProcessedTopology(mockProcessedTopology);

        expect(result).toBe(true);
        expect(sessionStorage.setItem).toHaveBeenCalled();
      });

      it("should store processed topology with version v2", () => {
        cacheProcessedTopology(mockProcessedTopology);

        const stored = mockSessionStorage["dztopo:processed:v2"];
        expect(stored).toBeTruthy();

        const parsed = JSON.parse(stored);
        expect(parsed.version).toBe("v2");
        expect(parsed.topology).toBeDefined();
        expect(parsed.sources).toBeDefined();
      });

      it("should handle QuotaExceededError", () => {
        (sessionStorage.setItem as any).mockImplementationOnce(() => {
          const error = new Error("Quota exceeded");
          error.name = "QuotaExceededError";
          throw error;
        });

        const result = cacheProcessedTopology(mockProcessedTopology);
        expect(result).toBe(false);
      });
    });

    describe("getCachedProcessedTopology", () => {
      it("should return null when no cache exists", () => {
        const result = getCachedProcessedTopology();
        expect(result).toBeNull();
      });

      it("should return cached processed topology when valid", () => {
        cacheProcessedTopology(mockProcessedTopology);
        const result = getCachedProcessedTopology();

        expect(result).toBeTruthy();
        expect(result?.topology).toHaveLength(1);
        expect(result?.summary.total).toBe(88);
      });

      it("should return null for expired cache (24+ hours old)", () => {
        const expiredTopology: ProcessedTopologyData = {
          ...mockProcessedTopology,
          processedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        };

        cacheProcessedTopology(expiredTopology);
        const result = getCachedProcessedTopology();

        expect(result).toBeNull();
      });

      it("should return null for wrong version", () => {
        mockSessionStorage["dztopo:processed:v2"] = JSON.stringify({
          version: "v1",
          ...mockProcessedTopology,
        });

        const result = getCachedProcessedTopology();
        expect(result).toBeNull();
      });
    });

    describe("clearProcessedCache", () => {
      it("should clear processed topology cache", () => {
        cacheProcessedTopology(mockProcessedTopology);
        expect(getCachedProcessedTopology()).toBeTruthy();

        clearProcessedCache();
        expect(getCachedProcessedTopology()).toBeNull();
      });
    });
  });

  // ============================================================================
  // Utility Functions Tests
  // ============================================================================

  describe("Utility Functions", () => {
    describe("clearAllCaches", () => {
      it("should clear all three caches", () => {
        cacheSnapshot(mockSnapshotData);
        cacheIsis(mockIsisData);
        cacheProcessedTopology(mockProcessedTopology);

        expect(getCachedSnapshot()).toBeTruthy();
        expect(getCachedIsis()).toBeTruthy();
        expect(getCachedProcessedTopology()).toBeTruthy();

        clearAllCaches();

        expect(getCachedSnapshot()).toBeNull();
        expect(getCachedIsis()).toBeNull();
        expect(getCachedProcessedTopology()).toBeNull();
      });
    });

    describe("getTotalCacheSize", () => {
      it("should return 0 when no caches exist", () => {
        const size = getTotalCacheSize();
        expect(size).toBe(0);
      });

      it("should return correct total size for all caches", () => {
        cacheSnapshot(mockSnapshotData);
        cacheIsis(mockIsisData);

        const size = getTotalCacheSize();
        expect(size).toBeGreaterThan(0);
      });
    });

    describe("getAgeString", () => {
      it("should return 'Just now' for very recent timestamp", () => {
        const timestamp = Date.now();
        const age = getAgeString(timestamp);

        expect(age).toBe("Just now");
      });

      it("should return minutes for recent timestamp", () => {
        const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
        const age = getAgeString(timestamp);

        expect(age).toBe("5 minutes ago");
      });

      it("should return hours for older timestamp", () => {
        const timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
        const age = getAgeString(timestamp);

        expect(age).toBe("2 hours ago");
      });

      it("should return days for very old timestamp", () => {
        const timestamp = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
        const age = getAgeString(timestamp);

        expect(age).toBe("3 days ago");
      });

      it("should use singular for 1 minute", () => {
        const timestamp = Date.now() - 60 * 1000; // 1 minute ago
        const age = getAgeString(timestamp);

        expect(age).toBe("1 minute ago");
      });
    });

    describe("isFresh", () => {
      it("should return true for S3 data less than 1 hour old", () => {
        const timestamp = Date.now() - 30 * 60 * 1000; // 30 minutes ago
        const result = isFresh("s3", timestamp);

        expect(result).toBe(true);
      });

      it("should return false for S3 data more than 1 hour old", () => {
        const timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
        const result = isFresh("s3", timestamp);

        expect(result).toBe(false);
      });

      it("should return false for upload source", () => {
        const timestamp = Date.now(); // Even if very recent
        const result = isFresh("upload", timestamp);

        expect(result).toBe(false);
      });
    });

    describe("formatSize", () => {
      it("should format 0 bytes", () => {
        const formatted = formatSize(0);
        expect(formatted).toBe("0 Bytes");
      });

      it("should format bytes", () => {
        const formatted = formatSize(512);
        expect(formatted).toBe("512 B");
      });

      it("should format kilobytes", () => {
        const formatted = formatSize(2048);
        expect(formatted).toBe("2.00 KB");
      });

      it("should format megabytes", () => {
        const formatted = formatSize(56000000);
        expect(formatted).toBe("53.41 MB");
      });
    });
  });

  // ============================================================================
  // Cache Invalidation Rules Tests
  // ============================================================================

  describe("Cache Invalidation Rules", () => {
    it("should clear processed cache when snapshot is replaced", () => {
      cacheSnapshot(mockSnapshotData);
      cacheIsis(mockIsisData);
      cacheProcessedTopology(mockProcessedTopology);

      // Replace snapshot
      const newSnapshot: SnapshotData = {
        ...mockSnapshotData,
        epoch: 35,
      };
      clearSnapshotCache();

      // Processed should be cleared, but ISIS should remain
      expect(getCachedIsis()).toBeTruthy();
      expect(getCachedProcessedTopology()).toBeNull();
    });

    it("should clear processed cache when ISIS is replaced", () => {
      cacheSnapshot(mockSnapshotData);
      cacheIsis(mockIsisData);
      cacheProcessedTopology(mockProcessedTopology);

      // Replace ISIS
      clearIsisCache();

      // Processed should be cleared, but snapshot should remain
      expect(getCachedSnapshot()).toBeTruthy();
      expect(getCachedProcessedTopology()).toBeNull();
    });

    it("should keep snapshot and ISIS when only processed is cleared", () => {
      cacheSnapshot(mockSnapshotData);
      cacheIsis(mockIsisData);
      cacheProcessedTopology(mockProcessedTopology);

      clearProcessedCache();

      // Snapshot and ISIS should remain
      expect(getCachedSnapshot()).toBeTruthy();
      expect(getCachedIsis()).toBeTruthy();
      expect(getCachedProcessedTopology()).toBeNull();
    });
  });
});
