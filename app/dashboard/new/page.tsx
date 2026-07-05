import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/dashboard/TopBar";
import { AddSiteForm } from "@/components/dashboard/AddSiteForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewSitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Add a site" backHref="/dashboard" />
      <div className="flex flex-1 items-start justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Add your website</CardTitle>
          </CardHeader>
          <CardContent>
            <AddSiteForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
