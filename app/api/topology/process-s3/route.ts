/**
 * S3 Topology Processing API Route
 *
 * Processes topology data fetched from S3.
 * Note: Currently only processes snapshot data (ISIS-DB not yet available in S3).
 */

import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.info("S3 topology processing request received");

  try {
    const body = await request.json();
    const { snapshot, epoch } = body;

    // Validate snapshot exists
    if (!snapshot) {
      logger.warn("S3 processing validation failed: missing snapshot");
      return Response.json(
        { success: false, error: "Snapshot data is required" },
        { status: 400 }
      );
    }

    logger.info("Processing S3 snapshot", { epoch });

    // For now, we'll create a minimal ISIS data structure since it's not available in S3 yet
    // This will be updated when ISIS-DB is added to S3
    const minimalIsisData = {
      vrfs: {
        default: {
          isisInstances: {
            "1": {
              level: {
                "2": {
                  lsps: {},
                },
              },
            },
          },
        },
      },
    };

    // Process topology data using the same logic as upload
    logger.info("Starting topology processing");
    const { processTopologyData } = await import("../processor");

    const result = await processTopologyData(snapshot, minimalIsisData);

    const processingTime = Date.now() - startTime;
    logger.info("S3 processing complete", {
      epoch,
      totalLinks: result.summary.total_links,
      healthy: result.summary.healthy,
      driftHigh: result.summary.drift_high,
      missingIsis: result.summary.missing_isis,
      missingTelemetry: result.summary.missing_telemetry,
      processingTimeMs: processingTime,
    });

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error("S3 processing failed", {
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: processingTime,
    });
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
