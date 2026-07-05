import { Badge } from "@/components/ui/badge";

export function PlatformBadge({ platform }: { platform: string }) {
  return <Badge variant="secondary">{platform}</Badge>;
}
