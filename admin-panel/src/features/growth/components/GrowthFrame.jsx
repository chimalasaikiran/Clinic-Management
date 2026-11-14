import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import { GROWTH_BRANCH, TODAY_LABEL } from '../constants'

// Page frame for the Growth OS screens: back link and trail, workflow code, title, return-context card, sample-data note.
export default function GrowthFrame({ back, crumb, code, title, badge, description, actions, actionNote, context, sample = 'Sample records · Live role and branch permissions are not verified', children }) {
  return (
    <WorkspacePage>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <Link to={back.to} className="font-medium text-brand hover:underline">← {back.label}</Link>
        <span className="text-outline">{crumb}</span>
      </div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl flex-1 basis-96">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-brand uppercase">{code} / Growth workspace</p>
          <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-9 font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-on-surface-variant">{description}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          {badge}
          {actions && <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>}
          {actionNote && <p className="text-[11px] text-outline">{actionNote}</p>}
        </div>
      </div>
      <div className="mb-4 rounded-md border border-slate-200 bg-white px-4 py-3 text-xs">
        <p className="flex flex-wrap justify-between gap-2"><strong className="text-[13px]">{context?.[0] ?? `Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`}</strong><span className="text-outline">{TODAY_LABEL}</span></p>
        {(context?.slice(1) ?? ['Global shell: All locations (3) · Asia/Kolkata (UTC+05:30)']).map((line) => <p key={line} className="mt-1 text-outline">{line}</p>)}
      </div>
      <p className="mb-6 flex items-center gap-2 rounded-md bg-teal-50 px-4 py-2.5 text-xs text-on-surface-variant"><Info className="size-3.5 shrink-0 text-brand" aria-hidden="true" />{sample}</p>
      {children}
    </WorkspacePage>
  )
}

export function GrowthFooter({ code, back }) {
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 pt-4 text-xs">
      {back ? <Link to={back.to} className="font-medium text-brand hover:underline">← {back.label}</Link> : <span />}
      <span className="text-[11px] text-outline">ClinicOS · {code}</span>
    </footer>
  )
}
