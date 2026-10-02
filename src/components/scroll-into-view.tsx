"use client";

import { useEffect } from "react";

// Scrolls the element with the given id to the middle of the screen once on mount.
export function ScrollIntoView({ targetId }: { targetId: string }) {
  useEffect(() => {
    // Wait until Next.js has finished its own scroll-to-top after navigation.
    const timer = setTimeout(() => {
      // Instant jump: smooth scrolling across hundreds of rows is slow and
      // doesn't run at all in background tabs.
      document.getElementById(targetId)?.scrollIntoView({ block: "center" });
    }, 100);
    return () => clearTimeout(timer);
  }, [targetId]);
  return null;
}
