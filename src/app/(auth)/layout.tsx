import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";

// Login and sign-up pages: send logged-in users straight to their feed.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await currentUser()) redirect("/");
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-8">{children}</div>
      <footer className="px-4 pb-12 text-center text-xs text-muted">
        <div className="mb-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {["About", "Blog", "Jobs", "Help", "API", "Privacy", "Terms", "Locations", "Contact"].map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        English © {new Date().getFullYear()} Instagram
      </footer>
    </div>
  );
}
