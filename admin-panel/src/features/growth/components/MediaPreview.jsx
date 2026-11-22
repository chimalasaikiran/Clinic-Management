// How the post will look: the uploaded image with the caption heading, or a typographic card when there is none.
export default function MediaPreview({ title, cta, branch, category, imageSrc, alt }) {
  return (
    <div className="overflow-hidden rounded-md bg-teal-50">
      {imageSrc && <img src={imageSrc} alt={alt || ''} className="max-h-72 w-full object-cover" />}
      <div className="p-6">
        <p className="flex justify-between text-[11px] font-semibold tracking-wide text-brand uppercase"><span>{branch}</span><span className="text-outline">Preview</span></p>
        <div className="my-4 h-0.5 w-8 bg-brand" />
        <p className="text-[26px] leading-8 font-semibold">{title || 'Untitled content'}</p>
        <p className="mt-4 text-sm font-semibold text-brand">{cta || 'Call to action'} →</p>
        <p className="mt-6 text-[10px] tracking-wide text-outline uppercase">{branch} · {category}</p>
      </div>
    </div>
  )
}
