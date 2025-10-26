/**
 * Snapshot Upload API Route
 *
 * POST /api/upload/snapshot
 *
 * Accepts a snapshot JSON file upload and returns parsed data.
 */

import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.info("Snapshot upload request received");

  try {
    const formData = await request.formData();
    const file = formData.get("snapshot") as File | null;

    if (!file) {
      logger.warn("Upload validation failed: no snapshot file");
      return Response.json(
        { success: false, error: "Snapshot file is required" },
        { status: 400 },
      );
    }

    // Validate file type
    if (!file.name.endsWith(".json")) {
      return Response.json(
        { success: false, error: "Snapshot must be a JSON file" },
        { status: 400 },
      );
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return Response.json(
        {
          success: false,
          error: `Snapshot file too large. Max size: ${maxSize / (1024 * 1024)}MB`,
        },
        { status: 400 },
      );
    }

    logger.info("Processing snapshot upload", {
      filename: file.name,
      size: file.size,
    });

    // Read and parse file
    const text = await file.text();
    const snapshot = JSON.parse(text);

    const processingTime = Date.now() - startTime;
    logger.info("Snapshot upload complete", {
      filename: file.name,
      size: file.size,
      processingTimeMs: processingTime,
    });

    return Response.json({
      success: true,
      data: {
        snapshot,
        filename: file.name,
        size: file.size,
        timestamp: Date.now(),
        source: "upload",
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error("Snapshot upload failed", {
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: processingTime,
    });

    const message =
      error instanceof Error ? error.message : "Failed to upload snapshot";

    return Response.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
