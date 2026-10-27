export default function PageHeading({ eyebrow, title, description }) {
  return (
    <header className="flex flex-col gap-2">
      {eyebrow && (
        <p className="pt-1.5 pb-0.5 text-xs font-semibold tracking-[0.6px] text-teal-800 uppercase">{eyebrow}</p>
      )}
      <h1 className="text-3xl leading-[1.1] font-semibold tracking-[-0.9px] text-slate-950 sm:text-4xl">{title}</h1>
      {description && <p className="pt-[3px] text-[15px] leading-6 text-slate-600">{description}</p>}
    </header>
  )
}
