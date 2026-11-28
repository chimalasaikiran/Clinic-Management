import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// The class helper shadcn registry components (mapcn) are written for: a later class replaces an earlier one it
// conflicts with, so a caller's `h-56` wins over a component's `h-full`.
export const cn = (...inputs) => twMerge(clsx(inputs))
