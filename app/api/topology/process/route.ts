/**
 * Topology Processing API Route (v2)
 *
 * POST /api/topology/process
 *
 * Processes topology data from separate snapshot and ISIS sources.
 * Supports mix-and-match (e.g., S3 snapshot + manual ISIS upload).
 *
 * Body: {
 *   snapshot: SnapshotData,
 *   isis: IsisData
 * }
 */

import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import type { SnapshotData, IsisData } from "@/lib/storage/snapshot-cache";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  logger.info("Topology processing request received");

  try {
    const body = await request.json();
    const { snapshot, isis } = body;

    // Validate inputs
    if (!snapshot || !isis) {
      logger.warn("Processing validation failed: missing snapshot or ISIS");
      return Response.json(
        { success: false, error: "Both snapshot and ISIS data are required" },
        { status: 400 },
      );
    }

    // Validate snapshot structure
    const snapshotData = snapshot as SnapshotData;
    if (!snapshotData.data || !snapshotData.source) {
      return Response.json(
        { success: false, error: "Invalid snapshot data structure" },
        { status: 400 },
      );
    }

    // Validate ISIS structure
    const isisData = isis as IsisData;
    if (!isisData.data || !isisData.source) {
      return Response.json(
        { success: false, error: "Invalid ISIS data structure" },
        { status: 400 },
      );
    }

    logger.info("Processing topology", {
      snapshotSource: snapshotData.source,
      snapshotEpoch: snapshotData.epoch,
      isisSource: isisData.source,
      isisFilename: isisData.filename,
    });

    // Import processor
    const { processTopologyData } = await import("../processor");

    // Process topology
    const result = await processTopologyData(snapshotData.data, isisData.data);

    const processingTime = Date.now() - startTime;
    logger.info("Topology processing complete", {
      totalLinks: result.summary.total_links,
      healthy: result.summary.healthy,
      driftHigh: result.summary.drift_high,
      missingIsis: result.summary.missing_isis,
      missingTelemetry: result.summary.missing_telemetry,
      processingTimeMs: processingTime,
      snapshotSource: snapshotData.source,
      isisSource: isisData.source,
    });

    return Response.json({
      success: true,
      data: {
        topology: result.topology,
        locations: result.locations,
        summary: result.summary,
        processedAt: new Date().toISOString(),
        sources: {
          snapshot: {
            source: snapshotData.source,
            epoch: snapshotData.epoch,
            filename: snapshotData.filename,
          },
          isis: {
            source: isisData.source,
            filename: isisData.filename,
          },
        },
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error("Topology processing failed", {
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: processingTime,
    });

    const message =
      error instanceof Error ? error.message : "Internal server error";

    return Response.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
