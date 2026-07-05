import Link from "next/link";

export default function SiteNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">Site not found</h1>
      <p className="text-sm text-muted-foreground">
        This site doesn&apos;t exist, or it doesn&apos;t belong to your account.
      </p>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to your sites
      </Link>
    </div>
  );
}
