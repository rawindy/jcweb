module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'jcweb_jwt_secret_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h'
};
