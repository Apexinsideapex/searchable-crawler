"use client";

import { useActionState } from "react";
import { createSite, type AddSiteFormState } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

const initialState: AddSiteFormState = { error: null };

export function AddSiteForm() {
  const [state, formAction, pending] = useActionState<AddSiteFormState, FormData>(
    createSite,
    initialState,
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Website domain
        <input
          type="text"
          name="domain"
          required
          placeholder="example.com"
          autoComplete="off"
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15 dark:bg-black"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add site"}
      </Button>
    </form>
  );
}
