/**
 * 添加仪器库表
 * 运行: node sql/migrate-instrument.js
 */
const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'data', 'jcweb.db'));
db.pragma('journal_mode = WAL');

console.log('创建 sys_instrument 表...');
db.exec(`CREATE TABLE IF NOT EXISTS sys_instrument (
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

// 检查是否已有白搪瓷盒数据
const count = db.prepare("SELECT COUNT(*) as cnt FROM sys_instrument WHERE category = '白搪瓷盒'").get();
if (count.cnt === 0) {
  console.log('插入白搪瓷盒数据...');
  const boxMasses = [380, 375, 371, 364, 372, 368, 388, 359, 376, 377, 368, 369, 367, 382, 374, 375, 389, 392, 369, 388, 380];
  const insert = db.prepare("INSERT INTO sys_instrument (category, code, mass) VALUES ('白搪瓷盒', ?, ?)");
  for (let i = 0; i < boxMasses.length; i++) {
    insert.run(String(i + 1), boxMasses[i]);
  }
  console.log(`已插入 ${boxMasses.length} 个白搪瓷盒`);
} else {
  console.log(`白搪瓷盒数据已存在（${count.cnt} 条），跳过`);
}

console.log('迁移完成');
db.close();
