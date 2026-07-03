import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BulkProgressProps {
  processed: number;
  total: number;
  errors: number;
  isRunning: boolean;
  etaMinutes?: number;
}

export function BulkProgress({ processed, total, errors, isRunning, etaMinutes }: BulkProgressProps) {
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Bulk Sweep Progress</span>
          <Badge variant={isRunning ? "default" : "secondary"}>
            {isRunning ? "Running" : "Stopped"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={percentage} />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {processed.toLocaleString()} / {total.toLocaleString()} conversations
          </span>
          <span>{percentage}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-red-400">
            {errors > 0 ? `${errors} errors` : ""}
          </span>
          {etaMinutes !== undefined && isRunning && (
            <span>ETA: ~{etaMinutes} min</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
