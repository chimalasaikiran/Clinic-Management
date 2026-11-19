import { Link } from 'react-router-dom'

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
      {footer.links.length > 0 && (
        <nav aria-label="Workspace" className="flex flex-wrap gap-4">
          {footer.links.map((link) => (
            <Link key={link.to} to={link.to} className="transition-colors hover:text-slate-600">
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </footer>
  )
}
