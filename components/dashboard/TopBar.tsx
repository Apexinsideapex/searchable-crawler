import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/login/actions";

export function TopBar({
  title,
  backHref,
  settingsHref,
}: {
  title: ReactNode;
  backHref?: string;
  settingsHref?: string;
}) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-2">
        {backHref && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to your sites"
            nativeButton={false}
            render={<Link href={backHref} />}
          >
            <ArrowLeft />
          </Button>
        )}
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {settingsHref && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Site settings"
            nativeButton={false}
            render={<Link href={settingsHref} />}
          >
            <Settings />
          </Button>
        )}
        <ThemeToggle />
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm">
            Log out
          </Button>
        </form>
      </div>
    </header>
  );
}
