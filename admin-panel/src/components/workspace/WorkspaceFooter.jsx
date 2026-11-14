export default function WorkspaceFooter() {
  return (
    <footer className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-200 py-5 text-xs text-outline">
      <span className="font-semibold text-on-surface-variant">ClinicOS Sovereign 4.2.0</span>
      <span>HIPAA &amp; ABDM compliant enterprise architecture</span>
      <span>Data encrypted at rest (AES-256)</span>
      <span className="flex items-center gap-1.5 font-medium text-brand">
        <span className="size-1.5 rounded-full bg-brand" />
        ABDM gateway status: Connected
      </span>
    </footer>
  )
}
