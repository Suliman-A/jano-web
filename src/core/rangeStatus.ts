type Reading = { date: string; value?: number | null; systolic?: number; diastolic?: number };
type Typical = { min?: number; max?: number; systolicBelow?: number; diastolicBelow?: number } | null;
export type Status = "in" | "above" | "below" | "none";

export function rangeStatus(history: Reading[], typical: Typical): Status {
  const latest = history[history.length - 1];
  if (!typical) return "in";
  if (latest.systolic) {
    return latest.systolic <= typical.systolicBelow! ? "in" : "above";
  }
  if (latest.value! > typical.max!) return "above";
  if (latest.value! < typical.min!) return "below";
  return "in";
}
