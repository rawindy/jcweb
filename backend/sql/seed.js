/**
 * 数据库初始化种子脚本
 * 运行: node sql/seed.js
 * 注意: 请在执行完 init.sql 后运行此脚本
 */
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  try {
    // 重置管理员密码: admin123
    const hashed = await bcrypt.hash('admin123', 10);
    await pool.query('UPDATE sys_user SET password = ? WHERE username = ?', [hashed, 'admin']);

    // 测试用户密码也设为 123456
    const hashed2 = await bcrypt.hash('123456', 10);
    await pool.query('UPDATE sys_user SET password = ? WHERE username IN (?, ?)', [hashed2, 'zhangsan', 'lisi']);

    console.log('密码初始化成功！');
    console.log('  管理员: admin / admin123');
    console.log('  测试用户: zhangsan / 123456, lisi / 123456');
    process.exit(0);
  } catch (err) {
    console.error('种子脚本执行失败:', err);
    process.exit(1);
  }
}

seed();
