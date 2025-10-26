"use client";

/**
 * Snapshot Fetch Content Component
 *
 * Content portion of S3 snapshot fetch (extracted for reuse in unified card).
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cloud, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useTopology } from "@/contexts/TopologyContext";
import { detectLatestEpoch } from "@/lib/s3/epoch-detector";
import { fetchFileFromS3, createS3Error } from "@/lib/s3/public-bucket";
import type { DownloadProgress } from "@/lib/s3/public-bucket";
import type { SnapshotData } from "@/lib/storage/snapshot-cache";

type FetchState = "idle" | "detecting" | "downloading" | "success" | "error";

export interface SnapshotFetchContentProps {
  onSuccess?: () => void;
}

export function SnapshotFetchContent({ onSuccess }: SnapshotFetchContentProps = {}) {
  const { setSnapshotData, snapshotData } = useTopology();
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState<number | null>(null);
  const [specificEpoch, setSpecificEpoch] = useState<string>("");

  const handleFetchLatest = async () => {
    setFetchState("detecting");
    setErrorMessage("");
    setDownloadProgress(0);

    try {
      const latestEpoch = await detectLatestEpoch();

      if (latestEpoch === null) {
        throw new Error("No epochs found in S3 bucket");
      }

      setCurrentEpoch(latestEpoch);
      setFetchState("downloading");

      const result = await fetchFileFromS3(
        latestEpoch,
        "snapshot",
        (progress: DownloadProgress) => {
          setDownloadProgress(progress.percentage);
        }
      );

      if (!result.success) {
        const error = createS3Error(result.error || "UNKNOWN", latestEpoch);
        throw new Error(error.message + " " + error.suggestion);
      }

      const snapshot: SnapshotData = {
        data: result.data,
        source: "s3",
        epoch: latestEpoch,
        timestamp: Date.now(),
        size: result.size || 0,
        filename: `mn-epoch-${latestEpoch}-snapshot.json`,
      };

      await setSnapshotData(snapshot);
      setFetchState("success");
      onSuccess?.();
    } catch (error) {
      setFetchState("error");
      const errorMsg =
        error instanceof Error ? error.message : "Failed to fetch snapshot";
      setErrorMessage(errorMsg);
    }
  };

  const handleFetchSpecific = async () => {
    const epoch = parseInt(specificEpoch, 10);

    if (isNaN(epoch) || epoch < 32 || epoch > 999) {
      setErrorMessage("Please enter a valid epoch number between 32 and 999");
      setFetchState("error");
      return;
    }

    setFetchState("downloading");
    setErrorMessage("");
    setDownloadProgress(0);
    setCurrentEpoch(epoch);

    try {
      const result = await fetchFileFromS3(
        epoch,
        "snapshot",
        (progress: DownloadProgress) => {
          setDownloadProgress(progress.percentage);
        }
      );

      if (!result.success) {
        const error = createS3Error(result.error || "UNKNOWN", epoch);
        throw new Error(error.message + " " + error.suggestion);
      }

      const snapshot: SnapshotData = {
        data: result.data,
        source: "s3",
        epoch: epoch,
        timestamp: Date.now(),
        size: result.size || 0,
        filename: `mn-epoch-${epoch}-snapshot.json`,
      };

      await setSnapshotData(snapshot);
      setFetchState("success");
      onSuccess?.();
    } catch (error) {
      setFetchState("error");
      const errorMsg =
        error instanceof Error ? error.message : "Failed to fetch snapshot";
      setErrorMessage(errorMsg);
    }
  };

  const handleReset = () => {
    setFetchState("idle");
    setErrorMessage("");
    setDownloadProgress(0);
    setCurrentEpoch(null);
    setSpecificEpoch("");
  };

  const isDisabled =
    fetchState === "detecting" ||
    fetchState === "downloading" ||
    fetchState === "success";

  const hasSnapshot = !!snapshotData;

  return (
    <div className="space-y-6">
      {/* Already loaded indicator */}
      {hasSnapshot && fetchState === "idle" && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-400">
            Snapshot already loaded. Fetching a new one will replace the current data.
          </AlertDescription>
        </Alert>
      )}

      {/* Fetch Latest Button */}
      <div className="space-y-2">
        <Button
          onClick={handleFetchLatest}
          disabled={isDisabled}
          className="w-full"
          size="lg"
        >
          {fetchState === "detecting" && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Detecting Latest Epoch...
            </>
          )}
          {fetchState === "downloading" && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Downloading Epoch {currentEpoch}...
            </>
          )}
          {fetchState !== "detecting" && fetchState !== "downloading" && (
            <>
              <Cloud className="mr-2 h-4 w-4" />
              Fetch Latest Snapshot
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Automatically detects and downloads the latest available epoch
        </p>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* Specific Epoch Input */}
      <div className="space-y-2">
        <Label htmlFor="specific-epoch-unified">Specific Epoch Number</Label>
        <div className="flex gap-2">
          <Input
            id="specific-epoch-unified"
            type="number"
            min={32}
            max={999}
            placeholder="e.g., 34"
            value={specificEpoch}
            onChange={(e) => setSpecificEpoch(e.target.value)}
            disabled={isDisabled}
            className="w-32"
          />
          <Button
            onClick={handleFetchSpecific}
            disabled={isDisabled || !specificEpoch}
            variant="outline"
            className="flex-1"
          >
            Fetch Epoch {specificEpoch || "..."}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter an epoch number between 32 and 999
        </p>
      </div>

      {/* Progress Bar */}
      {(fetchState === "downloading" || fetchState === "detecting") && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              {fetchState === "detecting" ? "Detecting..." : "Downloading..."}
            </span>
            <span>{Math.round(downloadProgress)}%</span>
          </div>
          <Progress value={downloadProgress} className="w-full" />
          {downloadProgress > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              Downloading epoch {currentEpoch} snapshot from S3
            </p>
          )}
        </div>
      )}

      {/* Success Message */}
      {fetchState === "success" && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-400">
            Epoch {currentEpoch} fetched successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {fetchState === "error" && errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Reset Button */}
      <div className="pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isDisabled}
          className="w-full"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
