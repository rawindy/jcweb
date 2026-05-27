module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'jcweb_jwt_secret_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  // 数值修约规则: bankers（四舍六入五成双）| standard（标准四舍五入）
  roundingMode: process.env.ROUNDING_MODE || 'bankers'
};
