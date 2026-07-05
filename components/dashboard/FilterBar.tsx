"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { serializeFilters } from "@/lib/dashboard/filters";
import type {
  CategoryKey,
  DashboardFilters,
  RangeKey,
} from "@/lib/dashboard/filters";

const RANGES: Array<{ value: RangeKey; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const CATEGORIES: Array<{ value: CategoryKey; label: string }> = [
  { value: "all", label: "All" },
  { value: "training", label: "Training" },
  { value: "indexing", label: "Indexing" },
  { value: "conversations", label: "Conversations" },
];

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70",
      )}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  siteId,
  filters,
  availablePlatforms,
}: {
  siteId: string;
  filters: DashboardFilters;
  availablePlatforms: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(next: DashboardFilters) {
    const params = serializeFilters(next);
    startTransition(() => {
      router.push(`/dashboard/${siteId}?${params.toString()}`);
    });
  }

  function togglePlatform(platform: string) {
    const current = filters.platforms ?? [];
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform];
    navigate({ ...filters, platforms: next.length > 0 ? next : null });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4",
        isPending && "opacity-60",
      )}
    >
      <div className="flex gap-1">
        {RANGES.map((r) => (
          <PillButton
            key={r.value}
            active={filters.range === r.value}
            onClick={() => navigate({ ...filters, range: r.value })}
          >
            {r.label}
          </PillButton>
        ))}
      </div>
      <div className="flex gap-1">
        {CATEGORIES.map((c) => (
          <PillButton
            key={c.value}
            active={filters.category === c.value}
            onClick={() => navigate({ ...filters, category: c.value })}
          >
            {c.label}
          </PillButton>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          Platforms{filters.platforms ? ` (${filters.platforms.length})` : ""}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {availablePlatforms.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              No platforms yet
            </div>
          )}
          {availablePlatforms.map((platform) => (
            <DropdownMenuCheckboxItem
              key={platform}
              checked={filters.platforms?.includes(platform) ?? false}
              onCheckedChange={() => togglePlatform(platform)}
            >
              {platform}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
