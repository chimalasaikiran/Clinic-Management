import { SearchX } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import Breadcrumb from '../../../components/workspace/Breadcrumb'
import WorkspacePage from '../../../components/workspace/WorkspacePage'
import EmptyState from '../../patients/components/EmptyState'

// Page frame for the inventory and pharmacy detail screens: breadcrumb, title row (badge + actions), then content.
export default function DetailFrame({ crumbs, title, badge, subtitle, actions, aside, children }) {
  return (
    <WorkspacePage>
      <Breadcrumb items={crumbs} />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl flex-1 basis-96">
          <h1 className="flex flex-wrap items-center gap-3 text-[28px] leading-9 font-bold tracking-tight text-on-surface">
            {title}
            {badge}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>}
        </div>
        {(actions || aside) && (
          <div className="flex flex-col items-end gap-2">
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            {aside}
          </div>
        )}
      </div>
      {children}
    </WorkspacePage>
  )
}

// What a detail page renders when its record cannot be found.
export function MissingRecord({ what, backTo, backLabel }) {
  return (
    <WorkspacePage>
      <EmptyState icon={SearchX} title={`This ${what} could not be found`} action={<ActionButton to={backTo}>{backLabel}</ActionButton>}>
        It may have been removed, or the link is incorrect.
      </EmptyState>
    </WorkspacePage>
  )
}
