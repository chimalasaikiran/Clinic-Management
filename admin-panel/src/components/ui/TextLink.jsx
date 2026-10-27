import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

const tones = {
  muted: 'text-slate-500 hover:text-slate-700',
  teal: 'text-teal-700 hover:text-teal-800',
  emerald: 'text-emerald-700 hover:text-emerald-800',
}

export default function TextLink({ to, tone = 'muted', underline = false, className, children, ...props }) {
  const classes = cn(
    'inline-flex items-center gap-1.5 transition-colors',
    tones[tone],
    underline && 'underline decoration-teal-600/30 underline-offset-2',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
