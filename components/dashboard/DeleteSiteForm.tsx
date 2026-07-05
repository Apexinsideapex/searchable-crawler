"use client";

import { deleteSite } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export function DeleteSiteForm({
  siteId,
  domain,
}: {
  siteId: string;
  domain: string;
}) {
  return (
    <form
      action={deleteSite}
      onSubmit={(e) => {
        if (!confirm(`Delete ${domain}? This removes all of its crawler data.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="siteId" value={siteId} />
      <Button type="submit" variant="destructive" size="sm">
        Delete site
      </Button>
    </form>
  );
}
