import { dashboardIcons as icons } from '../../../../assets/icons/dashboard'
import { cn } from '../../../../lib/cn'
import { CardHeader, CardLink, SectionCard } from '../SectionCard'

export default function FinancialSnapshot({ finance }) {
  return (
    <SectionCard aria-labelledby="financial-snapshot" className="flex flex-col justify-between gap-4">
      <div className="flex flex-col gap-4">
        <CardHeader icon={icons.finance} title="Financial snapshot" aside={<CardLink>View finance</CardLink>} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {finance.tiles.map((tile) => (
            <div
              key={tile.id}
              className="flex flex-col gap-0.5 rounded border border-slate-200/80 bg-slate-50/70 px-[13px] pt-[13px] pb-[15.5px]"
            >
              <p className="text-[11px] leading-[16.5px] font-medium text-slate-500 uppercase">{tile.label}</p>
              <p className={cn('pb-1 font-sans text-lg leading-7 font-medium text-slate-900', tile.valueClass)}>
                {tile.value}
              </p>
              <p className={cn('text-[10px] leading-[15px]', tile.noteClass)}>{tile.note}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-[9px]">
        <p className="max-w-[26rem] text-[11px] leading-[16.5px] text-slate-500">{finance.footnote}</p>
        <img src={icons.infoSmall} alt="" className="shrink-0" />
      </div>
    </SectionCard>
  )
}
