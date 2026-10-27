import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import OtpInput from './OtpInput'

function Harness() {
  const [value, setValue] = useState(Array(6).fill(''))
  return <OtpInput value={value} onChange={setValue} />
}

const digitsOf = () => screen.getAllByRole('textbox').map((input) => input.value)

describe('OtpInput', () => {
  it('moves focus forward as digits are typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.keyboard('842')

    expect(digitsOf()).toEqual(['8', '4', '2', '', '', ''])
    expect(screen.getByLabelText('Digit 4')).toHaveFocus()
  })

  it('ignores non-numeric characters', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.keyboard('a-7')

    expect(digitsOf()).toEqual(['7', '', '', '', '', ''])
  })

  it('fills the boxes from pasted digits', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.paste('123456')

    expect(digitsOf()).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('returns to the previous box on backspace from an empty one', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByLabelText('Digit 1'))
    await user.keyboard('12')
    await user.keyboard('{Backspace}')
    expect(screen.getByLabelText('Digit 2')).toHaveFocus()
    expect(digitsOf().slice(0, 2)).toEqual(['1', ''])

    await user.keyboard('{Backspace}')
    expect(screen.getByLabelText('Digit 1')).toHaveFocus()
    expect(digitsOf().slice(0, 2)).toEqual(['', ''])
  })
})
