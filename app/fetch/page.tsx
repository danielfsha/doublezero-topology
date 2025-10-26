"use client";

/**
 * Fetch Page Redirect (v3)
 *
 * Redirects to unified /load page.
 * This page is deprecated in favor of /load.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FetchPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/load");
  }, [router]);

  return (
    <div className="container mx-auto py-16 text-center">
      <p className="text-muted-foreground">Redirecting to Load Data page...</p>
    </div>
  );
}
