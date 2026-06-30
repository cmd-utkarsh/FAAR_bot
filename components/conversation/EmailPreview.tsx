import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EmailPreviewProps {
  subject: string;
  body: string;
  senderName?: string;
  senderEmail?: string;
}

export function EmailPreview({ subject, body, senderName, senderEmail }: EmailPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Inbound Email</CardTitle>
        <div className="text-sm text-muted-foreground">
          <p>
            <strong>From:</strong> {senderName ?? "Unknown"}{" "}
            {senderEmail ? `<${senderEmail}>` : ""}
          </p>
          <p>
            <strong>Subject:</strong> {subject}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </CardContent>
    </Card>
  );
}
