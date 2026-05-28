/**
 * SQLite 数据库初始化脚本
 * 运行: node init-sqlite.js
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'jcweb.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('创建数据库表结构...');

db.exec(`
-- 系统管理模块
CREATE TABLE IF NOT EXISTS sys_user (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  real_name   TEXT DEFAULT NULL,
  dept_id     INTEGER DEFAULT NULL,
  phone       TEXT DEFAULT NULL,
  email       TEXT DEFAULT NULL,
  avatar      TEXT DEFAULT NULL,
  status      INTEGER NOT NULL DEFAULT 1,
  create_time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT DEFAULT (datetime('now','localtime')),
  remark      TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS sys_role (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name   TEXT NOT NULL,
  role_code   TEXT NOT NULL UNIQUE,
  status      INTEGER NOT NULL DEFAULT 1,
  create_time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT DEFAULT (datetime('now','localtime')),
  remark      TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS sys_menu (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER NOT NULL DEFAULT 0,
  menu_name   TEXT NOT NULL,
  path        TEXT DEFAULT NULL,
  component   TEXT DEFAULT NULL,
  icon        TEXT DEFAULT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  menu_type   TEXT NOT NULL DEFAULT 'C',
  permission  TEXT DEFAULT NULL,
  status      INTEGER NOT NULL DEFAULT 1,
  create_time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sys_user_role (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS sys_role_menu (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  menu_id INTEGER NOT NULL,
  UNIQUE (role_id, menu_id)
);

CREATE TABLE IF NOT EXISTS sys_dept (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id   INTEGER NOT NULL DEFAULT 0,
  dept_name   TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  leader      TEXT DEFAULT NULL,
  phone       TEXT DEFAULT NULL,
  status      INTEGER NOT NULL DEFAULT 1,
  create_time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sys_dict_type (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dict_name   TEXT NOT NULL,
  dict_type   TEXT NOT NULL UNIQUE,
  status      INTEGER NOT NULL DEFAULT 1,
  create_time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT DEFAULT (datetime('now','localtime')),
  remark      TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS sys_dict_data (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  dict_type   TEXT NOT NULL,
  dict_label  TEXT NOT NULL,
  dict_value  TEXT NOT NULL,
  sort        INTEGER NOT NULL DEFAULT 0,
  is_default  INTEGER NOT NULL DEFAULT 0,
  status      INTEGER NOT NULL DEFAULT 1,
  create_time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT DEFAULT (datetime('now','localtime')),
  remark      TEXT DEFAULT NULL
);

-- 仪器库
CREATE TABLE IF NOT EXISTS sys_instrument (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL,
  code        TEXT NOT NULL,
  mass        REAL NOT NULL,
  status      INTEGER NOT NULL DEFAULT 1,
  create_time TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_time TEXT DEFAULT (datetime('now','localtime')),
  remark      TEXT DEFAULT NULL,
  UNIQUE (category, code)
);

-- 业务模块
CREATE TABLE IF NOT EXISTS biz_project (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  project_no          TEXT NOT NULL UNIQUE,
  project_name        TEXT NOT NULL,
  client_unit         TEXT DEFAULT NULL,
  client_person       TEXT DEFAULT NULL,
  supervision_unit    TEXT DEFAULT NULL,
  witness_person      TEXT DEFAULT NULL,
  construction_unit   TEXT DEFAULT NULL,
  build_unit          TEXT DEFAULT NULL,
  status              INTEGER NOT NULL DEFAULT 1,
  create_by           TEXT DEFAULT NULL,
  create_time         TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_by           TEXT DEFAULT NULL,
  update_time         TEXT DEFAULT (datetime('now','localtime')),
  remark              TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS biz_entrust (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  entrust_no      TEXT NOT NULL UNIQUE,
  category_code   TEXT NOT NULL,
  entrust_type    TEXT DEFAULT NULL,
  project_id      INTEGER DEFAULT NULL,
  entrust_date    TEXT DEFAULT NULL,
  report_date     TEXT DEFAULT NULL,
  sampling_date   TEXT DEFAULT NULL,
  section_pile    TEXT DEFAULT NULL,
  total_amount    REAL DEFAULT NULL,
  status          INTEGER NOT NULL DEFAULT 1,
  create_by       TEXT DEFAULT NULL,
  create_time     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_by       TEXT DEFAULT NULL,
  update_time     TEXT DEFAULT (datetime('now','localtime')),
  remark          TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS biz_compaction_item (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  entrust_id          INTEGER NOT NULL,
  position_name       TEXT NOT NULL,
  group_count         INTEGER NOT NULL DEFAULT 1,
  material            TEXT DEFAULT NULL,
  design_requirement  REAL NOT NULL DEFAULT 90.0,
  design_operator     VARCHAR(5) DEFAULT '≥',
  design_tolerance    DECIMAL DEFAULT NULL,
  sort                INTEGER NOT NULL DEFAULT 1,
  remark              TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS biz_proctor_item (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entrust_id  INTEGER NOT NULL,
  material    TEXT NOT NULL,
  test_method TEXT NOT NULL,
  remark      TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS biz_deflection_item (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  entrust_id          INTEGER NOT NULL,
  position_name       TEXT NOT NULL DEFAULT '车道',
  design_requirement  REAL DEFAULT NULL,
  remark              TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS biz_original_record (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entrust_id    INTEGER NOT NULL,
  page_no       INTEGER NOT NULL,
  total_pages   INTEGER NOT NULL DEFAULT 1,
  template_type TEXT NOT NULL,
  header_data   TEXT DEFAULT NULL,
  remark        TEXT DEFAULT NULL,
  create_time   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  update_time   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS biz_original_record_item (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id     INTEGER NOT NULL,
  seq_no        INTEGER NOT NULL,
  sample_no     TEXT NOT NULL,
  position_name TEXT DEFAULT NULL,
  layer         TEXT DEFAULT NULL,
  test_values   TEXT DEFAULT NULL,
  remark        TEXT DEFAULT NULL
);
`);

console.log('插入初始数据...');

// 密码
const adminPass = bcrypt.hashSync('admin123', 10);
const userPass = bcrypt.hashSync('123456', 10);

// 用户
db.prepare('DELETE FROM sys_user').run();
db.prepare(`INSERT INTO sys_user (username, password, real_name, dept_id, phone, email, status) VALUES
  ('admin',    ?, '系统管理员', NULL, '13800000000', 'admin@jcweb.com', 1),
  ('zhangsan', ?, '张三',        2,    '13800000001', NULL,              1),
  ('lisi',     ?, '李四',        3,    '13800000002', NULL,              1)
`).run(adminPass, userPass, userPass);

// 角色
db.prepare('DELETE FROM sys_role').run();
db.prepare(`INSERT INTO sys_role (id, role_name, role_code) VALUES
  (1, '超级管理员', 'super_admin'),
  (2, '检测人员',   'tester'),
  (3, '审核人员',   'reviewer')
`).run();

// 用户-角色
db.prepare('DELETE FROM sys_user_role').run();
db.prepare('INSERT INTO sys_user_role (user_id, role_id) VALUES (1, 1)').run();

// 菜单
db.prepare('DELETE FROM sys_menu').run();
db.prepare(`INSERT INTO sys_menu (id, parent_id, menu_name, path, component, icon, sort, menu_type, permission, status) VALUES
  (1,  0, '系统管理',     '/system',     'layout/Index',  'Setting',        1, 'M', NULL,          1),
  (2,  1, '用户管理',     'user',        'system/User',   'User',           1, 'C', 'system:user', 1),
  (3,  1, '角色管理',     'role',        'system/Role',   'Avatar',         2, 'C', 'system:role', 1),
  (10, 0, '业务管理',     '/biz',        'layout/Index',  'Document',      10, 'M', NULL,          1),
  (11, 10,'工程项目登记', 'project',     'project/List',  'FolderOpened',   1, 'C', 'project:list', 1),
  (12, 10,'委托录入',     'entrust',     'entrust/Create', 'EditPen',        2, 'C', 'entrust:create', 1),
  (13, 10,'原始记录录入', 'record',      'record/Input',  'Tickets',        3, 'C', 'record:input', 1)
`).run();

// 部门
db.prepare('DELETE FROM sys_dept').run();
db.prepare(`INSERT INTO sys_dept (id, parent_id, dept_name, sort, leader) VALUES
  (1, 0, '检测中心',   1, '张主任'),
  (2, 1, '材料检测室', 1, '王科长'),
  (3, 1, '现场检测室', 2, '李科长')
`).run();

// 字典类型
db.prepare('DELETE FROM sys_dict_type').run();
db.prepare(`INSERT INTO sys_dict_type (dict_name, dict_type) VALUES
  ('压实度材料',     'compaction_material'),
  ('管道压实度部位', 'compaction_position_pipe'),
  ('路基压实度部位', 'compaction_position_road'),
  ('击实方式',       'proctor_method'),
  ('委托类别号',     'entrust_category'),
  ('模板类型',       'template_type')
`).run();

// 字典数据
db.prepare('DELETE FROM sys_dict_data').run();
db.prepare(`INSERT INTO sys_dict_data (dict_type, dict_label, dict_value, sort, is_default) VALUES
  ('compaction_material',     '砂',    '砂',   1, 0),
  ('compaction_material',     '石屑',  '石屑', 2, 0),
  ('compaction_material',     '碎石',  '碎石', 3, 0),
  ('compaction_material',     '土',    '土',   4, 0),
  ('compaction_material',     '塘渣',  '塘渣', 5, 0),
  ('compaction_position_pipe','管底',  '管底', 1, 1),
  ('compaction_position_pipe','胸腔',  '胸腔', 2, 1),
  ('compaction_position_pipe','管顶',  '管顶', 3, 1),
  ('compaction_position_road','车道',  '车道', 1, 1),
  ('proctor_method',          '轻型',  '轻型', 1, 1),
  ('proctor_method',          '重型',  '重型', 2, 0),
  ('entrust_category',        '压实度', 'SYS', 1, 0),
  ('entrust_category',        '击实',   'STJ', 2, 0),
  ('entrust_category',        '弯沉',   'SWC', 3, 0),
  ('template_type',           '管道压实度',     'pipe_compaction', 1, 0),
  ('template_type',           '路基压实度(土)',  'roadbed_soil',    2, 0),
  ('template_type',           '路基压实度(砂)',  'roadbed_sand',    3, 0),
  ('template_type',           '路基压实度(塘渣)','roadbed_slag',    4, 0)
`).run();

// 仪器库 - 白搪瓷盒
db.prepare('DELETE FROM sys_instrument').run();
const boxMasses = [380,375,371,364,372,368,388,359,376,377,368,369,367,382,374,375,389,392,369,388,380];
const insertBox = db.prepare("INSERT INTO sys_instrument (category, code, mass) VALUES ('白搪瓷盒', ?, ?)");
for (let i = 0; i < boxMasses.length; i++) {
  insertBox.run(String(i + 1), boxMasses[i]);
}

// 示例工程项目
db.prepare('DELETE FROM biz_project').run();
db.prepare(`INSERT INTO biz_project (project_no, project_name, client_unit, client_person, supervision_unit, witness_person, construction_unit, build_unit) VALUES
  ('00001', '东湖路道路改造工程',   'XX建设工程质量检测中心', '张三', 'XX监理有限公司', '李四', 'XX路桥建设有限公司', 'XX市政管理处'),
  ('00002', '城北综合管廊一期工程', 'XX建设工程质量检测中心', '王五', 'XX监理有限公司', '赵六', 'XX隧道建设有限公司', 'XX城市建设集团')
`).run();

console.log('');
console.log('=== 初始化完成 ===');
console.log('管理员: admin / admin123');
console.log('测试用户: zhangsan / 123456, lisi / 123456');
console.log('数据库文件: ' + path.join(dataDir, 'jcweb.db'));
db.close();
