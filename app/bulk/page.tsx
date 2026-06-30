"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ConversationTable } from "@/components/dashboard/ConversationTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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

function BulkPageContent() {
  const [dryRun, setDryRun] = useState(true);
  const [maxConversations, setMaxConversations] = useState(200);
  const [conversationIds, setConversationIds] = useState("");
  const [logs, setLogs] = useState<BulkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sweepResult, setSweepResult] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const pollLogs = useCallback(async (p?: number) => {
    const currentPage = p ?? page;
    try {
      const res = await fetch(`/api/bulk?page=${currentPage}&pageSize=50`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages);
      }
    } catch {
      // ignore
    }
  }, [page]);

  useEffect(() => {
    pollLogs(page);
  }, [page, pollLogs]);

  const handleSweep = async () => {
    setLoading(true);
    setSweepResult(null);
    try {
      const res = await fetch("/api/bulk/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          maxConversations,
        }),
      });
      const data = await res.json();
      setSweepResult(
        `Fetched ${data.fetched}, processed ${data.processed}. ${data.errors} errors. Dry run: ${data.dryRun}`
      );
      setPage(1);
      pollLogs(1);
    } catch (e) {
      setSweepResult(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

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
            <CardTitle className="text-base">Fetch &amp; Analyze All Open Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch checked={dryRun} onCheckedChange={setDryRun} />
              <span className="text-sm">
                Dry Run{" "}
                <span className="text-muted-foreground">
                  (analyze only, no replies)
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <label className="text-sm">Max conversations</label>
                <Input
                  type="number"
                  value={maxConversations}
                  onChange={(e) => setMaxConversations(Number(e.target.value))}
                  className="w-24"
                  min={10}
                  max={5000}
                />
              </div>
              <Button onClick={handleSweep} disabled={loading} className="mt-5">
                {loading ? "Sweeping..." : "Start Sweep"}
              </Button>
            </div>
            {sweepResult && (
              <p className="text-sm text-muted-foreground">{sweepResult}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Process Specific Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Conversation IDs (one per line or comma-separated)
              </label>
              <Input
                placeholder="cnv_abc123&#10;cnv_def456"
                value={conversationIds}
                onChange={(e) => setConversationIds(e.target.value)}
                className="font-mono text-sm min-h-[80px]"
              />
            </div>
            <Button onClick={handleStartBulk} disabled={loading}>
              {loading ? "Processing..." : "Process IDs"}
            </Button>
            {result && (
              <p className="text-sm text-muted-foreground">{result}</p>
            )}
          </CardContent>
        </Card>

        <ConversationTable logs={logs} page={page} totalPages={totalPages} showPagination={false} />

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function BulkPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <BulkPageContent />
    </Suspense>
  );
}
