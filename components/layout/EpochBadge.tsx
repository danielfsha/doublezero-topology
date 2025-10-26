"use client";

/**
 * Epoch Badge Component (v2 - Temporary Fix)
 *
 * Displays the current epoch number in the navbar.
 * TODO: Full v2 implementation with mixed sources support
 */

import { Badge } from "@/components/ui/badge";
import { useTopology } from "@/contexts/TopologyContext";
import { Cloud, Upload } from "lucide-react";

export function EpochBadge() {
  const { snapshotData } = useTopology();

  if (!snapshotData) {
    return null; // Don't show badge if no snapshot loaded
  }

  const { epoch, source } = snapshotData;

  return (
    <Badge
      variant="outline"
      className={
        source === "s3"
          ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-400"
          : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-950 dark:text-yellow-400"
      }
    >
      {source === "s3" && <Cloud className="mr-1 h-3 w-3" />}
      {source === "upload" && <Upload className="mr-1 h-3 w-3" />}
      {epoch !== null ? `Epoch ${epoch}` : "No Epoch"}
    </Badge>
  );
}
