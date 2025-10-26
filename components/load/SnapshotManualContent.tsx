"use client";

/**
 * Snapshot Manual Upload Content Component
 *
 * Content portion of manual snapshot upload (extracted for reuse in unified card).
 */

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle2, AlertCircle, FileJson } from "lucide-react";
import { useTopology } from "@/contexts/TopologyContext";
import type { SnapshotData } from "@/lib/storage/snapshot-cache";

type UploadState = "idle" | "uploading" | "success" | "error";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export interface SnapshotManualContentProps {
  onSuccess?: () => void;
}

export function SnapshotManualContent({ onSuccess }: SnapshotManualContentProps = {}) {
  const { setSnapshotData, snapshotData } = useTopology();
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setErrorMessage("Please select a JSON file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `File too large. Max size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
    setUploadState("idle");
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState("uploading");
    setErrorMessage("");
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const formData = new FormData();
      formData.append("snapshot", selectedFile);

      const response = await fetch("/api/upload/snapshot", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Upload failed");
      }

      const epochMatch = selectedFile.name.match(/epoch-(\d+)/);
      const epoch = epochMatch ? parseInt(epochMatch[1], 10) : null;

      const snapshot: SnapshotData = {
        data: result.data.snapshot,
        source: "upload",
        epoch,
        timestamp: Date.now(),
        size: selectedFile.size,
        filename: selectedFile.name,
      };

      await setSnapshotData(snapshot);
      setUploadState("success");
      onSuccess?.();
    } catch (error) {
      setUploadState("error");
      const errorMsg =
        error instanceof Error ? error.message : "Upload failed";
      setErrorMessage(errorMsg);
    }
  };

  const handleReset = () => {
    setUploadState("idle");
    setErrorMessage("");
    setUploadProgress(0);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isDisabled = uploadState === "uploading" || uploadState === "success";
  const hasSnapshot = !!snapshotData;

  return (
    <div className="space-y-6">
      {/* Already loaded indicator */}
      {hasSnapshot && uploadState === "idle" && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-400">
            Snapshot already loaded. Uploading a new one will replace the current data.
          </AlertDescription>
        </Alert>
      )}

      {/* File Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-center w-full">
          <label
            htmlFor="snapshot-upload-unified"
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors ${
              selectedFile
                ? "border-primary bg-primary/5"
                : "border-border bg-background"
            } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {selectedFile ? (
                <>
                  <FileJson className="w-10 h-10 mb-3 text-primary" />
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </>
              ) : (
                <>
                  <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JSON file (max {MAX_FILE_SIZE / (1024 * 1024)}MB)
                  </p>
                </>
              )}
            </div>
            <input
              id="snapshot-upload-unified"
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".json"
              onChange={handleFileSelect}
              disabled={isDisabled}
            />
          </label>
        </div>
      </div>

      {/* Upload Button */}
      {selectedFile && uploadState === "idle" && (
        <Button
          onClick={handleUpload}
          disabled={isDisabled}
          className="w-full"
          size="lg"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload Snapshot
        </Button>
      )}

      {/* Progress Bar */}
      {uploadState === "uploading" && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Uploading...</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-xs text-muted-foreground text-center">
            Processing {selectedFile?.name}
          </p>
        </div>
      )}

      {/* Success Message */}
      {uploadState === "success" && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-400">
            Snapshot uploaded successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {uploadState === "error" && errorMessage && (
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
          disabled={uploadState === "uploading" || uploadState === "success"}
          className="w-full"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
