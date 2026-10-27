import { icons } from '../../assets/icons'
import InsetIcon from '../ui/InsetIcon'

function Divider() {
  return <span className="mx-5 h-4 w-px bg-slate-200" aria-hidden="true" />
}

function ComplianceBadge() {
  return (
    <span className="flex items-center rounded-full border border-slate-200/80 bg-slate-50 px-[11px] py-[5px]">
      <span className="size-1.5 rounded-full bg-teal-600" />
      <span className="ml-1.5">
        <InsetIcon src={icons.shieldCheck} size={14} inset={[12.27, 12.5, 14.08, 12.5]} bleed={[-5.66, -5.56]} />
      </span>
      <span className="pl-1.5 text-xs font-medium whitespace-nowrap text-slate-600">256-bit HIPAA & ABDM Compliant</span>
    </span>
  )
}

function RegionSwitcher() {
  return (
    <button type="button" className="flex items-center rounded px-2 py-1 transition-colors hover:bg-slate-100">
      <img src={icons.mapPin} alt="" />
      <span className="pl-1 text-xs font-medium whitespace-nowrap text-slate-700">IN · Bangalore Central</span>
      <span className="pl-1">
        <InsetIcon src={icons.chevronDown} size={12} inset={[37.5, 20.83, 33.33, 20.83]} bleed={[-14.29, -7.14]} />
      </span>
    </button>
  )
}

function ConciergeLink() {
  return (
    <button type="button" className="flex items-center rounded px-1.5 py-1 transition-colors hover:bg-slate-100">
      <img src={icons.concierge} alt="" />
      <span className="pl-1 text-xs font-medium whitespace-nowrap text-slate-600">Concierge Setup</span>
    </button>
  )
}

export default function AppTopBar({ badge }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink shadow-[0_0_0_1px_rgba(30,41,59,0.1),0_1px_2px_rgba(0,0,0,0.05)]">
          <img src={icons.logoMark} alt="" />
        </span>
        <div className="flex items-center pl-3.5">
          <span className="text-base font-bold tracking-[-0.4px] text-ink">
            Clinic<span className="text-teal-600">OS</span>
          </span>
          <span className="ml-2.5 hidden rounded border border-slate-200 bg-slate-50 px-[9px] py-[3px] text-[10px] leading-[15px] font-semibold tracking-[0.5px] whitespace-nowrap text-slate-600 uppercase md:block">
            Organization Workspace
          </span>
        </div>
      </div>

      <div className="hidden items-center xl:flex">
        <ComplianceBadge />
        <Divider />
        <RegionSwitcher />
        <Divider />
        <ConciergeLink />
      </div>

      {badge}
    </header>
  )
}
