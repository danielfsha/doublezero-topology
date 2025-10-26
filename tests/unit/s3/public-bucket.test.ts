/**
 * Unit tests for Public S3 Bucket Client
 *
 * Tests the public bucket access functionality using direct HTTPS URLs.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildS3Url,
  checkEpochExists,
  fetchFileFromS3,
  createS3Error,
  S3ErrorType,
  type FileType,
} from "@/lib/s3/public-bucket";

// Mock global fetch
global.fetch = vi.fn();

describe("Public S3 Bucket Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildS3Url", () => {
    it("should build correct URL for snapshot file", () => {
      const url = buildS3Url(34, "snapshot");
      expect(url).toBe(
        "https://doublezero-contributor-rewards-mn-beta-snapshots.s3.amazonaws.com/mn-epoch-34-snapshot.json"
      );
    });

    it("should build correct URL for isis-db file", () => {
      const url = buildS3Url(34, "isis-db");
      expect(url).toBe(
        "https://doublezero-contributor-rewards-mn-beta-snapshots.s3.amazonaws.com/mn-epoch-34-isis-db.json"
      );
    });

    it("should handle different epoch numbers", () => {
      const url = buildS3Url(100, "snapshot");
      expect(url).toContain("mn-epoch-100-snapshot.json");
    });

    it("should default to snapshot file type", () => {
      const url = buildS3Url(34);
      expect(url).toContain("snapshot.json");
    });
  });

  describe("checkEpochExists", () => {
    it("should return true when file exists (200 OK)", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const exists = await checkEpochExists(34);
      expect(exists).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("mn-epoch-34-snapshot.json"),
        expect.objectContaining({ method: "HEAD" })
      );
    });

    it("should return false when file not found (404)", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const exists = await checkEpochExists(999);
      expect(exists).toBe(false);
    });

    it("should return false on network error", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const exists = await checkEpochExists(34);
      expect(exists).toBe(false);
    });

    it("should check isis-db file when specified", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await checkEpochExists(34, "isis-db");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("isis-db.json"),
        expect.any(Object)
      );
    });
  });

  describe("fetchFileFromS3", () => {
    it("should successfully fetch and parse valid JSON", async () => {
      const mockData = { test: "data", epoch: 34 };
      const mockJson = JSON.stringify(mockData);
      const encoder = new TextEncoder();
      const mockBuffer = encoder.encode(mockJson);

      // Mock ReadableStream
      const mockStream = {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: mockBuffer,
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-length": mockBuffer.length.toString(),
        }),
        body: mockStream,
      });

      const result = await fetchFileFromS3(34);

      expect(result.success).toBe(true);
      expect(result.epoch).toBe(34);
      expect(result.data).toEqual(mockData);
      expect(result.source).toBe("s3");
      expect(result.size).toBe(mockBuffer.length);
    });

    it("should handle 404 errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await fetchFileFromS3(999);

      expect(result.success).toBe(false);
      expect(result.epoch).toBe(999);
      expect(result.error).toBe("NOT_FOUND");
    });

    it("should handle invalid JSON", async () => {
      const invalidJson = "{ invalid json }";
      const encoder = new TextEncoder();
      const mockBuffer = encoder.encode(invalidJson);

      const mockStream = {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: mockBuffer,
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-length": mockBuffer.length.toString(),
        }),
        body: mockStream,
      });

      const result = await fetchFileFromS3(34);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_JSON");
    });

    it("should call progress callback during download", async () => {
      const mockData = { test: "data" };
      const mockJson = JSON.stringify(mockData);
      const encoder = new TextEncoder();
      const mockBuffer = encoder.encode(mockJson);

      const mockStream = {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: mockBuffer,
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-length": mockBuffer.length.toString(),
        }),
        body: mockStream,
      });

      const progressCallback = vi.fn();
      await fetchFileFromS3(34, "snapshot", progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          bytesDownloaded: expect.any(Number),
          totalBytes: expect.any(Number),
          percentage: expect.any(Number),
        })
      );
    });

    it("should handle network errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network failed"));

      const result = await fetchFileFromS3(34);

      expect(result.success).toBe(false);
      expect(result.error).toBe("NETWORK_ERROR");
    });

    it("should support cancellation via AbortSignal", async () => {
      const controller = new AbortController();

      // Create a proper AbortError
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      (global.fetch as any).mockRejectedValueOnce(abortError);

      const result = await fetchFileFromS3(
        34,
        "snapshot",
        undefined,
        controller.signal
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("TIMEOUT");
    });
  });

  describe("createS3Error", () => {
    it("should create NOT_FOUND error with epoch", () => {
      const error = createS3Error("NOT_FOUND", 34);

      expect(error.type).toBe(S3ErrorType.NOT_FOUND);
      expect(error.message).toContain("Epoch 34");
      expect(error.suggestion).toBeTruthy();
    });

    it("should create TIMEOUT error", () => {
      const error = createS3Error("TIMEOUT");

      expect(error.type).toBe(S3ErrorType.TIMEOUT);
      expect(error.message).toContain("timed out");
      expect(error.suggestion).toContain("connection");
    });

    it("should create NETWORK_ERROR error", () => {
      const error = createS3Error("NETWORK_ERROR");

      expect(error.type).toBe(S3ErrorType.NETWORK_ERROR);
      expect(error.message).toContain("Network error");
    });

    it("should create INVALID_JSON error", () => {
      const error = createS3Error("INVALID_JSON");

      expect(error.type).toBe(S3ErrorType.INVALID_JSON);
      expect(error.message).toContain("invalid JSON");
    });

    it("should create STORAGE_FULL error", () => {
      const error = createS3Error("STORAGE_FULL");

      expect(error.type).toBe(S3ErrorType.STORAGE_FULL);
      expect(error.message).toContain("storage");
    });

    it("should create UNKNOWN error for unrecognized types", () => {
      const error = createS3Error("SOME_RANDOM_ERROR");

      expect(error.type).toBe(S3ErrorType.UNKNOWN);
      expect(error.message).toContain("unknown");
    });
  });
});
