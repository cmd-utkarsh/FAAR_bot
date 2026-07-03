import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsBarProps {
  total: number;
  autoSent: number;
  pendingReview: number;
  errors: number;
}

export function StatsBar({ total, autoSent, pendingReview, errors }: StatsBarProps) {
  const items = [
    { label: "Total Processed", value: total, color: "text-blue-400" },
    { label: "Auto-Sent", value: autoSent, color: "text-green-400" },
    { label: "Pending Review", value: pendingReview, color: "text-amber-400" },
    { label: "Errors", value: errors, color: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
