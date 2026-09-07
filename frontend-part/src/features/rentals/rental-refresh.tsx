"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { VISIBLE_SEARCH_REFRESH_MS } from "../search/search-refresh";

export function RentalRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(refresh, VISIBLE_SEARCH_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [router]);
  return null;
}
