import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  training: "Training",
  indexing: "Indexing",
  conversations: "Conversations",
  agent: "Agent",
  unknown: "Unknown",
};

const CATEGORY_CLASS: Record<string, string> = {
  training: "bg-category-training text-category-foreground",
  indexing: "bg-category-indexing text-category-foreground",
  conversations: "bg-category-conversations text-category-foreground",
};

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent",
        CATEGORY_CLASS[category] ?? "bg-secondary text-secondary-foreground",
      )}
    >
      {CATEGORY_LABEL[category] ?? category}
    </Badge>
  );
}
