"use client";

import { useParams, useRouter } from "next/navigation";
import { useApi } from "@/lib/client";
import type { StoryGroup } from "@/lib/types";
import { StoryViewer } from "@/components/story-viewer";
import { Spinner } from "@/components/ui";

export default function HighlightPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error } = useApi<{ title: string; group: StoryGroup }>(`/api/highlights/${id}`);

  if (error)
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#1a1a1a] text-white">
        <p>{error}</p>
        <button className="font-semibold text-link" onClick={() => router.push("/")}>
          Go home
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a1a1a]">
        <Spinner />
      </div>
    );
  return <StoryViewer groups={[data.group]} start={0} highlight={{ id: Number(id), title: data.title }} />;
}
