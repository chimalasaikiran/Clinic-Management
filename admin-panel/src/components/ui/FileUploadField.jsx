import { useId, useState } from 'react'
import { icons } from '../../assets/icons'
import Field from './Field'

export default function FileUploadField({ id, label, hint, title, helper, accept, onFileChange }) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [fileName, setFileName] = useState('')

  const handleChange = (event) => {
    const file = event.target.files?.[0] ?? null
    setFileName(file?.name ?? '')
    onFileChange?.(file)
  }

  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-[15px] transition hover:border-slate-400 focus-within:border-teal-600"
      >
        <span className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
            <img src={icons.imageUpload} alt="" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-semibold text-slate-800">{fileName || title}</span>
            <span className="text-[11px] text-slate-500">{helper}</span>
          </span>
        </span>
        <span className="shrink-0 rounded-lg border border-slate-200/80 bg-slate-100 px-[15px] py-[7px] text-xs font-semibold text-slate-700">
          Choose file
        </span>
        <input id={inputId} type="file" accept={accept} className="sr-only" onChange={handleChange} />
      </label>
    </Field>
  )
}
