"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Copies a ready-to-paste, natural-language prompt to the clipboard so the
 * user can hand the install off to their own AI coding agent (Claude Code,
 * Cursor, etc.) instead of editing files by hand.
 */
export function CopyAgentPromptButton({
  prompt,
  label = "Copy prompt for your AI agent",
}: {
  prompt: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="w-fit"
      onClick={handleCopy}
    >
      {copied ? <Check /> : <Sparkles />}
      {copied ? "Copied — paste it to your agent" : label}
    </Button>
  );
}
