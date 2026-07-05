import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waiting for your first crawl</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          No AI crawler activity has landed for this site yet in the selected
          range. Once the tracker snippet is installed, visits from GPTBot,
          ClaudeBot, PerplexityBot, and other AI crawlers will show up here
          automatically.
        </p>
        <a
          href="https://github.com/Apexinsideapex/searchable-crawler#pixel-snippet-publictrackerjs"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          View install instructions →
        </a>
      </CardContent>
    </Card>
  );
}
