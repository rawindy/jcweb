const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { query, getDb } = require('../config/db');

router.use(auth);

// 确保表存在
getDb().exec(`CREATE TABLE IF NOT EXISTS sys_instrument (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL,
  code        TEXT NOT NULL,
  mass        REAL NOT NULL,
  status      INTEGER NOT NULL DEFAULT 1,
  create_time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT DEFAULT (datetime('now','localtime')),
  remark      TEXT DEFAULT NULL,
  UNIQUE (category, code)
)`);

// 列表
router.get('/', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM sys_instrument';
  const params = [];
  if (category) { sql += ' WHERE category = ?'; params.push(category); }
  sql += ' ORDER BY category, CAST(code AS INTEGER)';
  const [rows] = query(sql, params);
  res.json({ code: 200, data: rows });
});

// 详情
router.get('/:id', (req, res) => {
  const [rows] = query('SELECT * FROM sys_instrument WHERE id = ?', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ code: 404, message: '仪器不存在' });
  res.json({ code: 200, data: rows[0] });
});

// 新增
router.post('/', (req, res) => {
  const { category, code, mass, remark } = req.body;
  if (!category || !code || mass == null) {
    return res.status(400).json({ code: 400, message: '类别、编号和质量为必填项' });
  }
  const [result] = query(
    'INSERT INTO sys_instrument (category, code, mass, remark) VALUES (?, ?, ?, ?)',
    [category, String(code), mass, remark || null]
  );
  res.json({ code: 200, data: { id: result.insertId }, message: '添加成功' });
});

// 更新
router.put('/:id', (req, res) => {
  const { category, code, mass, remark } = req.body;
  query(
    'UPDATE sys_instrument SET category=?, code=?, mass=?, remark=?, update_time=datetime(\'now\',\'localtime\') WHERE id=?',
    [category, String(code), mass, remark || null, req.params.id]
  );
  res.json({ code: 200, message: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  query('DELETE FROM sys_instrument WHERE id = ?', [req.params.id]);
  res.json({ code: 200, message: '删除成功' });
});

// 按类别和编号查找
router.get('/lookup/:category/:code', (req, res) => {
  const [rows] = query(
    'SELECT * FROM sys_instrument WHERE category = ? AND code = ?',
    [req.params.category, req.params.code]
  );
  if (rows.length === 0) return res.json({ code: 200, data: null });
  res.json({ code: 200, data: rows[0] });
});

module.exports = router;
