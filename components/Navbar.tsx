import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-zinc-50/80 px-6 py-4 backdrop-blur-sm dark:bg-black/80">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        AI Crawler Analytics
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
          Log in
        </Button>
        <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
          Sign up
        </Button>
      </div>
    </header>
  );
}
