import type { NextRequest } from "next/server";
import { getAllBlocksForExport, getProfile } from "@/lib/data/blocks";
import { currentDate } from "@/lib/data/today";
import { dailyEntriesCsv, liftEntriesCsv } from "@/lib/domain";

const DATASETS = {
  daily: { build: dailyEntriesCsv, name: "daily" },
  lifts: { build: liftEntriesCsv, name: "lifts" },
} as const;

type Dataset = keyof typeof DATASETS;

function isDataset(value: string | null): value is Dataset {
  return value !== null && value in DATASETS;
}

/**
 * The user's own data, back out again. Two datasets rather than one file,
 * because days and top sets have nothing in common but a date and forcing them
 * into shared columns would leave most of every row empty.
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("dataset");
  if (!isDataset(requested)) {
    return Response.json(
      { error: `Unknown dataset. Expected one of: ${Object.keys(DATASETS).join(", ")}.` },
      { status: 400 },
    );
  }

  const dataset = DATASETS[requested];
  const [profile, blocks, today] = await Promise.all([
    getProfile(),
    getAllBlocksForExport(),
    currentDate(),
  ]);

  return new Response(dataset.build(blocks, profile.unitPreference), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bttrfit-${dataset.name}-${today}.csv"`,
      "cache-control": "no-store",
    },
  });
}
