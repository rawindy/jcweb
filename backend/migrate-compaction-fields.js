// 迁移: biz_compaction_item 添加 design_operator 和 design_tolerance 列
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'data', 'jcweb.db');
console.log('数据库路径:', dbPath);

const db = new Database(dbPath);

// 检查列是否存在
const cols = db.pragma('table_info(biz_compaction_item)');
const colNames = cols.map(c => c.name);
console.log('当前列:', colNames.join(', '));

// 添加 design_operator
if (!colNames.includes('design_operator')) {
  console.log('添加 design_operator 列...');
  db.exec("ALTER TABLE biz_compaction_item ADD COLUMN design_operator VARCHAR(5) DEFAULT '≥'");
} else {
  console.log('design_operator 已存在，跳过');
}

// 添加 design_tolerance
if (!colNames.includes('design_tolerance')) {
  console.log('添加 design_tolerance 列...');
  db.exec('ALTER TABLE biz_compaction_item ADD COLUMN design_tolerance DECIMAL DEFAULT NULL');
} else {
  console.log('design_tolerance 已存在，跳过');
}

// 验证
const cols2 = db.pragma('table_info(biz_compaction_item)');
console.log('迁移后列:', cols2.map(c => c.name).join(', '));
console.log('迁移完成');

db.close();
