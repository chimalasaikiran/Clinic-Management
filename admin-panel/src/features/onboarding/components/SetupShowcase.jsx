import { icons } from '../../../assets/icons'
import { images } from '../../../assets/images'

export default function SetupShowcase() {
  return (
    <aside className="relative hidden min-h-[640px] overflow-hidden bg-ink lg:block lg:w-[56%] lg:shrink-0">
      <img src={images.clinicReception} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-[#f5f5f5] mix-blend-multiply" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(3,7,18,0.8)_0%,rgba(3,7,18,0)_50%,rgba(11,17,32,0.3)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(3,7,18,0.3)_0%,rgba(3,7,18,0)_50%,rgba(3,7,18,0)_100%)]" />

      <div className="absolute top-6 right-8 flex items-center rounded-full border border-white/15 bg-slate-900/70 px-[17px] py-[9px] shadow-2xl backdrop-blur-sm">
        <span className="size-2 rounded-full bg-emerald-400" />
        <span className="pl-2 text-xs font-medium tracking-[-0.3px] whitespace-nowrap text-slate-100">
          Verified Practice Workspace
        </span>
        <span className="pl-2 text-xs font-medium text-slate-400" aria-hidden="true">
          |
        </span>
        <span className="pl-2 text-[11px] font-semibold tracking-[0.275px] whitespace-nowrap text-teal-200 uppercase">
          Max Healthcare Partner Standard
        </span>
      </div>

      <div className="absolute top-24 left-8 flex items-center rounded-lg border border-white/10 bg-slate-900/70 px-[15px] py-[7px] shadow-lg backdrop-blur-sm">
        <img src={icons.biophilic} alt="" />
        <span className="pl-2 text-[11px] leading-4 text-slate-200">Biophilic Design Guidelines compliant</span>
      </div>

      <div className="absolute right-8 bottom-8 left-8 flex items-end justify-between gap-4">
        <figure className="flex max-w-md flex-col gap-2.5 rounded-2xl border border-white/15 bg-slate-900/70 p-[21px] shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-teal-500" />
            <span className="text-[11px] leading-[16.5px] font-bold tracking-[0.55px] text-teal-300 uppercase">
              Modern Clinical Excellence
            </span>
          </div>
          <blockquote className="text-sm leading-5 text-slate-100">
            “ClinicOS brought effortless structure to our multi-specialty consultation workflows in under a day.”
          </blockquote>
          <figcaption className="flex items-center border-t border-white/10 pt-[11px]">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-teal-400/40 bg-teal-800/80 text-[10px] font-bold text-teal-100">
              AS
            </span>
            <span className="flex flex-col pl-3">
              <span className="text-xs leading-4 font-semibold text-white">Dr. Ananya Sen, MD</span>
              <span className="text-[11px] leading-4 text-slate-300">Internal Medicine · Apollo Health Pavilion</span>
            </span>
          </figcaption>
        </figure>

        <div className="hidden shrink-0 flex-col items-end gap-px rounded-xl border border-white/15 bg-slate-900/70 px-[17px] py-[11px] backdrop-blur-sm xl:flex">
          <span className="flex items-center gap-2 font-mono text-[11px] leading-[16.5px] font-bold text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-400" />
            CLINIC ENGINE ACTIVE
          </span>
          <span className="text-[11px] leading-[16.5px] font-medium text-slate-300">
            Clinic Engine v4.2 · Encrypted cloud storage
          </span>
        </div>
      </div>

      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[10px] leading-[15px] tracking-[0.5px] whitespace-nowrap text-white/40 uppercase">
        Facility Arch-ID: BLR-CT-908
      </span>
    </aside>
  )
}
