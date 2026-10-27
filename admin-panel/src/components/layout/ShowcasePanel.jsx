import { icons } from '../../assets/icons'
import { images } from '../../assets/images'
import { cn } from '../../lib/cn'

const STAR_COUNT = 5

function VerifiedBadges() {
  return (
    <div className="relative flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 rounded-full border border-white/15 bg-slate-900/70 px-[17px] py-[9px] shadow-xl backdrop-blur-[6px]">
        <span className="h-2 w-[7.4px] shrink-0 rounded-full bg-emerald-400 shadow-sm" />
        <span className="pr-10 text-[11px] leading-4 font-semibold tracking-[0.55px] whitespace-nowrap text-white/90 uppercase">
          Verified Practice
          <br />
          Workspace
        </span>
        <span className="text-xs font-medium tracking-[-0.3px] text-white/30" aria-hidden="true">
          |
        </span>
        <span className="pr-6 text-[11px] leading-4 font-medium tracking-[-0.3px] whitespace-nowrap text-slate-200">
          Biophilic Design Guidelines
          <br />
          compliant
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-[13px] py-[7px] backdrop-blur-[6px]">
        <img src={icons.auditCheck} alt="" />
        <span className="text-[11px] leading-[16.5px] whitespace-nowrap text-white/90">Audit ID: BLR-7092</span>
      </div>
    </div>
  )
}

function Testimonial() {
  return (
    <figure className="flex flex-col gap-[11px] rounded-2xl border border-white/15 bg-slate-900/85 p-[25px] shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] leading-[16.5px] font-bold tracking-[0.55px] text-emerald-400 uppercase">
            Modern Clinical Excellence
          </span>
        </div>
        <div className="flex items-center gap-1" aria-label="Rated 5 out of 5">
          {Array.from({ length: STAR_COUNT }, (_, index) => (
            <img key={index} src={icons.star} alt="" />
          ))}
        </div>
      </div>
      <blockquote className="pb-[5px] text-[15px] leading-[24.38px] text-slate-200">
        “ClinicOS brought effortless structure to our multi-specialty consultation workflows in under a day. Patient
        check-ins and physician room handoffs are virtually frictionless.”
      </blockquote>
      <figcaption className="flex items-center justify-between gap-3 border-t border-white/10 pt-[13px]">
        <div className="flex items-center">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-600 to-teal-400 p-[1.5px] shadow-sm">
            <span className="flex size-full items-center justify-center rounded-full bg-slate-800 text-xs font-semibold tracking-[-0.3px] text-white">
              AS
            </span>
          </span>
          <span className="flex flex-col pl-3">
            <span className="text-xs leading-4 font-semibold tracking-[0.3px] text-white">Dr. Ananya Sen, MD</span>
            <span className="text-[11px] leading-[16.5px] text-slate-300">
              Internal Medicine · Apollo Health Pavilion
            </span>
          </span>
        </div>
        <span className="hidden shrink-0 rounded border border-white/10 bg-white/10 px-[9px] py-[3px] font-mono text-[10px] leading-[15px] tracking-[0.5px] text-white/80 uppercase xl:block">
          12 Clinicians Onboard
        </span>
      </figcaption>
    </figure>
  )
}

function EngineStatus() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-950/60 px-[17px] py-[11px] backdrop-blur-[6px]">
      <div className="flex items-center gap-2">
        <span className="h-2 w-[7.2px] shrink-0 rounded-full bg-emerald-500" />
        <span className="font-mono text-[10.5px] leading-[15.75px] font-bold tracking-[0.525px] whitespace-nowrap text-emerald-400 uppercase">
          Clinic Engine
          <br />
          Active
        </span>
        <span className="text-[11.5px] text-white/20" aria-hidden="true">
          ·
        </span>
        <span className="text-[11.5px] leading-[17.25px] text-slate-300">
          Clinic Engine v4.2 · Encrypted cloud storage
        </span>
      </div>
      <span className="hidden max-w-[177px] font-mono text-[10.5px] leading-[15.75px] text-slate-400 xl:block">
        FACILITY ROUTE: #BLR-CLINIC-PRV
      </span>
    </div>
  )
}

export default function ShowcasePanel({ className }) {
  return (
    <aside
      className={cn(
        'relative hidden min-h-[961px] flex-1 flex-col justify-between overflow-hidden bg-slate-900 px-12 pt-12 pb-12 lg:flex',
        className,
      )}
    >
      <img src={images.clinicLounge} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(2,6,23,0.85)_0%,rgba(2,6,23,0.3)_50%,rgba(2,6,23,0.6)_100%)]" />
      <div className="absolute inset-0 bg-slate-900/10" />

      <VerifiedBadges />

      <div className="relative flex flex-col gap-4">
        <Testimonial />
        <EngineStatus />
      </div>
    </aside>
  )
}
