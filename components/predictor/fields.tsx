'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { parseHM, toHMInput } from '@/lib/format'

type BaseProps = {
  id?: string
  className?: string
  'aria-label'?: string
}

const formatNumberInput = (value: number) => (Number.isFinite(value) ? String(value) : '')

export function NumberField({
  value,
  onChange,
  min = 0,
  step = 'any',
  ...rest
}: BaseProps & { value: number; onChange: (value: number) => void; min?: number; step?: string }) {
  const [text, setText] = useState(formatNumberInput(value))
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    if (Number.parseFloat(text) !== value) setText(formatNumberInput(value))
  }

  return (
    <Input
      {...rest}
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const parsed = Number.parseFloat(e.target.value)
        onChange(Number.isFinite(parsed) ? parsed : Number.NaN)
      }}
      className={`font-mono tabular-nums ${rest.className ?? ''}`}
    />
  )
}

export function TimeField({
  value,
  onChange,
  placeholder = 'jj:mm',
  ...rest
}: BaseProps & { value: number | null; onChange: (value: number | null) => void; placeholder?: string }) {
  const [text, setText] = useState(toHMInput(value))
  const [prevValue, setPrevValue] = useState(value)

  if (value !== prevValue) {
    setPrevValue(value)
    if (parseHM(text) !== value) setText(toHMInput(value))
  }

  const invalid = text.trim() !== '' && parseHM(text) == null

  return (
    <Input
      {...rest}
      inputMode="numeric"
      placeholder={placeholder}
      value={text}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        setText(e.target.value)
        onChange(parseHM(e.target.value))
      }}
      className={`font-mono tabular-nums ${rest.className ?? ''}`}
    />
  )
}
