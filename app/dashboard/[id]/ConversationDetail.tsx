"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailPreview } from "@/components/conversation/EmailPreview";
import { TemplatePreview } from "@/components/conversation/TemplatePreview";
import { ActionButtons } from "@/components/conversation/ActionButtons";
import { ConfidenceBadge } from "@/components/dashboard/ConfidenceBadge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { hasUnresolvedVariables } from "@/lib/templates";
import type { FrontConversation, FrontMessage, FrontTemplate, LogStatus } from "@/types";

interface ConversationDetailProps {
  conversationId: string;
  log: {
    id: string;
    conversationId: string;
    subjectLine: string | null;
    selectedTemplate: string;
    templateId: string;
    confidence: number;
    reasoning: string;
    messageUid: string | null;
    status: LogStatus;
    replySentAt: Date | null;
    createdAt: Date;
  };
  conversation: FrontConversation | null;
  lastInbound: FrontMessage | null;
  matchedTemplate: FrontTemplate | null;
  error?: string;
}

export function ConversationDetail({
  conversationId,
  log,
  conversation,
  lastInbound,
  matchedTemplate,
  error,
}: ConversationDetailProps) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApprove = async () => {
    setActionError(null);
    const res = await fetch("/api/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
    if (!res.ok) {
      const err = await res.json();
      setActionError(err.error ?? "Failed to send reply");
      return;
    }
    router.refresh();
  };

  const handleSkip = async () => {
    setActionError(null);
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, dryRun: true }),
    });
    if (!res.ok) {
      const err = await res.json();
      setActionError(err.error ?? "Failed to skip");
      return;
    }
    router.refresh();
  };

  const handleReanalyze = async () => {
    setActionError(null);
    const res = await fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, dryRun: true }),
    });
    if (!res.ok) {
      const err = await res.json();
      setActionError(err.error ?? "Failed to re-analyze");
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {conversation?.subject ?? log.subjectLine ?? "Conversation Detail"}
          </h1>
          <p className="text-sm text-muted-foreground">{conversationId}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={log.status} />
          <ConfidenceBadge confidence={log.confidence} />
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {actionError && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-destructive">{actionError}</CardContent>
        </Card>
      )}

      {lastInbound && (
        <EmailPreview
          subject={lastInbound.subject ?? ""}
          body={lastInbound.body ?? lastInbound.text ?? ""}
          senderName={lastInbound.author?.name}
          senderEmail={lastInbound.author?.email}
        />
      )}

      {matchedTemplate && (
        <TemplatePreview
          templateName={matchedTemplate.name}
          templateBody={matchedTemplate.body}
          hasUnresolvedVariables={hasUnresolvedVariables(matchedTemplate.body)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DeepSeek Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-smtext-muted-foreground whitespace-pre-wrap">
            {log.reasoning}
          </p>
        </CardContent>
      </Card>

      <Separator />

      <ActionButtons
        conversationId={conversationId}
        status={log.status}
        onApprove={handleApprove}
        onSkip={handleSkip}
        onReanalyze={handleReanalyze}
      />

      {log.messageUid && (
        <p className="text-xs text-muted-foreground">
          Message UID: {log.messageUid}
        </p>
      )}
    </div>
  );
}
