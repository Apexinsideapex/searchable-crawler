import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
      <AuthForm action={login} submitLabel="Log in" />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No account?{" "}
        <Link href="/signup" className="font-medium underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
