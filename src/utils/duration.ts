type DurationUnit = "s" | "m" | "h" | "d";

const unitToMilliseconds: Record<DurationUnit, number> = {
  s: 1_000,
  m: 60_000,
  h: 60 * 60_000,
  d: 24 * 60 * 60_000,
};

const unitAliases: Record<string, DurationUnit> = {
  s: "s",
  sec: "s",
  secs: "s",
  second: "s",
  seconds: "s",

  m: "m",
  min: "m",
  mins: "m",
  minute: "m",
  minutes: "m",

  h: "h",
  hr: "h",
  hrs: "h",
  hour: "h",
  hours: "h",

  d: "d",
  day: "d",
  days: "d",
};

export function parseDuration(input: string): number | null {
  const normalized = input.toLowerCase().trim();

  if (!normalized) return null;

  const regex = /(\d+(?:\.\d+)?)\s*([a-z]+)/g;

  let total = 0;
  let lastIndex = 0;
  let found = false;

  for (const match of normalized.matchAll(regex)) {
    // Everything between matches must only be whitespace
    if (!/^\s*$/.test(normalized.slice(lastIndex, match.index))) {
      return null;
    }

    const value = Number(match[1]);
    const unit = unitAliases[match[2]];

    if (!Number.isFinite(value) || value < 0 || !unit) {
      return null;
    }

    total += value * unitToMilliseconds[unit];
    lastIndex = (match.index ?? 0) + match[0].length;
    found = true;
  }

  // Reject trailing garbage
  if (!found || !/^\s*$/.test(normalized.slice(lastIndex))) {
    return null;
  }

  return total;
}

export function formatDuration(ms: number): string | null {
  if (!Number.isFinite(ms) || ms < 0) {
    return null;
  }

  let remaining = Math.floor(ms / 1000);

  const days = Math.floor(remaining / 86_400);
  remaining %= 86_400;

  const hours = Math.floor(remaining / 3_600);
  remaining %= 3_600;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const parts = [
    days > 0 && `${days} day${days === 1 ? "" : "s"}`,
    hours > 0 && `${hours} hour${hours === 1 ? "" : "s"}`,
    minutes > 0 && `${minutes} minute${minutes === 1 ? "" : "s"}`,
    seconds > 0 && `${seconds} second${seconds === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];

  if (parts.length === 0) {
    return "0 seconds";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}