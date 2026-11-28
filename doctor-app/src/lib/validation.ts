/** Indian mobile numbers are ten digits and start with 6 to 9. */
export const isMobileNumber = (digits: string) => /^[6-9]\d{9}$/.test(digits);

export const isEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
