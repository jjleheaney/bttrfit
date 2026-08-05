import { redirect } from "next/navigation";
import { TabBar } from "@/components/tab-bar";
import { TimezoneSync } from "@/components/timezone-sync";
import { createClient } from "@/lib/data/supabase/server";
import { currentTimeZone } from "@/lib/data/today";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const timeZone = await currentTimeZone();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <TimezoneSync known={timeZone} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">{children}</div>
      <TabBar />
    </div>
  );
}
