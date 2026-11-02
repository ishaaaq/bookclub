"use client";

import { useEffect } from "react";

/** Registers public/sw.js in production builds (it would fight hot reload in dev). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not fatal: the app works without it, just not offline.
    });
  }, []);
  return null;
}
