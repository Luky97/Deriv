export const formatBalance = (balance: number | string | undefined | null) => {
  const value = Number(balance ?? 0)
  if (!Number.isFinite(value)) return '0.00'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const extractLastDigit = (value: unknown): number | null => {
  const text = String(value)

  for (let index = text.length - 1; index >= 0; index--) {
    const code = text.charCodeAt(index)
    if (code >= 48 && code <= 57) return code - 48
  }

  return null
}
