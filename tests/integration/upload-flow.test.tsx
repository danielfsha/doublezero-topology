/**
 * Home Page Integration Tests (v5 - Modal-based Design)
 *
 * Tests the end-to-end flow from file upload to topology processing on the home page.
 *
 * v5 Implementation:
 * - Home page (/) with side-by-side cards
 * - S3 and Upload buttons both visible (no tabs)
 * - Modals for S3 fetch and manual upload
 * - Manual upload: POST to /api/upload/snapshot and /api/upload/isis
 * - Both stored in TopologyContext separately
 * - Auto-processing when both files are ready
 * - No S3 or external storage involved in manual upload flow
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import HomePage from "@/app/page";
import { TopologyProvider } from "@/contexts/TopologyContext";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock fetch for upload API
global.fetch = vi.fn();

describe("Home Page Integration (v5 - Modal Design)", () => {
  const mockPush = vi.fn();
  const mockPrefetch = vi.fn();
  const mockFetch = vi.mocked(fetch);

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear sessionStorage to prevent data leaking between tests
    sessionStorage.clear();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: mockPrefetch,
    } as any);
  });

  it("should successfully upload both files via modals", async () => {
    const user = userEvent.setup();

    // Mock snapshot upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          snapshot: { test: "snapshot-data" },
          filename: "snapshot.json",
          size: 100,
          timestamp: Date.now(),
          source: "upload",
        },
      }),
    } as Response);

    // Mock ISIS upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          isis: { test: "isis-data" },
          filename: "isis-db.json",
          size: 50,
          timestamp: Date.now(),
          source: "upload",
        },
      }),
    } as Response);

    // Mock topology processing
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          topology: [],
          locations: [],
          summary: {
            total_links: 88,
            healthy: 77,
            drift_high: 10,
            missing_telemetry: 0,
            missing_isis: 1,
          },
          processedAt: new Date().toISOString(),
          sources: {
            snapshot: { source: "upload", filename: "snapshot.json" },
            isis: { source: "upload", filename: "isis-db.json" },
          },
        },
      }),
    } as Response);

    // Render home page
    render(
      <TopologyProvider>
        <HomePage />
      </TopologyProvider>
    );

    // Click Upload button on Snapshot card to open modal
    const snapshotUploadButtons = screen.getAllByRole("button", { name: /Upload/i });
    // First Upload button is for Snapshot card
    await user.click(snapshotUploadButtons[0]);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText(/Upload Snapshot File/i)).toBeInTheDocument();
    });

    // Find file input in modal (rendered in portal)
    const snapshotInput = document.querySelector("#snapshot-upload-unified") as HTMLInputElement;
    expect(snapshotInput).toBeTruthy();

    // Create and upload snapshot file
    const snapshotFile = new File(['{"test": "snapshot-data"}'], "snapshot.json", {
      type: "application/json",
    });
    await user.upload(snapshotInput, snapshotFile);

    // Click "Upload Snapshot" button in modal
    const uploadSnapshotButton = screen.getByRole("button", { name: /Upload Snapshot/i });
    await user.click(uploadSnapshotButton);

    // Wait for snapshot upload to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/upload/snapshot", {
        method: "POST",
        body: expect.any(FormData),
      });
    });

    // Wait for modal to close and card to show file is loaded
    await waitFor(() => {
      expect(screen.queryByText(/Upload Snapshot File/i)).not.toBeInTheDocument();
    });

    // Verify "Loaded" badge appears on card
    await waitFor(() => {
      expect(screen.getByText(/Loaded/i)).toBeInTheDocument();
    });

    // Click Upload button on ISIS card to open modal
    const isisUploadButtons = screen.getAllByRole("button", { name: /Upload/i });
    // Second Upload button is for ISIS card (or find by Re-upload if snapshot is loaded)
    const isisUploadButton = isisUploadButtons.find(btn =>
      btn.textContent?.includes("Upload") && !btn.textContent?.includes("Snapshot")
    ) || isisUploadButtons[1];
    await user.click(isisUploadButton);

    // Wait for ISIS modal to open
    await waitFor(() => {
      expect(screen.getByText(/Upload IS-IS Database File/i)).toBeInTheDocument();
    });

    // Find ISIS file input in modal (rendered in portal)
    const isisInput = document.querySelector("#isis-upload-unified") as HTMLInputElement;
    expect(isisInput).toBeTruthy();

    // Create and upload ISIS file
    const isisFile = new File(['{"test": "isis-data"}'], "isis-db.json", {
      type: "application/json",
    });
    await user.upload(isisInput, isisFile);

    // Click "Upload IS-IS Database" button in modal
    const uploadIsisButton = screen.getByRole("button", { name: /Upload IS-IS Database/i });
    await user.click(uploadIsisButton);

    // Wait for ISIS upload to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/upload/isis", {
        method: "POST",
        body: expect.any(FormData),
      });
    });

    // Auto-processing should trigger automatically
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith("/api/topology/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.any(String),
        });
      },
      { timeout: 3000 }
    );

    // Verify success message appears
    await waitFor(() => {
      expect(screen.getByText(/Topology processed successfully/i)).toBeInTheDocument();
    });
  });

  it("should handle snapshot upload errors", async () => {
    const user = userEvent.setup();

    // Mock snapshot upload error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: "Invalid JSON structure",
      }),
    } as Response);

    render(
      <TopologyProvider>
        <HomePage />
      </TopologyProvider>
    );

    // Click Upload button on Snapshot card
    const uploadButtons = screen.getAllByRole("button", { name: /Upload/i });
    await user.click(uploadButtons[0]);

    // Wait for modal
    await waitFor(() => {
      expect(screen.getByText(/Upload Snapshot File/i)).toBeInTheDocument();
    });

    // Upload file
    const snapshotInput = document.querySelector("#snapshot-upload-unified") as HTMLInputElement;
    const snapshotFile = new File(['{"test": "data"}'], "snapshot.json", {
      type: "application/json",
    });
    await user.upload(snapshotInput, snapshotFile);

    // Click upload button
    const uploadButton = screen.getByRole("button", { name: /Upload Snapshot/i });
    await user.click(uploadButton);

    // Wait for upload API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/upload/snapshot", {
        method: "POST",
        body: expect.any(FormData),
      });
    });

    // Verify error message appears in modal (modal stays open on error)
    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON structure/i)).toBeInTheDocument();
    });
  });

  it("should handle ISIS upload errors", async () => {
    const user = userEvent.setup();

    // Mock successful snapshot upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          snapshot: { test: "snapshot-data" },
          filename: "snapshot.json",
          size: 100,
          timestamp: Date.now(),
          source: "upload",
        },
      }),
    } as Response);

    // Mock ISIS upload error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: "Invalid ISIS structure",
      }),
    } as Response);

    render(
      <TopologyProvider>
        <HomePage />
      </TopologyProvider>
    );

    // Upload snapshot first
    const uploadButtons = screen.getAllByRole("button", { name: /Upload/i });
    await user.click(uploadButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Upload Snapshot File/i)).toBeInTheDocument();
    });

    const snapshotInput = document.querySelector("#snapshot-upload-unified") as HTMLInputElement;
    const snapshotFile = new File(['{"test": "snapshot-data"}'], "snapshot.json", {
      type: "application/json",
    });
    await user.upload(snapshotInput, snapshotFile);

    const uploadSnapshotButton = screen.getByRole("button", { name: /Upload Snapshot/i });
    await user.click(uploadSnapshotButton);

    // Wait for modal to close after successful upload
    await waitFor(() => {
      expect(screen.queryByText(/Upload Snapshot File/i)).not.toBeInTheDocument();
    });

    // Now upload ISIS with error
    const isisUploadButtons = screen.getAllByRole("button", { name: /Upload/i });
    // Click the Upload/Re-upload button on ISIS card
    await user.click(isisUploadButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/Upload IS-IS Database File/i)).toBeInTheDocument();
    });

    const isisInput = document.querySelector("#isis-upload-unified") as HTMLInputElement;
    const isisFile = new File(['{"test": "isis-data"}'], "isis-db.json", {
      type: "application/json",
    });
    await user.upload(isisInput, isisFile);

    const uploadIsisButton = screen.getByRole("button", { name: /Upload IS-IS Database/i });
    await user.click(uploadIsisButton);

    // Wait for API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/upload/isis", expect.any(Object));
    });

    // Verify error message appears in modal
    await waitFor(() => {
      expect(screen.getByText(/Invalid ISIS structure/i)).toBeInTheDocument();
    });
  });

  it("should handle topology processing errors", async () => {
    const user = userEvent.setup();

    // Mock successful uploads
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          snapshot: { test: "snapshot-data" },
          filename: "snapshot.json",
          size: 100,
          timestamp: Date.now(),
          source: "upload",
        },
      }),
    } as Response);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          isis: { test: "isis-data" },
          filename: "isis-db.json",
          size: 50,
          timestamp: Date.now(),
          source: "upload",
        },
      }),
    } as Response);

    // Mock processing error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: "Failed to process topology",
      }),
    } as Response);

    render(
      <TopologyProvider>
        <HomePage />
      </TopologyProvider>
    );

    // Upload both files
    const uploadButtons = screen.getAllByRole("button", { name: /Upload/i });

    // Snapshot
    await user.click(uploadButtons[0]);
    await waitFor(() => screen.getByText(/Upload Snapshot File/i));
    const snapshotInput = document.querySelector("#snapshot-upload-unified") as HTMLInputElement;
    await user.upload(snapshotInput, new File(['{"test": "data"}'], "snapshot.json", { type: "application/json" }));
    await user.click(screen.getByRole("button", { name: /Upload Snapshot/i }));
    // Wait for modal to close
    await waitFor(() => expect(screen.queryByText(/Upload Snapshot File/i)).not.toBeInTheDocument());

    // ISIS
    const isisButtons = screen.getAllByRole("button", { name: /Upload/i });
    await user.click(isisButtons[1]);
    await waitFor(() => screen.getByText(/Upload IS-IS Database File/i));
    const isisInput = document.querySelector("#isis-upload-unified") as HTMLInputElement;
    await user.upload(isisInput, new File(['{"test": "data"}'], "isis-db.json", { type: "application/json" }));
    await user.click(screen.getByRole("button", { name: /Upload IS-IS Database/i }));
    // Wait for modal to close
    await waitFor(() => expect(screen.queryByText(/Upload IS-IS Database File/i)).not.toBeInTheDocument());

    // Wait for auto-processing to be called (will fail with mocked error)
    await waitFor(
      () => {
        expect(mockFetch).toHaveBeenCalledWith("/api/topology/process", expect.any(Object));
      },
      { timeout: 3000 }
    );

    // Note: Error handling for processing happens in TopologyContext
    // Processing errors are logged to console but may not be displayed in UI
  });

  it("should display loaded file info in cards", async () => {
    const user = userEvent.setup();

    // Mock successful snapshot upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          snapshot: { test: "snapshot-data" },
          filename: "snapshot.json",
          size: 100,
          timestamp: Date.now(),
          source: "upload",
        },
      }),
    } as Response);

    render(
      <TopologyProvider>
        <HomePage />
      </TopologyProvider>
    );

    // Upload snapshot
    const uploadButtons = screen.getAllByRole("button", { name: /Upload/i });
    await user.click(uploadButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Upload Snapshot File/i)).toBeInTheDocument();
    });

    const snapshotInput = document.querySelector("#snapshot-upload-unified") as HTMLInputElement;
    const snapshotFile = new File(['{"test": "data"}'], "snapshot.json", {
      type: "application/json",
    });
    await user.upload(snapshotInput, snapshotFile);

    const uploadButton = screen.getByRole("button", { name: /Upload Snapshot/i });
    await user.click(uploadButton);

    // Wait for upload to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/upload/snapshot", expect.any(Object));
    });

    // Wait for modal to close
    await waitFor(() => {
      expect(screen.queryByText(/Upload Snapshot File/i)).not.toBeInTheDocument();
    });

    // Verify "Loaded" badge appears in card
    await waitFor(() => {
      expect(screen.getByText(/Loaded/i)).toBeInTheDocument();
    });

    // Verify filename is displayed in card (file info section)
    expect(screen.getByText("snapshot.json")).toBeInTheDocument();
  });
});
