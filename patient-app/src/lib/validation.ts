/** Indian mobile numbers are ten digits and start with 6 to 9. */
export const isMobileNumber = (digits: string) => /^[6-9]\d{9}$/.test(digits);

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

/** "9876543210" becomes "98765 43210". */
export const formatMobile = (digits: string) =>
  digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;

export function passwordRules(password: string) {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Includes a number or symbol', met: /[\d\W_]/.test(password) },
    { label: 'Mix of uppercase & lowercase', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
  ];
}

/** Age in whole years, or null when the date does not exist or is in the future. */
export function ageFromBirthDate(day: number, month: number, year: number, now = new Date()) {
  const birth = new Date(year, month, day);
  const exists =
    birth.getFullYear() === year && birth.getMonth() === month && birth.getDate() === day;
  if (!exists || birth > now) return null;
  const hadBirthday = now.getMonth() > month || (now.getMonth() === month && now.getDate() >= day);
  return now.getFullYear() - year - (hadBirthday ? 0 : 1);
}
