const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { jwtSecret, jwtExpiresIn } = require('../config');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const [users] = query('SELECT * FROM sys_user WHERE username = ? AND status = 1', [username]);
    if (users.length === 0) {
      return res.status(400).json({ code: 400, message: '用户名或密码错误' });
    }
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ code: 400, message: '用户名或密码错误' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, real_name: user.real_name },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );
    res.json({
      code: 200,
      data: {
        token,
        user: { id: user.id, username: user.username, real_name: user.real_name, avatar: user.avatar }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.getInfo = async (req, res) => {
  try {
    const [users] = query(
      'SELECT id, username, real_name, phone, email, avatar, dept_id FROM sys_user WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    res.json({ code: 200, data: users[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};
