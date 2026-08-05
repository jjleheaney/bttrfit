import { cookies } from "next/headers";
import { isoDateInTimeZone, type IsoDate } from "@/lib/domain";

export const TIME_ZONE_COOKIE = "bttrfit-tz";
export const TIME_ZONE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The server cannot know what day it is for the user, and getting this wrong
 * files a 6am weigh-in against yesterday. The browser reports its zone once and
 * it is remembered in a cookie; UTC is the fallback until it does.
 */
export async function currentTimeZone(): Promise<string> {
  const store = await cookies();
  return store.get(TIME_ZONE_COOKIE)?.value ?? "UTC";
}

export async function currentDate(): Promise<IsoDate> {
  return isoDateInTimeZone(new Date(), await currentTimeZone());
}
