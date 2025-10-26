/**
 * Unit tests for Epoch Detection Algorithm
 *
 * Tests the automatic detection of latest available epochs in S3.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  detectLatestEpoch,
  detectLatestEpochWithProgress,
  isEpochAvailable,
  getAvailableEpochs,
} from "@/lib/s3/epoch-detector";
import * as publicBucket from "@/lib/s3/public-bucket";

// Mock the checkEpochExists function
vi.mock("@/lib/s3/public-bucket", async () => {
  const actual = await vi.importActual("@/lib/s3/public-bucket");
  return {
    ...actual,
    checkEpochExists: vi.fn(),
  };
});

describe("Epoch Detection Algorithm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("detectLatestEpoch", () => {
    it("should find latest epoch when it exists at start", async () => {
      // Mock: epoch 100 exists, 101 doesn't
      (publicBucket.checkEpochExists as any)
        .mockResolvedValueOnce(true) // 100 exists
        .mockResolvedValueOnce(false); // 200 doesn't exist

      const latest = await detectLatestEpoch(100);
      expect(latest).toBe(100);
    });

    it("should find latest epoch when higher than start", async () => {
      // Mock: 50 exists, 100 exists, 200 doesn't
      (publicBucket.checkEpochExists as any)
        .mockResolvedValueOnce(true) // 50 exists
        .mockResolvedValueOnce(true) // 100 exists
        .mockResolvedValueOnce(false) // 200 doesn't exist
        .mockResolvedValueOnce(false); // 101 doesn't exist

      const latest = await detectLatestEpoch(50);
      expect(latest).toBe(100);
    });

    it("should find latest epoch below start", async () => {
      // Mock: 100 doesn't exist, search downward, find 34
      (publicBucket.checkEpochExists as any)
        .mockResolvedValueOnce(false) // 100 doesn't exist
        .mockResolvedValueOnce(false) // 99 doesn't exist
        .mockResolvedValue(false); // All others don't exist

      // Override for epoch 34
      (publicBucket.checkEpochExists as any).mockImplementation(
        async (epoch: number) => {
          return epoch === 34;
        }
      );

      const latest = await detectLatestEpoch(100);
      expect(latest).toBe(34);
    });

    it("should return null when no epochs exist", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValue(false);

      const latest = await detectLatestEpoch(100);
      expect(latest).toBeNull();
    });

    it("should handle gaps in epoch numbering", async () => {
      // Mock: epochs 32, 34, 36 exist (no 33, 35)
      (publicBucket.checkEpochExists as any).mockImplementation(
        async (epoch: number) => {
          return epoch === 32 || epoch === 34 || epoch === 36;
        }
      );

      const latest = await detectLatestEpoch(100);
      expect(latest).toBe(36);
    });

    it("should use custom start epoch", async () => {
      (publicBucket.checkEpochExists as any).mockImplementation(
        async (epoch: number) => {
          return epoch === 40;
        }
      );

      const latest = await detectLatestEpoch(50);
      expect(latest).toBe(40);
    });

    it("should check snapshot file type by default", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValue(false);

      await detectLatestEpoch(100);

      expect(publicBucket.checkEpochExists).toHaveBeenCalledWith(
        expect.any(Number),
        "snapshot"
      );
    });

    it("should check isis-db file type when specified", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValue(false);

      await detectLatestEpoch(100, "isis-db");

      expect(publicBucket.checkEpochExists).toHaveBeenCalledWith(
        expect.any(Number),
        "isis-db"
      );
    });
  });

  describe("detectLatestEpochWithProgress", () => {
    it("should call progress callback during search", async () => {
      (publicBucket.checkEpochExists as any).mockImplementation(
        async (epoch: number) => {
          return epoch === 34;
        }
      );

      const progressCallback = vi.fn();
      const latest = await detectLatestEpochWithProgress(
        50,
        "snapshot",
        progressCallback
      );

      expect(latest).toBe(34);
      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(expect.any(Number), 50);
    });

    it("should work without progress callback", async () => {
      (publicBucket.checkEpochExists as any).mockImplementation(
        async (epoch: number) => {
          return epoch === 34;
        }
      );

      const latest = await detectLatestEpochWithProgress(50);
      expect(latest).toBe(34);
    });
  });

  describe("isEpochAvailable", () => {
    it("should return true when epoch exists", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValueOnce(true);

      const available = await isEpochAvailable(34);
      expect(available).toBe(true);
    });

    it("should return false when epoch doesn't exist", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValueOnce(false);

      const available = await isEpochAvailable(999);
      expect(available).toBe(false);
    });

    it("should check snapshot by default", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValueOnce(true);

      await isEpochAvailable(34);
      expect(publicBucket.checkEpochExists).toHaveBeenCalledWith(
        34,
        "snapshot"
      );
    });

    it("should check isis-db when specified", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValueOnce(true);

      await isEpochAvailable(34, "isis-db");
      expect(publicBucket.checkEpochExists).toHaveBeenCalledWith(
        34,
        "isis-db"
      );
    });
  });

  describe("getAvailableEpochs", () => {
    it("should return list of available epochs in range", async () => {
      // Mock: epochs 32, 34, 36 exist in range 32-37
      (publicBucket.checkEpochExists as any).mockImplementation(
        async (epoch: number) => {
          return epoch === 32 || epoch === 34 || epoch === 36;
        }
      );

      const available = await getAvailableEpochs(32, 37);
      expect(available).toEqual([32, 34, 36]);
    });

    it("should return empty array when no epochs exist", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValue(false);

      const available = await getAvailableEpochs(32, 40);
      expect(available).toEqual([]);
    });

    it("should handle reversed range (endEpoch < startEpoch)", async () => {
      (publicBucket.checkEpochExists as any).mockImplementation(
        async (epoch: number) => {
          return epoch === 34;
        }
      );

      const available = await getAvailableEpochs(40, 32);
      expect(available).toEqual([34]);
    });

    it("should reject range larger than 50", async () => {
      await expect(getAvailableEpochs(1, 100)).rejects.toThrow(
        "Range too large"
      );
    });

    it("should accept range of exactly 50", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValue(false);

      const available = await getAvailableEpochs(1, 51);
      expect(available).toEqual([]);
    });

    it("should check correct file type", async () => {
      (publicBucket.checkEpochExists as any).mockResolvedValue(false);

      await getAvailableEpochs(32, 35, "isis-db");
      expect(publicBucket.checkEpochExists).toHaveBeenCalledWith(
        expect.any(Number),
        "isis-db"
      );
    });
  });
});
