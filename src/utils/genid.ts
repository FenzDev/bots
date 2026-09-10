export function generateTimestampId(): string {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Etc/GMT-1",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((p) => p.type === type)!.value;

  const timestamp =
    `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}`;

  const random = Math.random().toString(36).slice(2, 8);

  return `${timestamp}_${random}`;
}
