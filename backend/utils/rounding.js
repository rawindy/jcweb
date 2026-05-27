/**
 * 四舍六入五成双（银行家舍入 / Banker's Rounding）工具函数
 *
 * 规则：四舍（1-4 舍）、六入（6-9 入）、五成双（5 看前一位奇偶，奇进偶舍）
 * 示例：
 *   bankersRound(1.235, 2) → "1.24"  (5 前是 3 奇数，进位)
 *   bankersRound(1.245, 2) → "1.24"  (5 前是 4 偶数，舍去)
 *   bankersRound(1.234, 2) → "1.23"  (4 舍)
 *   bankersRound(1.236, 2) → "1.24"  (6 入)
 */

/**
 * 对数值进行四舍六入五成双修约
 * @param {number} value - 待修约数值
 * @param {number} decimals - 保留小数位数
 * @returns {string} 修约后的字符串（固定小数位数）
 */
function bankersRound(value, decimals) {
  if (value == null || isNaN(value)) return ''
  const factor = Math.pow(10, decimals)
  // 放大后避免浮点误差（如 1.245 * 100 = 124.49999999999999）
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
    // frac === 0.5（五成双）：前一位偶数则舍，奇数则入
    result = intPart % 2 === 0 ? intPart : intPart + 1
  }

  return (sign * result / factor).toFixed(decimals)
}

module.exports = { bankersRound }
