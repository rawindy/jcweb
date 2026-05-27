/**
 * 四舍六入五成双（银行家舍入 / Banker's Rounding）工具函数
 *
 * 规则：四舍（1-4 舍）、六入（6-9 入）、五成双（5 看前一位奇偶，奇进偶舍）
 */

/**
 * 对数值进行四舍六入五成双修约
 * @param {number} value - 待修约数值
 * @param {number} decimals - 保留小数位数
 * @returns {string} 修约后的字符串（固定小数位数）
 */
export function bankersRound(value, decimals) {
  if (value == null || isNaN(value)) return ''
  const factor = Math.pow(10, decimals)
  const scaled = Math.round(value * factor * 1e12) / 1e12
  const intPart = Math.floor(Math.abs(scaled))
  const sign = scaled < 0 ? -1 : 1
  const frac = Math.abs(scaled) - intPart

  let result
  if (frac < 0.5) {
    result = intPart
  } else if (frac > 0.5) {
    result = intPart + 1
  } else {
    result = intPart % 2 === 0 ? intPart : intPart + 1
  }

  return (sign * result / factor).toFixed(decimals)
}
