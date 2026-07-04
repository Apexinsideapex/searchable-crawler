import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Log out
          </button>
        </form>
      </header>
      <p className="text-zinc-600 dark:text-zinc-400">
        Signed in as {user.email}. Sites and crawler data land here in later
        phases.
      </p>
    </div>
  );
}
