"use client";

import { useEffect } from "react";

/** Scrolls the element with the given id to the middle of the screen once, after render. */
export function ScrollIntoView({ targetId }: { targetId: string }) {
  useEffect(() => {
    document.getElementById(targetId)?.scrollIntoView({ block: "center" });
  }, [targetId]);
  return null;
}
