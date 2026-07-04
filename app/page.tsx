import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        AI Crawler Analytics
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        See which AI crawlers — GPTBot, ClaudeBot, PerplexityBot and more —
        are visiting your site.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
