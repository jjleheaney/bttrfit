"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setTimeZone } from "@/app/(app)/actions";

/**
 * Tells the server which day the user is in, once per browser and again if they
 * travel. Rendered rather than guessed because a wrong day files a 6am weigh-in
 * against yesterday, which is worse than one extra request on first load.
 */
export function TimezoneSync({ known }: { known: string }) {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone || timeZone === known) return;
    void setTimeZone(timeZone).then(() => router.refresh());
  }, [known, router]);

  return null;
}
