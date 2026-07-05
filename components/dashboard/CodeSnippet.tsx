"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CodeSnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border bg-muted p-3 pr-10 text-xs">
        <code>{code}</code>
      </pre>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="absolute right-2 top-2"
        onClick={handleCopy}
        aria-label="Copy snippet"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
