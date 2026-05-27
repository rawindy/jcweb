const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'data', 'jcweb.db'));

const migrations = [
  "ALTER TABLE biz_entrust ADD COLUMN report_date TEXT DEFAULT NULL",
  "ALTER TABLE biz_entrust ADD COLUMN sampling_date TEXT DEFAULT NULL",
  "ALTER TABLE biz_entrust ADD COLUMN section_pile TEXT DEFAULT NULL",
];

for (const sql of migrations) {
  try {
    db.exec(sql);
    console.log('OK:', sql);
  } catch (e) {
    console.log('SKIP:', e.message);
  }
}

console.log('\n迁移完成');
db.close();
