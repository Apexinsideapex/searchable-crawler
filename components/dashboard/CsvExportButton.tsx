"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { resolveDateWindow } from "@/lib/dashboard/filters";
import type { DashboardFilters } from "@/lib/dashboard/filters";
import { fetchCsvRows } from "@/lib/dashboard/queries";
import { buildCsv, csvFilename } from "@/lib/dashboard/csv";

export function CsvExportButton({
  siteId,
  domain,
  filters,
  hasEvents,
}: {
  siteId: string;
  domain: string;
  filters: DashboardFilters;
  hasEvents: boolean;
}) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const supabase = createClient();
      const window = resolveDateWindow(filters.range);
      const rows = await fetchCsvRows(
        supabase,
        siteId,
        window,
        filters.category,
        filters.platforms,
      );
      const csv = buildCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = csvFilename(domain, filters.range);
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={!hasEvents || isExporting}
    >
      {isExporting ? "Exporting…" : "Export CSV"}
    </Button>
  );

  if (!hasEvents) {
    // The button's disabled:pointer-events-none means hover never reaches
    // it directly -- wrap it in a plain span so the tooltip trigger still
    // gets pointer events.
    return (
      <Tooltip>
        <TooltipTrigger render={<span />}>{button}</TooltipTrigger>
        <TooltipContent>No events in this range to export</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
