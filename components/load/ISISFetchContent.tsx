"use client";

/**
 * ISIS Fetch Content Component
 *
 * Content portion of S3 ISIS fetch (extracted for reuse in unified card).
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Cloud, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useTopology } from "@/contexts/TopologyContext";
import type { IsisData } from "@/lib/storage/snapshot-cache";

type FetchState = "idle" | "fetching" | "success" | "error";

export interface ISISFetchContentProps {
  onSuccess?: () => void;
}

export function ISISFetchContent({ onSuccess }: ISISFetchContentProps = {}) {
  const { setIsisData, isisData } = useTopology();
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [specificDate, setSpecificDate] = useState<string>("");

  const handleFetchLatest = async () => {
    setFetchState("fetching");
    setErrorMessage("");

    try {
      const response = await fetch("/api/s3/fetch-isis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch ISIS file");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch ISIS file");
      }

      const isis: IsisData = {
        data: result.data.isis,
        source: "s3",
        filename: result.data.filename,
        timestamp: Date.now(),
        size: result.data.size,
      };

      await setIsisData(isis);
      setFetchState("success");
      onSuccess?.();
    } catch (error) {
      setFetchState("error");
      const errorMsg =
        error instanceof Error ? error.message : "Failed to fetch ISIS file";
      setErrorMessage(errorMsg);
    }
  };

  const handleFetchSpecific = async () => {
    const datePattern = /^\d{4}\.\d{2}\.\d{2}$/;
    if (!datePattern.test(specificDate)) {
      setErrorMessage("Please enter a valid date in YYYY.MM.DD format (e.g., 2025.10.30)");
      setFetchState("error");
      return;
    }

    setFetchState("fetching");
    setErrorMessage("");

    try {
      const response = await fetch("/api/s3/fetch-isis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date: specificDate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch ISIS file");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch ISIS file");
      }

      const isis: IsisData = {
        data: result.data.isis,
        source: "s3",
        filename: result.data.filename,
        timestamp: Date.now(),
        size: result.data.size,
      };

      await setIsisData(isis);
      setFetchState("success");
      onSuccess?.();
    } catch (error) {
      setFetchState("error");
      const errorMsg =
        error instanceof Error ? error.message : "Failed to fetch ISIS file";
      setErrorMessage(errorMsg);
    }
  };

  const handleReset = () => {
    setFetchState("idle");
    setErrorMessage("");
    setSpecificDate("");
  };

  const isDisabled = fetchState === "fetching" || fetchState === "success";
  const hasIsis = !!isisData;

  return (
    <div className="space-y-6">
      {/* Already loaded indicator */}
      {hasIsis && fetchState === "idle" && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-400">
            IS-IS database already loaded. Fetching a new one will replace the current data.
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
          {fetchState === "fetching" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fetching Latest...
            </>
          ) : (
            <>
              <Cloud className="mr-2 h-4 w-4" />
              Fetch Latest IS-IS
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Automatically downloads the latest IS-IS database from S3
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

      {/* Specific Date Input */}
      <div className="space-y-2">
        <Label htmlFor="specific-date-unified">Specific Date</Label>
        <div className="flex gap-2">
          <Input
            id="specific-date-unified"
            type="text"
            placeholder="YYYY.MM.DD"
            value={specificDate}
            onChange={(e) => setSpecificDate(e.target.value)}
            disabled={isDisabled}
            className="flex-1"
          />
          <Button
            onClick={handleFetchSpecific}
            disabled={isDisabled || !specificDate}
            variant="outline"
          >
            Fetch
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter a date in YYYY.MM.DD format (e.g., 2025.10.30)
        </p>
      </div>

      {/* Success Message */}
      {fetchState === "success" && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-400">
            IS-IS database fetched successfully!
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
