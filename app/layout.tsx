import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "FAAR_bot — FrontApp Auto-Reply Bot",
  description: "Automated triaging and replying to support emails via FrontApp",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased dark">
      <body className="bg-background text-foreground min-h-screen">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
