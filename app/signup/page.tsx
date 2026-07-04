import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { signup } from "../login/actions";

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign up</h1>
      <AuthForm action={signup} submitLabel="Sign up" />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
