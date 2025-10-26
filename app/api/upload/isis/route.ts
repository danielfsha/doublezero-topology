/**
 * ISIS Upload API Route
 *
 * POST /api/upload/isis
 *
 * Accepts an ISIS database JSON file upload and returns parsed data.
 */

import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.info("ISIS upload request received");

  try {
    const formData = await request.formData();
    const file = formData.get("isis") as File | null;

    if (!file) {
      logger.warn("Upload validation failed: no ISIS file");
      return Response.json(
        { success: false, error: "ISIS file is required" },
        { status: 400 },
      );
    }

    // Validate file type
    if (!file.name.endsWith(".json")) {
      return Response.json(
        { success: false, error: "ISIS file must be a JSON file" },
        { status: 400 },
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return Response.json(
        {
          success: false,
          error: `ISIS file too large. Max size: ${maxSize / (1024 * 1024)}MB`,
        },
        { status: 400 },
      );
    }

    logger.info("Processing ISIS upload", {
      filename: file.name,
      size: file.size,
    });

    // Read and parse file
    const text = await file.text();
    const isis = JSON.parse(text);

    const processingTime = Date.now() - startTime;
    logger.info("ISIS upload complete", {
      filename: file.name,
      size: file.size,
      processingTimeMs: processingTime,
    });

    return Response.json({
      success: true,
      data: {
        isis,
        filename: file.name,
        size: file.size,
        timestamp: Date.now(),
        source: "upload",
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error("ISIS upload failed", {
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: processingTime,
    });

    const message =
      error instanceof Error ? error.message : "Failed to upload ISIS";

    return Response.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
