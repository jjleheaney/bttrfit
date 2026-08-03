/**
 * The fixed sentinel lift menu. Deliberately short: the point is a stable
 * strength reference across a block, not programme design.
 */
export const SENTINEL_LIFT_MENU = [
  { key: "bench_press", displayName: "Bench press" },
  { key: "overhead_press", displayName: "Overhead press" },
  { key: "row", displayName: "Barbell or chest-supported row" },
  { key: "back_squat", displayName: "Back squat" },
  { key: "deadlift", displayName: "Deadlift" },
  { key: "pull_up", displayName: "Weighted pull-up or lat pulldown" },
  { key: "dip", displayName: "Dip" },
  { key: "hip_hinge", displayName: "Hip thrust or Romanian deadlift" },
] as const;

export type SentinelLiftKey = (typeof SENTINEL_LIFT_MENU)[number]["key"];

export function liftDisplayName(key: string): string {
  return SENTINEL_LIFT_MENU.find((lift) => lift.key === key)?.displayName ?? key;
}
