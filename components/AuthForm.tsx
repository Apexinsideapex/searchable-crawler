"use client";

import { useActionState } from "react";
import type { AuthFormState } from "@/app/login/actions";

export function AuthForm({
  action,
  submitLabel,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15 dark:bg-black"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete="current-password"
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/15 dark:bg-black"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-green-600">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
