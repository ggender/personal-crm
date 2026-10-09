"use client";

import { useEffect } from "react";

/**
 * Scrolls a sideways row so that its selected link (aria-current) sits in view, once after the
 * first render: with many groups the chosen one could be hidden behind the screen edge.
 */
export function ScrollRowToSelected({ rowId }: { rowId: string }) {
  useEffect(() => {
    const row = document.getElementById(rowId);
    const selected = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !selected) return;
    const target = selected.offsetLeft - (row.clientWidth - selected.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, target) });
  }, [rowId]);
  return null;
}
