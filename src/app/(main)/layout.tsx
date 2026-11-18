import { redirect } from "next/navigation";
import { AppProvider } from "@/components/app-context";
import { Shell } from "@/components/shell";
import { IS_DEMO_EXPORT, demoMe } from "@/lib/demo-build";
import type { Me } from "@/lib/types";

// Every page in this group needs a logged-in user.
export default async function MainLayout({ children }: LayoutProps<"/">) {
  if (IS_DEMO_EXPORT) {
    // Static GitHub Pages build: always signed in as the snapshot's user.
    return (
      <AppProvider initialMe={demoMe()}>
        <Shell>{children}</Shell>
      </AppProvider>
    );
  }
  const { currentUser } = await import("@/lib/server/auth");
  const user = await currentUser();
  if (!user) redirect("/accounts/login");
  const me: Me = {
    id: user.id,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    verified: !!user.verified,
    email: user.email,
    bio: user.bio,
    website: user.website,
  };
  return (
    <AppProvider initialMe={me}>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
