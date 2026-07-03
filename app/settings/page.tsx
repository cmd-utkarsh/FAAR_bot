"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface StatusInfo {
  id: string;
  name: string;
  category: string;
  isWaiting: boolean;
}

interface TeammateInfo {
  id: string;
  email: string;
  name: string;
  isAvailable: boolean;
}

interface FrontConfig {
  frontConnected: boolean;
  ticketingEnabled: boolean;
  statuses: StatusInfo[];
  teammates: TeammateInfo[];
  currentWaitingStatusId: string;
  currentAuthorTeammateId: string;
}

export default function SettingsPage() {
  const [threshold] = useState(85);
  const [model] = useState("deepseek-chat");
  const [pollInterval] = useState(45);
  const [config, setConfig] = useState<FrontConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/front/config");
      if (res.ok) {
        setConfig(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const waitingStatus = config?.statuses.find((s) => s.isWaiting);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold">Settings</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading Front configuration...</p>
        ) : (
          <>
            {/* === Front Setup Card === */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>Front Setup &amp; Ticketing</span>
                  <Badge variant={config?.frontConnected ? "default" : "destructive"}>
                    {config?.frontConnected ? "Connected" : "Disconnected"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ticket Statuses */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    Ticket Statuses{" "}
                    {config?.ticketingEnabled ? (
                      <Badge variant="default" className="ml-2">Ticketing Enabled</Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-2">Not Enabled</Badge>
                    )}
                  </p>
                  {config?.statuses.length ? (
                    <div className="space-y-1">
                      {config.statuses.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">{s.name}</span>
                            <span className="text-muted-foreground ml-2">
                              ({s.category})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {s.id}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(s.id, s.name)}
                            >
                              {copied === s.name ? "Copied" : "Copy"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No custom statuses found. Enable Ticketing in Front workspace settings.
                    </p>
                  )}
                </div>

                <Separator />

                {/* Waiting Status — the important one */}
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-sm font-medium mb-1">
                    FRONT_WAITING_STATUS_ID{" "}
                    {config?.currentWaitingStatusId ? (
                      <Badge variant="default" className="ml-2">Set</Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-2">Not Set</Badge>
                    )}
                  </p>
                  {waitingStatus ? (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm">
                        {waitingStatus.name}{" "}
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {waitingStatus.id}
                        </code>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(waitingStatus.id, waitingStatus.name)}
                      >
                        {copied === waitingStatus.name ? "Copied" : "Copy ID"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No &quot;waiting&quot; category status found. Copy the ID of whichever status
                      you want applied after auto-send, then add it to your{" "}
                      <code>.env.local</code>.
                    </p>
                  )}
                  {config?.currentWaitingStatusId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Current: <code>{config.currentWaitingStatusId}</code>
                    </p>
                  )}
                </div>

                <Separator />

                {/* Teammates (Author ID) */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    FRONT_AUTHOR_TEAMMATE_ID{" "}
                    {config?.currentAuthorTeammateId ? (
                      <Badge variant="default" className="ml-2">Set</Badge>
                    ) : (
                      <Badge variant="destructive" className="ml-2">Not Set</Badge>
                    )}
                  </p>
                  {config?.teammates.length ? (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {config.teammates.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">{t.name || t.email}</span>
                            <span className="text-muted-foreground ml-2">{t.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {t.id}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(t.id, t.name || t.email)}
                            >
                              {copied === (t.name || t.email) ? "Copied" : "Copy"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No teammates found.</p>
                  )}
                  {config?.currentAuthorTeammateId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Current: <code>{config.currentAuthorTeammateId}</code>
                    </p>
                  )}
                </div>

                <Button variant="outline" size="sm" onClick={fetchConfig}>
                  Refresh
                </Button>
              </CardContent>
            </Card>

            {/* === Confidence Threshold === */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Confidence Threshold</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Slider
                  value={[threshold]}
                  onValueChange={() => {}}
                  min={50}
                  max={99}
                  step={1}
                  disabled
                />
                <p className="text-sm text-muted-foreground">
                  Current: <strong>{threshold}%</strong> (set via{" "}
                  <code>CONFIDENCE_THRESHOLD</code> in .env.local)
                </p>
              </CardContent>
            </Card>

            {/* === Model Selection === */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Model Selection</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={model} onValueChange={() => {}} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                    <SelectItem value="deepseek-reasoner">DeepSeek Reasoner</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* === Poll Interval === */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live Check Poll Interval</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  type="number"
                  value={pollInterval}
                  disabled
                  className="w-32"
                />
                <p className="text-sm text-muted-foreground">
                  Current: <strong>{pollInterval}s</strong> (set via{" "}
                  <code>LIVE_CHECK_POLL_INTERVAL_SECONDS</code>)
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
