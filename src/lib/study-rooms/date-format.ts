const IST_OFFSET_MS = 330 * 60 * 1000;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

interface StudyRoomDateParts {
  day: number;
  month: string;
  year: number;
  hours: number;
  minutes: number;
}

function getIstDateParts(value: string): StudyRoomDateParts | null {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  const istDate = new Date(timestamp + IST_OFFSET_MS);
  return {
    day: istDate.getUTCDate(),
    month: MONTH_NAMES[istDate.getUTCMonth()],
    year: istDate.getUTCFullYear(),
    hours: istDate.getUTCHours(),
    minutes: istDate.getUTCMinutes(),
  };
}

function formatHourMinute(hours: number, minutes: number): string {
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatStudyRoomDateTime(value: string): string {
  const parts = getIstDateParts(value);
  if (!parts) return 'Unknown time';

  return `${parts.day} ${parts.month} ${parts.year}, ${formatHourMinute(parts.hours, parts.minutes)}`;
}

export function formatStudyRoomTime(value: string): string {
  const parts = getIstDateParts(value);
  if (!parts) return 'Unknown time';

  return formatHourMinute(parts.hours, parts.minutes);
}
