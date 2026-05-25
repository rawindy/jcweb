const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'jcweb.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 查询助手：兼容 mysql2 的返回格式
function query(sql, params = []) {
  const arr = Array.isArray(params) ? params : [params];
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
  if (isSelect) {
    return [db.prepare(sql).all(...arr)];
  }
  const result = db.prepare(sql).run(...arr);
  return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }];
}

// 获取原始 db 实例供事务使用
function getDb() {
  return db;
}

module.exports = { query, getDb };
