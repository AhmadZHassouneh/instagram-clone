import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { AppProvider } from "@/components/app-context";
import { Shell } from "@/components/shell";
import type { Me } from "@/lib/types";

// Every page in this group needs a logged-in user.
export default async function MainLayout({ children }: LayoutProps<"/">) {
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
