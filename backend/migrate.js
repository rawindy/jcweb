const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'data', 'jcweb.db'));
try {
  db.exec('ALTER TABLE biz_original_record ADD COLUMN remark TEXT DEFAULT NULL');
  console.log('Added remark column to biz_original_record');
} catch(e) {
  console.log('Column remark already exists or error:', e.message);
}
db.close();
