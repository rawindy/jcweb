const { query, getDb } = require('../config/db');
const { generateEntrustNo } = require('../utils/codeGenerator');

exports.list = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, category_code } = req.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const params = [];
    if (category_code) {
      where += ' AND e.category_code = ?';
      params.push(category_code);
    }

    const [countResult] = query(
      `SELECT COUNT(*) AS total FROM biz_entrust e ${where}`, params
    );
    const total = countResult[0].total;

    const [rows] = query(
      `SELECT e.*, p.project_no, p.project_name, p.client_unit, p.client_person, p.supervision_unit, p.witness_person, p.construction_unit, p.build_unit,
              (SELECT COALESCE(SUM(group_count), 0) FROM biz_compaction_item WHERE entrust_id = e.id) AS total_groups
       FROM biz_entrust e
       LEFT JOIN biz_project p ON e.project_id = p.id
       ${where}
       ORDER BY e.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    res.json({ code: 200, data: { list: rows, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.create = async (req, res) => {
  try {
    const db = getDb();
    const { category_code, entrust_type, project_id, entrust_date, items = [], remark } = req.body;
    const entrust_no = generateEntrustNo(category_code);

    const createEntrust = db.transaction(() => {
      const [result] = query(
        `INSERT INTO biz_entrust (entrust_no, category_code, entrust_type, project_id, entrust_date, remark, create_time, update_time)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
        [entrust_no, category_code, entrust_type, project_id || null, entrust_date, remark || null]
      );
      const entrustId = result.insertId;

      if (category_code === 'SYS') {
        for (const item of items) {
          query(
            `INSERT INTO biz_compaction_item (entrust_id, position_name, group_count, material, design_requirement, design_operator, design_tolerance, sort)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [entrustId, item.position_name, item.group_count, item.material, item.design_requirement || 90, item.design_operator || '≥', item.design_tolerance || null, item.sort || 1]
          );
        }
      } else if (category_code === 'STJ') {
        if (items.length > 0) {
          query(
            `INSERT INTO biz_proctor_item (entrust_id, material, test_method) VALUES (?, ?, ?)`,
            [entrustId, items[0].material, items[0].test_method]
          );
        }
      } else if (category_code === 'SWC') {
        for (const item of items) {
          query(
            `INSERT INTO biz_deflection_item (entrust_id, position_name, design_requirement) VALUES (?, ?, ?)`,
            [entrustId, item.position_name, item.design_requirement]
          );
        }
      }

      return entrustId;
    });

    const entrustId = createEntrust();
    res.json({ code: 200, data: { id: entrustId, entrust_no }, message: '委托录入成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.detail = async (req, res) => {
  try {
    const { id } = req.params;
    const [entrusts] = query(
      `SELECT e.*, p.project_no, p.project_name, p.client_unit, p.client_person,
              p.supervision_unit, p.witness_person, p.construction_unit, p.build_unit
       FROM biz_entrust e
       LEFT JOIN biz_project p ON e.project_id = p.id
       WHERE e.id = ?`, [id]
    );
    if (entrusts.length === 0) {
      return res.status(404).json({ code: 404, message: '委托单不存在' });
    }
    const entrust = entrusts[0];

    let items = [];
    if (entrust.category_code === 'SYS') {
      const [rows] = query('SELECT * FROM biz_compaction_item WHERE entrust_id = ? ORDER BY sort', [id]);
      items = rows;
    } else if (entrust.category_code === 'STJ') {
      const [rows] = query('SELECT * FROM biz_proctor_item WHERE entrust_id = ?', [id]);
      items = rows;
    } else if (entrust.category_code === 'SWC') {
      const [rows] = query('SELECT * FROM biz_deflection_item WHERE entrust_id = ?', [id]);
      items = rows;
    }

    res.json({ code: 200, data: { ...entrust, items } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.update = async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { entrust_no, project_id, entrust_date, items = [], remark } = req.body;

    const doUpdate = db.transaction(() => {
      const [rows] = query('SELECT * FROM biz_entrust WHERE id = ?', [id]);
      const categoryCode = rows[0].category_code;

      if (categoryCode === 'SYS') {
        query('DELETE FROM biz_compaction_item WHERE entrust_id = ?', [id]);
      } else if (categoryCode === 'STJ') {
        query('DELETE FROM biz_proctor_item WHERE entrust_id = ?', [id]);
      } else if (categoryCode === 'SWC') {
        query('DELETE FROM biz_deflection_item WHERE entrust_id = ?', [id]);
      }

      if (categoryCode === 'SYS') {
        for (const item of items) {
          query(
            `INSERT INTO biz_compaction_item (entrust_id, position_name, group_count, material, design_requirement, design_operator, design_tolerance, sort)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, item.position_name, item.group_count, item.material, item.design_requirement || 90, item.design_operator || '≥', item.design_tolerance || null, item.sort || 1]
          );
        }
      } else if (categoryCode === 'STJ') {
        if (items.length > 0) {
          query(
            `INSERT INTO biz_proctor_item (entrust_id, material, test_method) VALUES (?, ?, ?)`,
            [id, items[0].material, items[0].test_method]
          );
        }
      } else if (categoryCode === 'SWC') {
        for (const item of items) {
          query(
            `INSERT INTO biz_deflection_item (entrust_id, position_name, design_requirement) VALUES (?, ?)`,
            [id, item.position_name, item.design_requirement]
          );
        }
      }

      query(
        "UPDATE biz_entrust SET entrust_no=?, project_id=?, entrust_date=?, remark=?, update_time=datetime('now','localtime') WHERE id=?",
        [entrust_no || rows[0].entrust_no, project_id || null, entrust_date, remark || null, id]
      );
    });

    doUpdate();
    res.json({ code: 200, message: '更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.del = async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const doDelete = db.transaction(() => {
      const [rows] = query('SELECT category_code FROM biz_entrust WHERE id = ?', [id]);
      if (rows.length === 0) throw new Error('NOT_FOUND');
      const categoryCode = rows[0].category_code;

      // 级联删除原始记录
      const [records] = query('SELECT id FROM biz_original_record WHERE entrust_id = ?', [id]);
      for (const rec of records) {
        query('DELETE FROM biz_original_record_item WHERE record_id = ?', [rec.id]);
      }
      query('DELETE FROM biz_original_record WHERE entrust_id = ?', [id]);

      if (categoryCode === 'SYS') {
        query('DELETE FROM biz_compaction_item WHERE entrust_id = ?', [id]);
      } else if (categoryCode === 'STJ') {
        query('DELETE FROM biz_proctor_item WHERE entrust_id = ?', [id]);
      } else if (categoryCode === 'SWC') {
        query('DELETE FROM biz_deflection_item WHERE entrust_id = ?', [id]);
      }
      query('DELETE FROM biz_entrust WHERE id = ?', [id]);
    });

    try {
      doDelete();
      res.json({ code: 200, message: '删除成功' });
    } catch (e) {
      if (e.message === 'NOT_FOUND') {
        return res.status(404).json({ code: 404, message: '委托单不存在' });
      }
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};
