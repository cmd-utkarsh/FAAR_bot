"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { BulkProgress } from "@/components/dashboard/BulkProgress";
import { ConversationTable } from "@/components/dashboard/ConversationTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { LogStatus } from "@/types";

interface BulkLog {
  id: string;
  conversationId: string;
  subjectLine: string | null;
  emailSnippet: string;
  selectedTemplate: string;
  templateId: string;
  confidence: number;
  reasoning: string;
  status: LogStatus;
  createdAt: string;
  updatedAt: string;
}

export default function BulkPage() {
  const [dryRun, setDryRun] = useState(true);
  const [conversationIds, setConversationIds] = useState("");
  const [logs, setLogs] = useState<BulkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const pollLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/bulk");
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    pollLogs();
  }, [pollLogs]);

  const handleStartBulk = async () => {
    const ids = conversationIds
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      setResult("Enter at least one conversation ID");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationIds: ids, dryRun }),
      });
      const data = await res.json();
      setResult(
        `Processed ${data.processed}/${data.total}. ${data.errors} errors.`
      );
      pollLogs();
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6">
        <h1 className="text-2xl font-bold">Bulk Sweep</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bulk Processing Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={dryRun} onCheckedChange={setDryRun} />
              <span className="text-sm">
                Dry Run Mode{" "}
                <span className="text-muted-foreground">
                  (analyze only, no replies sent)
                </span>
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Conversation IDs (one per line or comma-separated)
              </label>
              <Input
                placeholder="conv_abc123&#10;conv_def456"
                value={conversationIds}
                onChange={(e) => setConversationIds(e.target.value)}
                className="font-mono text-sm min-h-[80px]"
              />
            </div>

            <Button onClick={handleStartBulk} disabled={loading}>
              {loading ? "Processing..." : "Start Bulk Process"}
            </Button>

            {result && (
              <p className="text-sm text-muted-foreground">{result}</p>
            )}
          </CardContent>
        </Card>

        <ConversationTable logs={logs} />
      </main>
    </div>
  );
}
