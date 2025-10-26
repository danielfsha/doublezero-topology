/**
 * ISIS S3 Fetch API Route
 *
 * Server-side route to fetch ISIS database from private S3 bucket.
 * Requires AWS credentials in environment variables.
 *
 * POST /api/s3/fetch-isis
 * Body: { mode: 'latest' } | { mode: 'specific', date: 'YYYY.MM.DD' }
 */

import { NextRequest } from "next/server";
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { logger } from "@/lib/logger";

/**
 * Check if ISIS S3 bucket is configured
 */
function isConfigured(): boolean {
  return !!(
    process.env.S3_ISIS_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );
}

/**
 * Create S3 client with credentials from environment
 */
function createS3Client(): S3Client {
  if (!isConfigured()) {
    throw new Error("ISIS S3 bucket not configured in environment variables");
  }

  return new S3Client({
    region: process.env.S3_ISIS_REGION || "us-west-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Find latest ISIS file in bucket
 */
async function findLatestIsisFile(
  s3Client: S3Client,
  bucket: string,
): Promise<string> {
  logger.info("Listing ISIS files in bucket", { bucket });

  const listCommand = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: "isis-db-",
  });

  const listResponse = await s3Client.send(listCommand);
  const files = (listResponse.Contents || [])
    .map((obj) => obj.Key)
    .filter((key) => key && key.endsWith(".json"))
    .sort()
    .reverse(); // Latest first (YYYY.MM.DD sorts correctly)

  if (files.length === 0) {
    throw new Error("No ISIS files found in bucket");
  }

  logger.info("Found ISIS files", { count: files.length, latest: files[0] });
  return files[0]!;
}

/**
 * Fetch ISIS file from S3
 */
async function fetchIsisFile(
  s3Client: S3Client,
  bucket: string,
  filename: string,
): Promise<any> {
  logger.info("Fetching ISIS file from S3", { bucket, filename });

  const getCommand = new GetObjectCommand({
    Bucket: bucket,
    Key: filename,
  });

  const response = await s3Client.send(getCommand);
  const body = await response.Body?.transformToString();

  if (!body) {
    throw new Error("Empty response from S3");
  }

  const isis = JSON.parse(body);
  logger.info("ISIS file fetched successfully", {
    filename,
    size: body.length,
  });

  return isis;
}

/**
 * POST /api/s3/fetch-isis
 *
 * Fetch ISIS database from private S3 bucket
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if ISIS S3 is configured
    if (!isConfigured()) {
      logger.warn("ISIS S3 bucket not configured");
      return Response.json(
        {
          success: false,
          error: "ISIS S3 bucket not configured in environment variables",
        },
        { status: 500 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { mode, date } = body;

    if (!mode || (mode !== "latest" && mode !== "specific")) {
      return Response.json(
        { success: false, error: "Invalid mode. Must be 'latest' or 'specific'" },
        { status: 400 },
      );
    }

    if (mode === "specific" && !date) {
      return Response.json(
        { success: false, error: "Date required for mode 'specific'" },
        { status: 400 },
      );
    }

    // Create S3 client
    const s3Client = createS3Client();
    const bucket = process.env.S3_ISIS_BUCKET!;

    // Determine filename
    let filename: string;
    if (mode === "latest") {
      filename = await findLatestIsisFile(s3Client, bucket);
    } else {
      filename = `isis-db-${date}.json`;
    }

    // Fetch ISIS file
    const isis = await fetchIsisFile(s3Client, bucket, filename);

    const processingTime = Date.now() - startTime;
    logger.info("ISIS fetch complete", { filename, processingTimeMs: processingTime });

    return Response.json({
      success: true,
      data: {
        isis,
        filename,
        timestamp: Date.now(),
        size: JSON.stringify(isis).length,
        source: "s3",
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error("ISIS fetch failed", {
      error: error instanceof Error ? error.message : String(error),
      processingTimeMs: processingTime,
    });

    const message =
      error instanceof Error ? error.message : "Failed to fetch ISIS from S3";

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
