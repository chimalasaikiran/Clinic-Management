import { Link } from 'react-router-dom'
import { dashboardIcons as icons } from '../../assets/icons/dashboard'
import { cn } from '../../lib/cn'

export function SectionCard({ className, children, ...props }) {
  return (
    <section
      className={cn('rounded-lg border border-slate-200 bg-white p-[21px] shadow-[0_1px_1px_rgba(0,0,0,0.05)]', className)}
      {...props}
    >
      {children}
    </section>
  )
}

export function CardHeader({ icon, title, subtitle, aside, bordered = true, className }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2',
        bordered && 'border-b border-slate-100 pb-[13px]',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {icon && <img src={icon} alt="" />}
          <h2 className="font-sans text-base leading-6 font-semibold tracking-[-0.4px] text-slate-900">{title}</h2>
        </div>
        {subtitle && <p className="text-xs leading-4 text-slate-500">{subtitle}</p>}
      </div>
      {aside}
    </div>
  )
}

// A teal "View …" link in a card header. With `to` it navigates; without, it is a plain button.
export function CardLink({ children, className, to }) {
  const classes = cn(
    'inline-flex items-center gap-0.5 text-xs leading-4 font-semibold text-brand transition-opacity hover:opacity-80',
    className,
  )
  const content = (
    <>
      {children}
      <img src={icons.arrowTeal} alt="" />
    </>
  )
  if (to) return <Link to={to} className={classes}>{content}</Link>
  return <button type="button" className={classes}>{content}</button>
}
