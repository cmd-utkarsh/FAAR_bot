"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LiveCheckState {
  checked: number;
  new: number;
  sent: number;
  flagged: number;
}

interface LiveCheckToggleProps {
  pollIntervalMs?: number;
  dryRun?: boolean;
}

export function LiveCheckToggle({
  pollIntervalMs = 45_000,
  dryRun = false,
}: LiveCheckToggleProps) {
  const [isOn, setIsOn] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [latestResult, setLatestResult] = useState<LiveCheckState | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      const res = await fetch(
        `/api/live-check?dryRun=${dryRun}`
      );
      const data = await res.json();
      setLatestResult(data);
      if (data.sent > 0 || data.flagged > 0) {
        setSessionTotal((prev) => prev + data.sent + data.flagged);
      }
      setLastChecked(new Date());
    } catch {
      // silently fail — next poll will retry
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

  const handleToggle = (checked: boolean) => {
    setIsOn(checked);
    if (!checked) {
      setLatestResult(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Live Check</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {isOn ? "On" : "Off"}
            </span>
            <Switch checked={isOn} onCheckedChange={handleToggle} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {lastChecked ? (
            <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
          ) : (
            <span>Not checked yet</span>
          )}
          {sessionTotal > 0 && (
            <Badge variant="secondary">+{sessionTotal} this session</Badge>
          )}
          {latestResult && isOn && (
            <span>
              {latestResult.sent} sent, {latestResult.flagged} flagged
            </span>
          )}
          {isChecking && (
            <span className="animate-pulse">Checking...</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
