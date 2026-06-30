"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LogStatus } from "@/types";

interface ActionButtonsProps {
  conversationId: string;
  status: LogStatus;
  onApprove: () => Promise<void>;
  onSkip: () => Promise<void>;
  onReanalyze: () => Promise<void>;
}

export function ActionButtons({
  conversationId,
  status,
  onApprove,
  onSkip,
  onReanalyze,
}: ActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setLoading(action);
    try {
      await fn();
    } finally {
      setLoading(null);
    }
  };

  const canApprove = status === "MANUAL_REVIEW" || status === "ERROR";
  const canSkip = status === "MANUAL_REVIEW" || status === "ERROR";

  return (
    <div className="flex gap-2">
      {canApprove && (
        <Button
          onClick={() => handleAction("approve", onApprove)}
          disabled={loading !== null}
        >
          {loading === "approve" ? "Sending..." : "Send Reply"}
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => handleAction("reanalyze", onReanalyze)}
        disabled={loading !== null}
      >
        {loading === "reanalyze" ? "Analyzing..." : "Re-analyze"}
      </Button>
      {canSkip && (
        <Button
          variant="secondary"
          onClick={() => handleAction("skip", onSkip)}
          disabled={loading !== null}
        >
          {loading === "skip" ? "Skipping..." : "Skip"}
        </Button>
      )}
    </div>
  );
}
