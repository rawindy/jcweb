const { query } = require('../config/db');
const { generateProjectNo } = require('../utils/codeGenerator');

exports.list = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, field, keyword } = req.query;
    const offset = (page - 1) * pageSize;

    let where = 'WHERE status = 1';
    const params = [];

    const allowedFields = ['project_no', 'project_name', 'client_unit', 'client_person', 'supervision_unit', 'witness_person', 'construction_unit', 'build_unit'];
    if (keyword && field && allowedFields.includes(field)) {
      where += ` AND ${field} LIKE ?`;
      params.push(`%${keyword}%`);
    } else if (keyword) {
      where += ' AND (project_no LIKE ? OR project_name LIKE ? OR client_unit LIKE ? OR client_person LIKE ? OR supervision_unit LIKE ? OR witness_person LIKE ? OR construction_unit LIKE ? OR build_unit LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw, kw, kw, kw, kw, kw);
    }

    const [countResult] = query(`SELECT COUNT(*) AS total FROM biz_project ${where}`, params);
    const total = countResult[0].total;

    const [rows] = query(
      `SELECT * FROM biz_project ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
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
    const { project_name, client_unit, client_person, supervision_unit, witness_person, construction_unit, build_unit, remark } = req.body;
    const project_no = generateProjectNo();
    const [result] = query(
      `INSERT INTO biz_project (project_no, project_name, client_unit, client_person, supervision_unit, witness_person, construction_unit, build_unit, remark, create_time, update_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
      [project_no, project_name, client_unit, client_person, supervision_unit, witness_person, construction_unit, build_unit, remark || null]
    );
    res.json({ code: 200, data: { id: result.insertId, project_no }, message: '创建成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { project_no, project_name, client_unit, client_person, supervision_unit, witness_person, construction_unit, build_unit, remark } = req.body;
    query(
      `UPDATE biz_project SET project_no=?, project_name=?, client_unit=?, client_person=?, supervision_unit=?, witness_person=?, construction_unit=?, build_unit=?, remark=?, update_time=datetime('now','localtime')
       WHERE id=?`,
      [project_no, project_name, client_unit, client_person, supervision_unit, witness_person, construction_unit, build_unit, remark || null, id]
    );
    res.json({ code: 200, message: '更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    query("UPDATE biz_project SET status=0, update_time=datetime('now','localtime') WHERE id=?", [id]);
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.getByNo = async (req, res) => {
  try {
    const { project_no } = req.params;
    const [rows] = query('SELECT * FROM biz_project WHERE project_no = ? AND status = 1', [project_no]);
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: '未找到该项目' });
    }
    res.json({ code: 200, data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.search = async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return res.json({ code: 200, data: [] });
    }
    const [rows] = query(
      `SELECT id, project_no, project_name, client_unit, client_person, supervision_unit, witness_person, construction_unit, build_unit
       FROM biz_project WHERE status = 1 AND (project_no LIKE ? OR project_name LIKE ?) LIMIT 10`,
      [`%${keyword}%`, `%${keyword}%`]
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};
