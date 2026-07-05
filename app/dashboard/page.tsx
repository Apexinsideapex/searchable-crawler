import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/dashboard/TopBar";
import { Card, CardContent } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: sites } = await supabase
    .from("sites")
    .select("id, domain")
    .order("created_at", { ascending: true });

  if (sites && sites.length === 1) {
    redirect(`/dashboard/${sites[0].id}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Your sites" />
      <div className="flex flex-1 flex-col gap-4 p-6">
        {sites && sites.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((site) => (
              <Link key={site.id} href={`/dashboard/${site.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Globe className="size-4" />
                    </span>
                    <span className="flex-1 truncate font-medium">
                      {site.domain}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No sites yet. Sites and crawler data land here in later phases.
          </p>
        )}
      </div>
    </div>
  );
}
