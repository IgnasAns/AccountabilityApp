/**
 * Local-date helpers.
 *
 * Every "which calendar day does this completion belong to" question must be
 * answered in the DEVICE's local timezone, not UTC. The old pattern
 * `new Date(x).toISOString().split('T')[0]` buckets by UTC, so a user in
 * Mexico City (UTC-6) saw completions land on the wrong calendar day — a
 * goal completed at 7pm local was "yesterday", making "This Week" counters
 * and the stats graph look broken.
 */

/** Device timezone offset in minutes EAST of UTC (Mexico City = -360). */
export function tzOffsetMinutes(): number {
    return -new Date().getTimezoneOffset();
}

/**
 * Format a Date (or ISO timestamp) as YYYY-MM-DD in the device's LOCAL
 * timezone — the format react-native-calendars and the completion-day
 * comparisons use.
 */
export function toLocalDateString(value: string | Date): string {
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
