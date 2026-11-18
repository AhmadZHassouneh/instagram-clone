"use client";

import { useApi } from "@/lib/client";
import type { FollowUser } from "@/lib/types";
import { FollowButton, UserRow } from "@/components/social";
import { Spinner } from "@/components/ui";

export default function SuggestedPeoplePage() {
  const { data } = useApi<{ users: (FollowUser & { reason: string })[] }>("/api/suggestions?limit=50");
  return (
    <div className="mx-auto max-w-[600px] py-4 md:py-14">
      <h1 className="mb-3 px-4 text-base font-semibold">Suggested</h1>
      {!data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : data.users.length === 0 ? (
        <p className="px-4 text-muted">You&apos;re following everyone. Nice!</p>
      ) : (
        data.users.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            subtitle={`${u.name}${u.name ? " · " : ""}${u.reason}`}
            action={<FollowButton username={u.username} isFollowing={u.isFollowing} />}
          />
        ))
      )}
    </div>
  );
}
