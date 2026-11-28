import { twMerge } from 'tailwind-merge';

/** Joins class names, skipping falsy values. A later class beats an earlier one that conflicts. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(' '));
}
