const HOST_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d+)?$/;

/**
 * Normalizes free-form user input ("https://www.Example.com/blog/") down to
 * a bare host ("example.com") suitable for storing in `sites.domain`. Returns
 * null when the input doesn't look like a host at all.
 */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const withoutScheme = trimmed.replace(/^https?:\/\//, "");
  const host = withoutScheme.split("/")[0];
  const withoutWww = host.startsWith("www.") ? host.slice(4) : host;

  if (!HOST_PATTERN.test(withoutWww)) return null;
  return withoutWww;
}
