import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'

const VARIANTS = {
  primary: 'border-black bg-black text-white hover:bg-slate-800',
  secondary: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  soft: 'border-transparent bg-surface-low text-brand hover:bg-surface-high',
  danger: 'border-red-300 bg-white text-danger hover:bg-red-50',
  brand: 'border-brand bg-brand text-white hover:opacity-90',
}

// Button, or a router link when `to` is passed.
export default function ActionButton({ variant = 'secondary', size = 'md', icon: Icon, to, className, children, ...props }) {
  const classes = cn(
    'inline-flex items-center justify-center gap-1.5 rounded border font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-[13px]',
    VARIANTS[variant],
    className,
  )
  const content = (
    <>
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </>
  )

  return to ? (
    <Link to={to} className={classes} {...props}>
      {content}
    </Link>
  ) : (
    <button type="button" className={classes} {...props}>
      {content}
    </button>
  )
}
