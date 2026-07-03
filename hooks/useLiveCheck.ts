"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface LiveCheckResult {
  checked: number;
  new: number;
  sent: number;
  flagged: number;
}

export function useLiveCheck({
  pollIntervalMs = 45_000,
  dryRun = false,
}: {
  pollIntervalMs?: number;
  dryRun?: boolean;
} = {}) {
  const [isOn, setIsOn] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [lastResult, setLastResult] = useState<LiveCheckResult | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      const res = await fetch(`/api/live-check?dryRun=${dryRun}`);
      const data = await res.json();
      setLastResult(data);
      if (data.sent > 0 || data.flagged > 0) {
        setSessionTotal((prev) => prev + data.sent + data.flagged);
      }
      setLastChecked(new Date());
    } catch {
      // retry on next poll
    } finally {
      setIsChecking(false);
    }
  }, [dryRun, isChecking]);

  useEffect(() => {
    if (isOn) {
      check();
      intervalRef.current = setInterval(check, pollIntervalMs);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOn, pollIntervalMs, check]);

  return {
    isOn,
    setIsOn,
    isChecking,
    lastChecked,
    sessionTotal,
    lastResult,
  };
}
