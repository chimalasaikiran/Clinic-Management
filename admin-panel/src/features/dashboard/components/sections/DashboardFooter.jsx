export default function DashboardFooter({ footer }) {
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-slate-200 pt-[21px] pb-5 text-xs leading-4 text-slate-400">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-slate-700">{footer.product}</span>
        {footer.notes.map((note) => (
          <span key={note} className="flex items-center gap-3">
            <span aria-hidden="true">·</span>
            {note}
          </span>
        ))}
      </p>
      <nav aria-label="Compliance" className="flex flex-wrap gap-4">
        {footer.links.map((link) => (
          <button key={link} type="button" className="transition-colors hover:text-slate-600">
            {link}
          </button>
        ))}
      </nav>
    </footer>
  )
}
