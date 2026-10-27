import { useState } from 'react'
import { cn } from '../../../lib/cn'
import DashboardHeader from './DashboardHeader'
import Sidebar from './Sidebar'

export default function DashboardLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface-lowest font-inter text-on-surface">
      <Sidebar className="fixed inset-y-0 left-0 z-30 hidden lg:block" />

      <div className={cn('fixed inset-0 z-40 lg:hidden', !menuOpen && 'pointer-events-none')} aria-hidden={!menuOpen}>
        <button
          type="button"
          aria-label="Close navigation"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
          className={cn('absolute inset-0 bg-slate-900/40 transition-opacity', menuOpen ? 'opacity-100' : 'opacity-0')}
        />
        <Sidebar
          className={cn(
            'absolute inset-y-0 left-0 shadow-xl transition-transform',
            menuOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        />
      </div>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <DashboardHeader onMenuClick={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 pt-6 sm:px-8">{children}</main>
      </div>
    </div>
  )
}
