"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Re-renders the (server-rendered) shelf whenever someone in the room checks in or changes book. */
export function ShelfLive({ meetupId }: { meetupId: string }) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`shelf:${meetupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins", filter: `meetup_id=eq.${meetupId}` }, () => {
        // Several people often check in at once; refresh at most once a second.
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 1000);
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [meetupId, router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${live ? "bg-green-700" : "bg-ink/30"}`} />
      {live ? "Live" : "Connecting…"}
    </span>
  );
}
