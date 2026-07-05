"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge } from "@/components/dashboard/CategoryBadge";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { formatRelativeTime } from "@/lib/dashboard/format";
import type { FeedEventRow } from "@/lib/dashboard/queries";

export function Feed({ initialEvents }: { initialEvents: FeedEventRow[] }) {
  // Local state (not just rendering the prop directly) so Phase 5 can add a
  // realtime subscription that prepends new rows via this same setter.
  const [events] = useState(initialEvents);

  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No activity yet in this range.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {events.map((event) => (
        <li key={event.id} className="flex items-center gap-3 py-2 text-sm">
          <span
            className="w-16 shrink-0 text-muted-foreground"
            title={new Date(event.occurred_at).toLocaleString()}
          >
            {formatRelativeTime(event.occurred_at)}
          </span>
          <span className="w-28 shrink-0 truncate font-medium">{event.bot_name}</span>
          <PlatformBadge platform={event.platform} />
          <CategoryBadge category={event.bot_category} />
          <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
            {event.page_path}
          </span>
          {event.status_code != null && (
            <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
              {event.status_code}
            </span>
          )}
          <span className="w-16 shrink-0 text-xs text-muted-foreground">
            {event.source}
          </span>
          {event.is_verification && (
            <Badge variant="outline" className="shrink-0">
              Verified
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
