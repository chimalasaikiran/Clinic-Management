import { Fragment } from 'react'
import { Link } from 'react-router-dom'

// "Pharmacy › Stock requests" trail; items with a `to` are links, the last one is the current page.
export default function Breadcrumb({ items, className = 'mb-3' }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant ${className}`}>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && <span aria-hidden="true">›</span>}
          {item.to ? (
            <Link to={item.to} className="font-medium text-brand hover:underline">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
