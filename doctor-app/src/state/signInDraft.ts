// The mobile and password between the two sign-in steps, so "resend code" can ask again. Held in memory only, never
// in a route or on disk, and cleared once signed in.
let draft: { mobile: string; password: string } | null = null;

export const signInDraft = {
  set: (value: { mobile: string; password: string }) => {
    draft = value;
  },
  get: () => draft,
  clear: () => {
    draft = null;
  },
};
