/**
 * Formats a Date object to YYYY-MM-DD string in local time.
 */
export function formatLocalDateToYMD(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parses any date string (YYYY-MM-DD or ISO timestamp) into a local Date
 * positioned at end-of-day (23:59:59.999) by default, or start-of-day (00:00:00.000).
 */
export function parseLocalDate(dateStr: string, endOfDay: boolean = true): Date {
    const cleanStr = (dateStr || '').split('T')[0];
    const parts = cleanStr.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return new Date();
        return endOfDay
            ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
            : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    }
    const [y, m, d] = parts;
    return endOfDay
        ? new Date(y, m - 1, d, 23, 59, 59, 999)
        : new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Calculates the expiration date for a NEW or EXPIRED subscription starting on `startDate`.
 * Nominal rule for monthly (>=28 days): if starting on day DD of month N,
 * it expires on day DD-1 of month N+months.
 * Example: Starts 08/07 (July 8) -> Expires 07/08 (August 7) 23:59:59.
 */
export function calculateInitialExpiration(startDate: Date, durationDays: number): Date {
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const day = startDate.getDate();

    if (durationDays >= 28) {
        const monthsToAdd = Math.round(durationDays / 30);
        let targetYear = year;
        let targetMonth = month + monthsToAdd;
        while (targetMonth > 11) {
            targetYear++;
            targetMonth -= 12;
        }

        // Days in the target month
        const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        // Target day is day - 1
        let targetDay = day - 1;
        if (targetDay < 1) {
            // e.g. Start on 1st of month -> expires on last day of previous month
            const prevMonthDays = new Date(targetYear, targetMonth, 0).getDate();
            targetMonth -= 1;
            if (targetMonth < 0) {
                targetYear--;
                targetMonth += 12;
            }
            targetDay = prevMonthDays;
        } else {
            targetDay = Math.min(targetDay, daysInTargetMonth);
        }

        return new Date(targetYear, targetMonth, targetDay, 23, 59, 59, 999);
    }

    // For short term plans (<28 days): durationDays days of service inclusive of start day
    const result = new Date(year, month, day + durationDays - 1, 23, 59, 59, 999);
    return result;
}

/**
 * Calculates the new expiration date when EXTENDING an already active subscription.
 * Does NOT subtract an extra day (preserves the nominal cycle day).
 * Example: Currently expires 07/08 (August 7) -> 1 month extension -> Expires 07/09 (September 7) 23:59:59.
 */
export function calculateRenewalExpiration(currentExpirationDate: Date, durationDays: number): Date {
    const year = currentExpirationDate.getFullYear();
    const month = currentExpirationDate.getMonth();
    const day = currentExpirationDate.getDate();

    if (durationDays >= 28) {
        const monthsToAdd = Math.round(durationDays / 30);
        let targetYear = year;
        let targetMonth = month + monthsToAdd;
        while (targetMonth > 11) {
            targetYear++;
            targetMonth -= 12;
        }

        const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const targetDay = Math.min(day, daysInTargetMonth);

        return new Date(targetYear, targetMonth, targetDay, 23, 59, 59, 999);
    }

    // Short term extension: add days to current expiration
    const result = new Date(year, month, day + durationDays, 23, 59, 59, 999);
    return result;
}

/**
 * Backward compatibility wrapper for calculateNominalExpiration
 */
export function calculateNominalExpiration(baseDate: Date, monthsToAdd: number): Date {
    return calculateInitialExpiration(baseDate, monthsToAdd * 30);
}

/**
 * Checks if a date is within the same calendar day as today.
 */
export function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear()
    );
}

/**
 * Local midnight (00:00:00.000) of the given date. Building boundaries this way - via the
 * local-time Date constructor - rather than snapshotting "now" and calling toISOString(),
 * keeps the resulting UTC instant aligned with local-time day bucketing.
 */
export function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Last instant (23:59:59.999) of the given date, in local time.
 */
export function endOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
