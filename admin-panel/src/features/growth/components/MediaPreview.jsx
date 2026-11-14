export default function MediaPreview({ title, cta, branch, category }) {
  return (
    <div className="rounded-md bg-teal-50 p-6">
      <p className="flex justify-between text-[11px] font-semibold tracking-wide text-brand uppercase"><span>Aura Health</span><span className="text-outline">Sample draft</span></p>
      <div className="my-4 h-0.5 w-8 bg-brand" />
      <p className="text-[26px] leading-8 font-semibold">{title || 'Untitled content'}</p>
      <p className="mt-4 text-sm text-on-surface-variant">Speak with {branch} about screening options</p>
      <p className="mt-4 text-sm font-semibold text-brand">{cta || 'Call to action'} →</p>
      <p className="mt-6 text-[10px] tracking-wide text-outline uppercase">{branch} · {category}</p>
    </div>
  )
}
