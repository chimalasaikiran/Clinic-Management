import { useState } from 'react'
import TextField from './TextField'

export default function PasswordField(props) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      type={visible ? 'text' : 'password'}
      endAction={
        <button
          type="button"
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="rounded px-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      }
      {...props}
    />
  )
}
