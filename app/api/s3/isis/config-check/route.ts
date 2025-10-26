/**
 * ISIS S3 Configuration Check API Route
 *
 * GET /api/s3/isis/config-check
 *
 * Returns whether ISIS S3 bucket is properly configured with credentials.
 * Used by frontend to show/hide ISIS S3 fetch functionality.
 */

export async function GET() {
  const configured = !!(
    process.env.S3_ISIS_BUCKET &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );

  return Response.json({ configured });
}
