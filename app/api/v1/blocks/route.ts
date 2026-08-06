import { getAllBlocksForExport, getProfile } from "@/lib/data/blocks";

/**
 * The read seam a native client will use.
 *
 * It returns the domain shape — camelCase, `null` for unanswered, no database
 * columns — so `lib/domain` can be lifted into a React Native app and fed from
 * here without a translation layer. Versioned in the path from the first day so
 * a shipped client cannot be broken by a later shape change.
 *
 * Authentication is the session cookie and nothing else: tokens for third-party
 * clients are a separate piece of work, and inventing a weaker one here would be
 * the worst of both.
 */
export async function GET() {
  const [profile, blocks] = await Promise.all([getProfile(), getAllBlocksForExport()]);

  return Response.json(
    {
      version: 1,
      unit: profile.unitPreference,
      blocks,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
