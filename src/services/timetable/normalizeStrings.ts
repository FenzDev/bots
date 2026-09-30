export function normalizeTimeString(str: string): string {
  const normalized = str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace("h", ":");

  const match = normalized.match(/^(\d{1,2})(?::(\d{1,2}))?$/);

  if (!match) {
    return "";
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);

  if (hours > 23 || minutes > 59) {
    return "";
  }

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

const days: Record<string, string> = {
  // Monday
  mon: "Monday",
  monday: "Monday",
  lun: "Monday",
  lundi: "Monday",

  // Tuesday
  tue: "Tuesday",
  tues: "Tuesday",
  tuesday: "Tuesday",
  mar: "Tuesday",
  mardi: "Tuesday",

  // Wednesday
  wed: "Wednesday",
  weds: "Wednesday",
  wednesday: "Wednesday",
  mer: "Wednesday",
  mercredi: "Wednesday",

  // Thursday
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  thusday: "Thursday",
  thursday: "Thursday",
  jeu: "Thursday",
  jeudi: "Thursday",

  // Friday
  fri: "Friday",
  friday: "Friday",
  ven: "Friday",
  vendredi: "Friday",

  // Saturday
  sat: "Saturday",
  saturday: "Saturday",
  sam: "Saturday",
  samedi: "Saturday",

  // Sunday
  sun: "Sunday",
  sunday: "Sunday",
  dim: "Sunday",
  dimanche: "Sunday",

  // Online (its not a day but its in timetable like a day)
  online: "Online",
};

export function translateNormalizedDay(day: string) {
  switch (day) {
    case ("Sunday"):
      return 'الأحد';
    case ("Monday"):
      return 'الإثنين';
    case ("Tuesday"):
      return 'الثلثاء';
    case ("Wednesday"):
      return 'الأربعاء';
    case ("Thursday"):
      return 'الخميس';
    case ("Saturday"):
      return 'السبت';
    case ("Online"):
      return 'أونلين';
  }
  return '';
}

export function tryNormalizeDayString(str: string): string | undefined {
  const normalized = str
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, "");

  return days[normalized];
}

export function normalizeGroup(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, "");
}
