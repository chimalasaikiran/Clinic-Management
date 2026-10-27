import { cn } from '../../lib/cn'

const sizes = {
  md: 'text-sm font-semibold tracking-[0.35px]',
  lg: 'text-[15px] font-medium',
}

export default function Button({
  type = 'button',
  size = 'md',
  fullWidth = false,
  trailing,
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 py-3 text-white shadow-lg shadow-slate-900/10 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60',
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
      {trailing}
    </button>
  )
}
