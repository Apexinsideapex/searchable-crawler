"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { checkVerificationEvent, sendTestCrawl } from "@/app/dashboard/actions";

type Status =
  | "idle"
  | "sending"
  | "sent"
  | "checking"
  | "found"
  | "not-found"
  | "error";

// No realtime subscription yet -- Phase 5 adds the live feed this would
// otherwise flip green automatically. Until then this is a manual
// send + manual check, which still proves the AC-6 install works end to end.
export function SendTestCrawlButton({ siteId }: { siteId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setStatus("sending");
    setError(null);
    const result = await sendTestCrawl(siteId);
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setStatus("sent");
  }

  async function handleCheck() {
    setStatus("checking");
    const result = await checkVerificationEvent(siteId);
    setStatus(result.found ? "found" : "not-found");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleSend}
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending…" : "Send test crawl"}
        </Button>
        {(status === "sent" || status === "checking" || status === "not-found") && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCheck}
            disabled={status === "checking"}
          >
            {status === "checking" ? "Checking…" : "Check now"}
          </Button>
        )}
      </div>
      {status === "found" && (
        <p className="text-sm font-medium text-green-600">
          Verified — the test crawl landed in your events.
        </p>
      )}
      {status === "not-found" && (
        <p className="text-sm text-muted-foreground">
          Not seen yet — give it a few seconds and check again.
        </p>
      )}
      {status === "error" && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
