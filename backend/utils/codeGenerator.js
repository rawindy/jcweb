const dayjs = require('dayjs');
const { query } = require('../config/db');

function generateEntrustNo(categoryCode) {
  const year = dayjs().format('YYYY');
  const prefix = `${categoryCode}${year}`;
  const [rows] = query(
    `SELECT MAX(entrust_no) AS max_no FROM biz_entrust
     WHERE category_code = ? AND entrust_no LIKE ?`,
    [categoryCode, `${prefix}%`]
  );
  const maxNo = rows[0]?.max_no;
  let seq = 1;
  if (maxNo) {
    seq = parseInt(maxNo.replace(prefix, ''), 10) + 1;
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

function generateProjectNo() {
  const [rows] = query(
    `SELECT MAX(project_no) AS max_no FROM biz_project`
  );
  const maxNo = rows[0]?.max_no;
  let seq = 1;
  if (maxNo) {
    seq = parseInt(maxNo, 10) + 1;
  }
  return String(seq).padStart(5, '0');
}

function generateSampleNos(entrustNo, count) {
  const [rows] = query(
    `SELECT MAX(sample_no) AS max_no FROM biz_original_record_item
     WHERE sample_no LIKE ?`,
    [`${entrustNo}-%`]
  );
  const maxNo = rows[0]?.max_no;
  let startSeq = 1;
  if (maxNo) {
    startSeq = parseInt(maxNo.replace(`${entrustNo}-`, ''), 10) + 1;
  }
  const nos = [];
  for (let i = 0; i < count; i++) {
    nos.push(`${entrustNo}-${String(startSeq + i).padStart(3, '0')}`);
  }
  return nos;
}

module.exports = { generateEntrustNo, generateProjectNo, generateSampleNos };
