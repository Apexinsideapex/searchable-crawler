export interface CrawlerEventRow {
  occurred_at: string;
  page_url: string;
  bot_name: string;
  platform: string;
  bot_category: string;
  status_code: number | null;
  source: string;
  user_agent: string;
}

const CSV_COLUMNS = [
  "occurred_at",
  "page_url",
  "bot_name",
  "platform",
  "bot_category",
  "status_code",
  "source",
  "user_agent",
] as const;

function escapeField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToLine(row: CrawlerEventRow): string {
  return CSV_COLUMNS.map((col) => {
    const value = row[col];
    return escapeField(value === null ? "" : String(value));
  }).join(",");
}

export function buildCsv(rows: CrawlerEventRow[]): string {
  const lines = [CSV_COLUMNS.join(","), ...rows.map(rowToLine)];
  return lines.join("\r\n");
}

export function csvFilename(domain: string, range: string): string {
  return `crawler-events-${domain}-${range}.csv`;
}
