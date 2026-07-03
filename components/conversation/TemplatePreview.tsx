import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TemplatePreviewProps {
  templateName: string;
  templateBody: string;
  hasUnresolvedVariables: boolean;
}

export function TemplatePreview({
  templateName,
  templateBody,
  hasUnresolvedVariables,
}: TemplatePreviewProps) {
  const highlightedBody = templateBody.replace(
    /\{\{[^}]+\}\}/g,
    (match) =>
      `<span class="bg-red-500/20 text-red-400 px-1 rounded">${match}</span>`
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span>Template: {templateName}</span>
          {hasUnresolvedVariables && (
            <Badge variant="destructive" className="text-xs">
              Unresolved Variables
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: highlightedBody }}
        />
      </CardContent>
    </Card>
  );
}
