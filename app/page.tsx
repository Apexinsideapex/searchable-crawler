import Link from "next/link";
import { ArrowRight, Bot, MessageCircle, Radar } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Bot,
    color: "bg-category-training text-category-foreground",
    title: "Training, Indexing, Conversations",
    body: "Know whether it's a training crawler, a search indexer, or a real person asking ChatGPT or Claude about you right now.",
  },
  {
    icon: Radar,
    color: "bg-category-indexing text-category-foreground",
    title: "Two capture paths",
    body: "A pixel for JS-executing agents, plus a middleware tracker that catches the ~90% of bots — GPTBot, ClaudeBot, PerplexityBot — that never run JavaScript.",
  },
  {
    icon: MessageCircle,
    color: "bg-category-conversations text-category-foreground",
    title: "Live feed + CSV export",
    body: "Watch crawler hits land in real time, filter by category or platform, and export the filtered data whenever you need it.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <Navbar />

      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,var(--color-primary)/12%,transparent)]"
        />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6">
          <Badge variant="outline" className="gap-1.5 py-1">
            <span className="size-1.5 rounded-full bg-primary" />
            Now tracking AI crawlers in real time
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-black sm:text-5xl dark:text-zinc-50">
            See who's really reading your site
          </h1>
          <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
            GPTBot, ClaudeBot, PerplexityBot, Gemini and more — know exactly
            which AI crawlers and assistants are visiting, and what they find
            when they get there.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" nativeButton={false} render={<Link href="/signup" />}>
              Get started free
              <ArrowRight />
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/login" />}
            >
              Log in
            </Button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            See your first crawler hit within minutes of installing.
          </p>
        </div>
      </section>

      <section className="grid gap-6 px-6 pb-24 sm:grid-cols-3 sm:px-12 lg:px-24">
        {FEATURES.map(({ icon: Icon, color, title, body }) => (
          <div
            key={title}
            className="flex flex-col gap-4 rounded-lg border border-black/10 bg-white p-6 transition-shadow hover:shadow-md dark:border-white/15 dark:bg-zinc-950"
          >
            <div
              className={`flex size-10 items-center justify-center rounded-full ${color}`}
            >
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <h2 className="font-semibold text-black dark:text-zinc-50">
              {title}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
          </div>
        ))}
      </section>

      <section className="border-t bg-primary px-6 py-16 text-center">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
          <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground">
            Stop guessing which AI is crawling you
          </h2>
          <p className="text-primary-foreground/80">
            Sign up and connect your site in minutes — no credit card needed.
          </p>
          <Button
            size="lg"
            variant="secondary"
            nativeButton={false}
            render={<Link href="/signup" />}
          >
            Get started free
            <ArrowRight />
          </Button>
        </div>
      </section>
    </div>
  );
}
