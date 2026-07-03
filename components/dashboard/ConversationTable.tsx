"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { StatusBadge } from "./StatusBadge";
import type { LogStatus } from "@/types";

interface LogEntry {
  id: string;
  conversationId: string;
  subjectLine: string | null;
  selectedTemplate: string;
  confidence: number;
  status: LogStatus;
  createdAt: string;
  updatedAt: string;
}

interface ConversationTableProps {
  logs: LogEntry[];
  page: number;
  totalPages: number;
  showPagination?: boolean;
}

export function ConversationTable({
  logs: initialLogs,
  page,
  totalPages,
  showPagination = true,
}: ConversationTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sending, setSending] = useState<Set<string>>(new Set());

  const handleApproveAndSend = useCallback(
    async (conversationId: string) => {
      setSending((prev) => new Set(prev).add(conversationId));
      try {
        const res = await fetch("/api/reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Failed: ${err.error ?? "Unknown error"}`);
        }
      } catch (e) {
        alert(`Error: ${(e as Error).message}`);
      } finally {
        setSending((prev) => {
          const next = new Set(prev);
          next.delete(conversationId);
          return next;
        });
      }
      router.refresh();
    },
    [router]
  );

  const filtered = initialLogs.filter((log) => {
    const matchesSearch =
      search === "" ||
      (log.subjectLine ?? "").toLowerCase().includes(search.toLowerCase()) ||
      log.selectedTemplate.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const canApprove = (status: LogStatus) =>
    status === "MANUAL_REVIEW" || status === "ERROR";

  const buildPageUrl = (p: number) => `/dashboard?page=${p}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Search by subject or template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="AUTO_SENT">Auto-Sent</SelectItem>
            <SelectItem value="MANUAL_REVIEW">Review</SelectItem>
            <SelectItem value="MANUALLY_SENT">Manually Sent</SelectItem>
            <SelectItem value="SKIPPED">Skipped</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No entries found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {log.subjectLine ?? "(no subject)"}
                  </TableCell>
                  <TableCell>{log.selectedTemplate || "-"}</TableCell>
                  <TableCell>
                    <ConfidenceBadge confidence={log.confidence} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={log.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatRelativeTime(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canApprove(log.status) && (
                        <Button
                          size="sm"
                          disabled={sending.has(log.conversationId)}
                          onClick={() =>
                            handleApproveAndSend(log.conversationId)
                          }
                        >
                          {sending.has(log.conversationId)
                            ? "..."
                            : "Approve & Send"}
                        </Button>
                      )}
                      <Link href={`/dashboard/${log.conversationId}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildPageUrl(page - 1)}>
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildPageUrl(page + 1)}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
