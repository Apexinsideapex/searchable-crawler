import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { formatRelativeTime } from "@/lib/dashboard/format";
import type { TopPageRow } from "@/lib/dashboard/queries";

export function PagesTable({ pages }: { pages: TopPageRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
          <TableHead className="text-right">Visits</TableHead>
          <TableHead className="text-right">Unique bots</TableHead>
          <TableHead>Top platform</TableHead>
          <TableHead>Last seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pages.map((page) => (
          <TableRow key={page.page_path}>
            <TableCell className="font-mono text-xs">{page.page_path}</TableCell>
            <TableCell className="text-right tabular-nums">
              {page.total_visits.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {page.unique_bots.toLocaleString()}
            </TableCell>
            <TableCell>
              <PlatformBadge platform={page.top_platform} />
            </TableCell>
            <TableCell
              className="text-muted-foreground"
              title={new Date(page.last_seen).toLocaleString()}
            >
              {formatRelativeTime(page.last_seen)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
