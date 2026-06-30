"use client";

import { useState } from "react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
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
}

export function ConversationTable({ logs }: ConversationTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = logs.filter((log) => {
    const matchesSearch =
      search === "" ||
      (log.subjectLine ?? "").toLowerCase().includes(search.toLowerCase()) ||
      log.selectedTemplate.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Search by subject or template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
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
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                    <Link href={`/dashboard/${log.conversationId}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
