// Numbered form card used by the registration form.
export default function FormSection({ number, title, tag, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold text-on-surface">
          <span className="flex size-6 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white">{number}</span>
          {title}
        </h2>
        {tag && <span className="text-[11px] text-outline">{tag}</span>}
      </header>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  )
}
