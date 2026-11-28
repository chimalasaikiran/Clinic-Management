// The server's rule (common/validation): 8 to 128 characters with at least one letter and one number.
const MIN = 8;
const MAX = 128;

/** Returns what is wrong with a new password, or an empty string when it is acceptable. */
export function passwordProblem(password: string) {
  if (password.length < MIN || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return `Use at least ${MIN} characters with a letter and a number.`;
  if (password.length > MAX) return `Use at most ${MAX} characters.`;
  return '';
}
