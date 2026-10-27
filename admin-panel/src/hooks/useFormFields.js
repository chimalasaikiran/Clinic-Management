import { useState } from 'react'

export function useFormFields(initialValues) {
  const [values, setValues] = useState(initialValues)

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  return [values, handleChange, setValues]
}
