import { Link } from 'react-router-dom'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { useBilling } from '../context/useBilling'

// Page frame for the billing screens: back link and trail, section label, title, and the organisation scope line.
export default function BillingFrame({ back, crumb, code, title, badge, description, actions, scope = true, children }) {
  const { orgName, locationText } = useBilling()
  return (
    <WorkspacePage>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link to={back.to} className="font-medium text-brand hover:underline">← {back.label}</Link>
        <span className="text-outline">{crumb}</span>
      </div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl flex-1 basis-96">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-brand uppercase">{code}</p>
          <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-9 font-bold tracking-tight">{title}{badge}</h1>
          {description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {scope && (
        <p className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs">
          <span><strong>{orgName}</strong> · {locationText}</span>
          <span className="text-outline">Currency: INR (₹) · Time: IST</span>
        </p>
      )}
      {children}
    </WorkspacePage>
  )
}

export function Note({ title, children, tone = 'neutral' }) {
  const tones = { neutral: 'border-slate-200 bg-surface-lowest', brand: 'border-teal-200 bg-teal-50/60', warning: 'border-amber-200 bg-amber-50' }
  return (
    <div className={`rounded-lg border px-4 py-3 text-xs ${tones[tone]}`}>
      {title && <p className="text-[13px] font-semibold">{title}</p>}
      <p className="text-on-surface-variant">{children}</p>
    </div>
  )
}

export function Card({ title, aside, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 px-6 pt-5">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside && <span className="text-[11px] text-outline">{aside}</span>}
      </header>
      <div className="p-6 pt-4">{children}</div>
    </section>
  )
}
