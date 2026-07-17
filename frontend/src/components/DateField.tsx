import { useRef, useCallback } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  required?: boolean
}

const AR = '٠١٢٣٤٥٦٧٨٩'
const MASK = '__/__/____'

function arToEn(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
}

function digitsOnly(s: string): string {
  return arToEn(s).replace(/[^0-9]/g, '')
}

function applyMask(digits: string): string {
  let r = MASK.split('')
  let di = 0
  for (let i = 0; i < r.length && di < digits.length; i++) {
    if (r[i] === '_') { r[i] = digits[di]; di++ }
  }
  return r.join('')
}

export default function DateField({ value, onChange, className = '', ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  const digits = digitsOnly(value || '')
  const displayValue = digits ? applyMask(digits) : ''

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    let d = digitsOnly(e.target.value)
    if (d.length > 8) d = d.slice(0, 8)
    onChange(applyMask(d))
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const pos = el.selectionStart ?? 0
    if (e.key === 'Backspace') {
      let strip = 0
      for (let i = pos - 1; i >= 0; i--) {
        if (MASK[i] === '/') strip++
        else break
      }
      const curDig = digitsOnly(el.value)
      const newLen = Math.max(0, curDig.length - 1 - strip)
      onChange(applyMask(curDig.slice(0, newLen)))
      e.preventDefault()
    }
  }, [onChange])

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={(e) => { if (!digits) e.target.value = '' }}
      placeholder={MASK}
      className={`input-field text-center tracking-widest font-mono ${className}`}
      dir="ltr"
      autoComplete="off"
      {...rest}
    />
  )
}
