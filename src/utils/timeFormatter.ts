/**
 * Convert decimal hours to hours:minutes format
 * @param decimalHours - Number of hours in decimal format (e.g., 1.25)
 * @returns String in format "1h15" or "1h15min" depending on preference
 */
export const formatHoursToHoursMinutes = (decimalHours: number): string => {
  const sign = decimalHours < 0 ? '-' : '';
  const abs = Math.abs(decimalHours);
  let hours = Math.floor(abs);
  let minutes = Math.round((abs - hours) * 60);

  // Handle rounding edge case (e.g., 1.999 -> 2h00)
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }

  if (minutes === 0) {
    return `${sign}${hours}h`;
  }

  return `${sign}${hours}h${minutes.toString().padStart(2, '0')}`;
};

/**
 * Convert hours:minutes input to decimal hours
 * @param hours - Number of hours
 * @param minutes - Number of minutes
 * @returns Decimal hours (e.g., 1.25 for 1h15)
 */
export const convertToDecimalHours = (hours: number, minutes: number): number => {
  return hours + (minutes / 60);
};

/**
 * Parse time input string to decimal hours
 * Supports formats: "1.5", "1h30", "1:30"
 * @param input - Time input string
 * @returns Decimal hours or null if invalid
 */
export const parseTimeInput = (input: string): number | null => {
  // Handle decimal format (1.5)
  if (/^\d+\.?\d*$/.test(input)) {
    return parseFloat(input);
  }
  
  // Handle hours:minutes format (1:30)
  const colonMatch = input.match(/^(\d+):(\d+)$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1]);
    const minutes = parseInt(colonMatch[2]);
    return convertToDecimalHours(hours, minutes);
  }
  
  // Handle hours and minutes format (1h30)
  const hMatch = input.match(/^(\d+)h(\d*)$/);
  if (hMatch) {
    const hours = parseInt(hMatch[1]);
    const minutes = hMatch[2] ? parseInt(hMatch[2]) : 0;
    return convertToDecimalHours(hours, minutes);
  }
  
  return null;
};