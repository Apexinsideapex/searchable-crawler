"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* CSS-driven, not JS-state-driven: avoids an SSR/client hydration
          mismatch since resolvedTheme is unknown on the server */}
      <Sun className="dark:hidden" aria-hidden="true" />
      <Moon className="hidden dark:inline" aria-hidden="true" />
    </Button>
  );
}
