"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useApi } from "@/lib/client";
import type { Post } from "@/lib/types";
import { ChevronLeft } from "lucide-react";
import { PostCard } from "@/components/post-card";
import { PostGrid, PostView } from "@/components/post-view";
import { NotFound, Spinner } from "@/components/ui";

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useApi<{ post: Post }>(`/api/posts/${id}`);
  const more = useApi<{ posts: Post[] }>(data ? `/api/users/${data.post.user.username}/posts` : null);

  if (error) return <NotFound />;
  if (!data)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );

  const others = more.data?.posts.filter((p) => p.id !== data.post.id).slice(0, 6) ?? [];

  return (
    <div className="mx-auto max-w-[935px] md:px-5 md:pt-8">
      {/* Phones: like the Instagram app, a "Posts" bar and the post as a feed card. */}
      <div className="md:hidden">
        <header className="sticky top-0 z-20 flex h-[52px] items-center bg-bg px-3">
          <button onClick={() => router.back()} aria-label="Back">
            <ChevronLeft size={30} />
          </button>
          <div className="flex-1 pr-[30px] text-center leading-4">
            <div className="text-xs font-semibold uppercase text-muted">{data.post.user.username}</div>
            <div className="text-base font-bold">Posts</div>
          </div>
        </header>
        <PostCard key={data.post.id} post={data.post} onRemove={() => router.push(`/${data.post.user.username}`)} />
      </div>
      <div className="hidden overflow-hidden border-separator md:block md:h-[min(85vh,700px)] md:rounded md:border">
        <PostView key={data.post.id} post={data.post} onChange={(p) => !p && router.push(`/${data.post.user.username}`)} />
      </div>
      {others.length > 0 && (
        <div className="mt-12 border-t border-separator pt-12">
          <p className="mb-4 px-4 font-semibold text-muted md:px-0">
            More posts from{" "}
            <Link href={`/${data.post.user.username}`} className="text-fg">
              {data.post.user.username}
            </Link>
          </p>
          <PostGrid posts={others} />
        </div>
      )}
    </div>
  );
}

