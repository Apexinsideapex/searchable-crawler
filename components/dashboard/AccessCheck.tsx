"use client";

import { useEffect, useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  RefreshCw,
  ShieldAlert,
  Bot
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MatrixResult {
  allowed: boolean | undefined;
  isToken: boolean;
}

interface AccessData {
  domain: string;
  robotsFound: boolean;
  llmsFound: boolean;
  matrix: Record<string, MatrixResult>;
}

export function AccessCheck({ siteId }: { siteId: string }) {
  const [data, setData] = useState<AccessData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchAccess = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data: fnData, error: fnError } = await supabase.functions.invoke("access-check", {
        body: { site_id: siteId },
      });

      if (fnError) throw fnError;
      if (fnData?.error) throw new Error(fnData.error);

      setData(fnData);
    } catch (err: any) {
      console.error("Failed to fetch access check:", err);
      setError(err.message || "Failed to run access check.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccess();
  }, [siteId]);

  if (isLoading) {
    return (
      <Card className="border-border">
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Access Check</CardTitle>
          <CardDescription className="text-destructive">Failed to load crawler access matrix.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => fetchAccess()}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  const bots = Object.entries(data.matrix).filter(([_, info]) => !info.isToken);
  const tokens = Object.entries(data.matrix).filter(([_, info]) => info.isToken);

  const renderStatus = (allowed: boolean | undefined) => {
    if (allowed === true) return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="mr-1 size-3" /> Allowed</Badge>;
    if (allowed === false) return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="mr-1 size-3" /> Blocked</Badge>;
    return <Badge variant="secondary" className="text-muted-foreground"><HelpCircle className="mr-1 size-3" /> Default (Allowed)</Badge>;
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" />
            Live Access Matrix
          </CardTitle>
          <CardDescription className="mt-1">
            How known AI bots currently see <span className="font-semibold text-foreground">{data.domain}</span>'s configuration.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchAccess()}
          title="Re-run check"
        >
          <RefreshCw className="size-4 text-muted-foreground" />
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border ${data.robotsFound ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
            {data.robotsFound ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
            robots.txt {data.robotsFound ? 'found' : 'missing'}
          </div>
          <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border ${data.llmsFound ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' : 'bg-muted border-border text-muted-foreground'}`}>
            {data.llmsFound ? <CheckCircle2 className="size-4" /> : <Info className="size-4" />}
            llms.txt {data.llmsFound ? 'found' : 'not adopted'}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[200px]">Crawler Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Live Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bots.map(([name, info]) => (
                <TableRow key={name}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Bot className="size-4 text-muted-foreground" />
                    {name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">User Agent</TableCell>
                  <TableCell className="text-right">{renderStatus(info.allowed)}</TableCell>
                </TableRow>
              ))}
              
              {tokens.length > 0 && (
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={3} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2">
                    Control Tokens
                  </TableCell>
                </TableRow>
              )}
              
              {tokens.map(([name, info]) => (
                <TableRow key={name}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {name}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="size-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="w-[200px] text-xs">
                            This is a control token living inside robots.txt, NOT a user-agent string. You will never see this in server access logs.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">Token</TableCell>
                  <TableCell className="text-right">{renderStatus(info.allowed)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Temporary Info icon for llms.txt fallback
function Info(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
