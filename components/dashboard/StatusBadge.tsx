import { Badge } from "@/components/ui/badge";
import type { LogStatus } from "@/types";

const statusStyles: Record<LogStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  AUTO_SENT: { label: "Auto-Sent", variant: "default" },
  MANUAL_REVIEW: { label: "Review", variant: "secondary" },
  MANUALLY_SENT: { label: "Sent", variant: "default" },
  SKIPPED: { label: "Skipped", variant: "outline" },
  ERROR: { label: "Error", variant: "destructive" },
  PENDING: { label: "Pending", variant: "secondary" },
};

export function StatusBadge({ status }: { status: LogStatus }) {
  const config = statusStyles[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
