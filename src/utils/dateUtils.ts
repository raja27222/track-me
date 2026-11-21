export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getLocalDateString(date: Date = new Date(), timeZone?: string): string {
  const tz = timeZone || getBrowserTimezone();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback if invalid timezone string is supplied
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateStringUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDayOfWeekFromDateString(dateStr: string): number {
  return parseDateStringUTC(dateStr).getUTCDay(); // 0=Sun ... 6=Sat
}

export function addDaysToDateString(dateStr: string, deltaDays: number): string {
  const d = parseDateStringUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatDateUTC(d);
}

export function getMondayOfWeek(dateStr: string): string {
  const dow = getDayOfWeekFromDateString(dateStr); // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDaysToDateString(dateStr, diffToMonday);
}

export function getWeekDateStrings(anchorDateStr: string): string[] {
  const monday = getMondayOfWeek(anchorDateStr);
  return Array.from({ length: 7 }, (_, i) => addDaysToDateString(monday, i));
}

export function getMonthDateStrings(year: number, monthIndex: number): string[] {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const month = String(monthIndex + 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
}

export function getMonthGridOffsetMondayFirst(year: number, monthIndex: number): number {
  const firstDayDow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay(); // 0=Sun..6=Sat
  return firstDayDow === 0 ? 6 : firstDayDow - 1;
}

export function formatReadableDate(dateStr: string): string {
  const d = parseDateStringUTC(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatShortWeekdayAndDay(dateStr: string): {
  weekdayShort: string;
  weekdayOneLetter: string;
  dayNumber: number;
} {
  const d = parseDateStringUTC(dateStr);
  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(d);
  return {
    weekdayShort,
    weekdayOneLetter: weekdayShort.slice(0, 1),
    dayNumber: d.getUTCDate(),
  };
}

export function formatWeekRangeLabel(weekDates: string[]): string {
  if (weekDates.length === 0) return '';
  const start = parseDateStringUTC(weekDates[0]);
  const end = parseDateStringUTC(weekDates[weekDates.length - 1]);
  const startMonth = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(start);
  const endMonth = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(end);
  const year = end.getUTCFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getUTCDate()} – ${end.getUTCDate()}, ${year}`;
  }
  return `${startMonth} ${start.getUTCDate()} – ${endMonth} ${end.getUTCDate()}, ${year}`;
}

export function formatMonthYear(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function getAllDatesBetween(startDateStr: string, endDateStr: string): string[] {
  if (startDateStr > endDateStr) return [];
  const dates: string[] = [];
  let current = startDateStr;
  // Guard against absurd ranges (> 1500 days)
  let safety = 0;
  while (current <= endDateStr && safety < 1500) {
    dates.push(current);
    current = addDaysToDateString(current, 1);
    safety++;
  }
  return dates;
}
