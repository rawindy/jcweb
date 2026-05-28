// 压实度计算（从 test_values 原始数据推算干密度、压实度）
const { bankersRound } = require('./rounding');

function toNum(obj, key) {
  const v = obj ? obj[key] : undefined;
  return parseFloat(v) || 0;
}

// 计算干密度(g/cm³)
function calcDryDensity(tv) {
  const sandBefore = toNum(tv, 'sand_before');
  const sandAfter = toNum(tv, 'sand_after');
  const sandSurface = toNum(tv, 'sand_surface');
  const sandDensity = toNum(tv, 'sand_density');
  const wetMass = toNum(tv, 'wet_mass');
  const boxWet = toNum(tv, 'box_wet');
  const boxDry = toNum(tv, 'box_dry');
  const boxMass = toNum(tv, 'box_mass');

  const pitSand = sandBefore - sandAfter - sandSurface;
  if (pitSand <= 0 || sandDensity <= 0) return 0;
  const pitVolume = bankersRound(pitSand / sandDensity, 0); // ② 坑体积修约到个位
  if (pitVolume <= 0 || wetMass <= 0) return 0;
  const wetDensity = bankersRound(wetMass / pitVolume, 2);  // ③ 湿密度修约到0.01

  const dryBox = boxDry - boxMass;
  if (dryBox <= 0) return 0;
  const waterContent = bankersRound((boxWet - boxDry) / dryBox * 100, 1); // ⑤ 含水率修约到0.1%
  if (waterContent < -100) return 0;

  const dryDensity = wetDensity / (1 + waterContent / 100);
  return dryDensity > 0 ? dryDensity : 0;
}

// 计算压实度(%)
function calcCompaction(tv, maxDryDensity) {
  const dd = calcDryDensity(tv);
  if (!dd || !maxDryDensity || maxDryDensity <= 0) return 0;
  const roundedDd = parseFloat(bankersRound(dd, 2));  // 使用修约后的干密度
  return roundedDd / maxDryDensity * 100;
}

// 将计算值注入 test_values（用于保存时）
function injectComputedValues(testValues, maxDryDensity) {
  const tv = { ...testValues };
  const dry = calcDryDensity(tv);
  if (dry > 0) {
    tv.dry_density = bankersRound(dry, 2);  // ⑥ 干密度修约到2位
  }
  if (dry > 0 && maxDryDensity > 0) {
    const dd = parseFloat(tv.dry_density) || dry;  // 使用修约后的干密度
    const comp = dd / maxDryDensity * 100;
    tv.compaction = bankersRound(comp, 1);  // ⑦ 压实度修约到1位
  }
  return tv;
}

module.exports = { calcDryDensity, calcCompaction, injectComputedValues };
