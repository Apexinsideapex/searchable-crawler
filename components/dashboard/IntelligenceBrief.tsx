"use client";

import { useEffect, useState } from "react";
import { 
  AlertTriangle, 
  Info, 
  RefreshCw, 
  Sparkles,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Insight {
  severity: "info" | "warning" | "critical";
  headline: string;
  body: string;
  affected_pages: string[];
  suggested_action: string;
}

export function IntelligenceBrief({ siteId }: { siteId: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabase = createClient();

  const fetchInsights = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setIsRefreshing(true);
      setError(null);
      
      const { data, error: fnError } = await supabase.functions.invoke("insights", {
        body: { site_id: siteId },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setInsights(data?.insights || []);
    } catch (err: any) {
      console.error("Failed to fetch insights:", err);
      setError(err.message || "Failed to load intelligence brief.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [siteId]);

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Intelligence Brief</CardTitle>
          </div>
          <Skeleton className="h-8 w-24" />
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null; // Or return a subtle error state, but failing silently keeps the dashboard clean
  }

  if (insights.length === 0) return null;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Intelligence Brief</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              AI-generated <span className="opacity-50">•</span> verify before acting
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => fetchInsights(true)}
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 size-3 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="pt-4 grid gap-3">
        {insights.map((insight, idx) => (
          <InsightRow key={idx} insight={insight} />
        ))}
      </CardContent>
    </Card>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const [isOpen, setIsOpen] = useState(false);

  const getIcon = () => {
    switch (insight.severity) {
      case "critical":
      case "warning":
        return <AlertTriangle className={`size-5 ${insight.severity === 'critical' ? 'text-destructive' : 'text-amber-500'}`} />;
      default:
        return <Info className="size-5 text-blue-500" />;
    }
  };

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="rounded-lg border bg-card text-card-foreground shadow-sm transition-all"
    >
      <CollapsibleTrigger className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50 rounded-lg">
        <div className="mt-0.5 shrink-0">{getIcon()}</div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium leading-none">{insight.headline}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {insight.affected_pages?.slice(0, 3).map((page, i) => (
              <Badge key={i} variant="secondary" className="text-xs px-1.5 py-0">
                {page}
              </Badge>
            ))}
            {(insight.affected_pages?.length || 0) > 3 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                +{(insight.affected_pages?.length || 0) - 3} more
              </Badge>
            )}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground mt-0.5">
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="px-4 pb-4 pt-0">
        <div className="ml-8 space-y-3 pt-2 text-sm text-muted-foreground border-t mt-2">
          <p>{insight.body}</p>
          {insight.suggested_action && (
            <div className="rounded-md bg-muted p-3 text-foreground">
              <span className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Suggested Action</span>
              <p>{insight.suggested_action}</p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
