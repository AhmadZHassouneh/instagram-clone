"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NotificationList } from "@/components/panels";

// Phone version of the notifications panel.
export default function NotificationsPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[600px]">
      <header className="sticky top-0 z-20 flex h-11 items-center border-b border-separator bg-bg px-2">
        <button onClick={() => router.back()} aria-label="Back" className="p-1">
          <ChevronLeft size={28} />
        </button>
        <h1 className="flex-1 pr-8 text-center text-base font-semibold">Notifications</h1>
      </header>
      <NotificationList />
    </div>
  );
}
