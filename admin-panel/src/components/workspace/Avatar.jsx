import { cn } from '../../lib/cn'

const TONES = {
  teal: 'bg-teal-200 text-teal-900',
  deep: 'bg-brand text-white',
  slate: 'bg-slate-200 text-slate-700',
  ink: 'bg-slate-900 text-white',
}

export default function Avatar({ initials, tone = 'slate', size = 'md', className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'lg' ? 'size-14 rounded-lg text-xl' : size === 'sm' ? 'size-7 text-[10px]' : 'size-9 text-xs',
        TONES[tone],
        className,
      )}
    >
      {initials}
    </span>
  )
}
