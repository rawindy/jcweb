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
  const pitVolume = pitSand / sandDensity;
  if (pitVolume <= 0 || wetMass <= 0) return 0;
  const wetDensity = wetMass / pitVolume;

  const dryBox = boxDry - boxMass;
  if (dryBox <= 0) return 0;
  const waterContent = (boxWet - boxDry) / dryBox * 100;
  if (waterContent < -100) return 0;

  const dryDensity = wetDensity / (1 + waterContent / 100);
  return dryDensity > 0 ? dryDensity : 0;
}

// 计算压实度(%)
function calcCompaction(tv, maxDryDensity) {
  const dd = calcDryDensity(tv);
  if (!dd || !maxDryDensity || maxDryDensity <= 0) return 0;
  return dd / maxDryDensity * 100;
}

// 将计算值注入 test_values（用于保存时）
function injectComputedValues(testValues, maxDryDensity) {
  const tv = { ...testValues };
  const dry = calcDryDensity(tv);
  if (dry > 0) {
    tv.dry_density = bankersRound(dry, 2);
  }
  if (dry > 0 && maxDryDensity > 0) {
    const comp = dry / maxDryDensity * 100;
    tv.compaction = bankersRound(comp, 1);
  }
  return tv;
}

module.exports = { calcDryDensity, calcCompaction, injectComputedValues };
