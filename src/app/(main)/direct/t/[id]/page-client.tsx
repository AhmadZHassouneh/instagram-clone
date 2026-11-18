"use client";

import { useParams } from "next/navigation";
import { Inbox } from "@/components/direct";

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  return <Inbox selectedId={Number(id)} />;
}
