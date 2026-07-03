import { Badge } from "@/components/ui/badge";

interface ConfidenceBadgeProps {
  confidence: number;
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let label: string;

  if (confidence >= 85) {
    variant = "default";
    label = "High";
  } else if (confidence >= 60) {
    variant = "secondary";
    label = "Medium";
  } else {
    variant = "destructive";
    label = "Low";
  }

  return (
    <Badge variant={variant} className={className}>
      {label} ({confidence}%)
    </Badge>
  );
}
