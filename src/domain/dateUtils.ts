/**
 * Calculates the nominal expiration date following the rule:
 * If a user pays on day DD of month N, the expiration is day DD-1 of month N+months.
 * Example: 08/07 -> 07/08
 * 
 * Includes safety for month overflows (e.g., Jan 31 -> Feb 28/29).
 */
export function calculateNominalExpiration(baseDate: Date, monthsToAdd: number): Date {
    let year = baseDate.getFullYear();
    let month = baseDate.getMonth() + monthsToAdd;
    const day = baseDate.getDate();

    // 1. Adjust year if month overflows 11
    while (month > 11) {
        year++;
        month -= 12;
    }

    // 2. Find last day of target month (N+1 month, day 0)
    const lastDay = new Date(year, month + 1, 0).getDate();

    // 3. Target day is min(originalDay, lastDay)
    const targetDay = Math.min(day, lastDay);

    // 4. Result is targetDay - 1
    // If targetDay is 1, it will correctly go to last day of previous month
    return new Date(year, month, targetDay - 1);
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
