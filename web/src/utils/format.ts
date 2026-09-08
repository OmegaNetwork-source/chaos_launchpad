export function formatPrice(price: number): string {
  if (price === 0) return '$0.00'
  
  if (price >= 1) {
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  
  if (price >= 0.01) {
    return `$${price.toFixed(4)}`
  }
  
  if (price >= 0.0001) {
    return `$${price.toFixed(6)}`
  }
  
  if (price >= 0.00000001) {
    const str = price.toFixed(10)
    const match = str.match(/^0\.0*/)
    if (match) {
      const zeros = match[0].length - 2
      const significant = price.toFixed(zeros + 4).slice(zeros + 2)
      return `$0.${'0'.repeat(zeros)}${significant}`
    }
  }
  
  const exp = price.toExponential(2)
  const [mantissa, exponent] = exp.split('e')
  const expNum = parseInt(exponent)
  
  if (expNum < 0) {
    const zeros = Math.abs(expNum) - 1
    if (zeros <= 8) {
      return `$0.0{${zeros}}${mantissa.replace('.', '')}`
    }
  }
  
  return `$${exp}`
}

export function formatCompactPrice(price: number): string {
  if (price === 0) return '$0'
  
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(2)}M`
  }
  
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(2)}K`
  }
  
  if (price >= 1) {
    return `$${price.toFixed(2)}`
  }
  
  if (price >= 0.001) {
    return `$${price.toFixed(4)}`
  }
  
  const exp = price.toExponential(1)
  const [mantissa, exponent] = exp.split('e')
  const expNum = parseInt(exponent)
  
  if (expNum < 0) {
    const zeros = Math.abs(expNum) - 1
    if (zeros <= 6) {
      return `$0.0{${zeros}}${mantissa.replace('.', '')}`
    }
  }
  
  return `$${exp}`
}
