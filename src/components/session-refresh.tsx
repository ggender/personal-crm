"use client";

import { useEffect } from "react";

/**
 * Renews the login on every visit. A page is drawn by the server, which cannot set cookies, so the
 * browser asks Better Auth itself: when the last renewal was over a day ago, it moves the end of
 * the login 30 days ahead, in the database and in the cookie. Nothing is shown.
 */
export function SessionRefresh() {
  useEffect(() => {
    fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" }).catch(() => {
      // Offline or the server is restarting: the next visit renews the login.
    });
  }, []);
  return null;
}
