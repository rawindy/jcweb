-- ============================================
-- 市政工程检测业务系统 - 数据库初始化脚本
-- ============================================

CREATE DATABASE IF NOT EXISTS jcweb DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jcweb;

-- ============================================
-- 一、系统管理模块
-- ============================================

-- 1. 用户表
DROP TABLE IF EXISTS sys_user;
CREATE TABLE sys_user (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE COMMENT '用户名',
  password    VARCHAR(200) NOT NULL COMMENT '密码(bcrypt)',
  real_name   VARCHAR(50)  DEFAULT NULL COMMENT '真实姓名',
  dept_id     INT          DEFAULT NULL COMMENT '部门ID',
  phone       VARCHAR(20)  DEFAULT NULL COMMENT '手机号',
  email       VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
  avatar      VARCHAR(200) DEFAULT NULL COMMENT '头像URL',
  status      TINYINT      NOT NULL DEFAULT 1 COMMENT '0-禁用 1-启用',
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  update_time DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  remark      VARCHAR(500) DEFAULT NULL COMMENT '备注'
) COMMENT '用户表';

-- 2. 角色表
DROP TABLE IF EXISTS sys_role;
CREATE TABLE sys_role (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  role_name   VARCHAR(50)  NOT NULL COMMENT '角色名称',
  role_code   VARCHAR(50)  NOT NULL UNIQUE COMMENT '角色标识',
  status      TINYINT      NOT NULL DEFAULT 1 COMMENT '0-禁用 1-启用',
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  remark      VARCHAR(200) DEFAULT NULL
) COMMENT '角色表';

-- 3. 菜单表
DROP TABLE IF EXISTS sys_menu;
CREATE TABLE sys_menu (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  parent_id   INT          NOT NULL DEFAULT 0 COMMENT '父菜单ID',
  menu_name   VARCHAR(50)  NOT NULL COMMENT '菜单名称',
  path        VARCHAR(200) DEFAULT NULL COMMENT '路由path',
  component   VARCHAR(200) DEFAULT NULL COMMENT '组件路径',
  icon        VARCHAR(50)  DEFAULT NULL COMMENT '图标',
  sort        INT          NOT NULL DEFAULT 0 COMMENT '排序',
  menu_type   CHAR(1)      NOT NULL DEFAULT 'C' COMMENT 'M-目录 C-菜单 F-按钮',
  permission  VARCHAR(100) DEFAULT NULL COMMENT '权限标识',
  status      TINYINT      NOT NULL DEFAULT 1 COMMENT '0-禁用 1-启用',
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT '菜单表';

-- 4. 用户-角色关联表
DROP TABLE IF EXISTS sys_user_role;
CREATE TABLE sys_user_role (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  role_id INT NOT NULL,
  UNIQUE KEY uk_user_role (user_id, role_id)
) COMMENT '用户角色关联表';

-- 5. 角色-菜单关联表
DROP TABLE IF EXISTS sys_role_menu;
CREATE TABLE sys_role_menu (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  menu_id INT NOT NULL,
  UNIQUE KEY uk_role_menu (role_id, menu_id)
) COMMENT '角色菜单关联表';

-- 6. 部门表
DROP TABLE IF EXISTS sys_dept;
CREATE TABLE sys_dept (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  parent_id   INT          NOT NULL DEFAULT 0 COMMENT '父部门ID',
  dept_name   VARCHAR(50)  NOT NULL COMMENT '部门名称',
  sort        INT          NOT NULL DEFAULT 0 COMMENT '排序',
  leader      VARCHAR(50)  DEFAULT NULL COMMENT '负责人',
  phone       VARCHAR(20)  DEFAULT NULL COMMENT '联系电话',
  status      TINYINT      NOT NULL DEFAULT 1 COMMENT '0-禁用 1-启用',
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) COMMENT '部门表';

-- 7. 字典类型表
DROP TABLE IF EXISTS sys_dict_type;
CREATE TABLE sys_dict_type (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  dict_name   VARCHAR(100) NOT NULL COMMENT '字典名称',
  dict_type   VARCHAR(50)  NOT NULL UNIQUE COMMENT '字典类型标识',
  status      TINYINT      NOT NULL DEFAULT 1 COMMENT '0-禁用 1-启用',
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  remark      VARCHAR(200) DEFAULT NULL
) COMMENT '字典类型表';

-- 8. 字典数据表
DROP TABLE IF EXISTS sys_dict_data;
CREATE TABLE sys_dict_data (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  dict_type   VARCHAR(50)  NOT NULL COMMENT '字典类型标识',
  dict_label  VARCHAR(100) NOT NULL COMMENT '字典标签',
  dict_value  VARCHAR(100) NOT NULL COMMENT '字典值',
  sort        INT          NOT NULL DEFAULT 0 COMMENT '排序',
  is_default  TINYINT      NOT NULL DEFAULT 0 COMMENT '是否默认 0-否 1-是',
  status      TINYINT      NOT NULL DEFAULT 1 COMMENT '0-禁用 1-启用',
  create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  remark      VARCHAR(200) DEFAULT NULL
) COMMENT '字典数据表';

-- ============================================
-- 二、业务模块
-- ============================================

-- 9. 工程项目表
DROP TABLE IF EXISTS biz_project;
CREATE TABLE biz_project (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  project_no          VARCHAR(10)  NOT NULL UNIQUE COMMENT '工程编号(00001起)',
  project_name        VARCHAR(200) NOT NULL COMMENT '工程名称',
  client_unit         VARCHAR(200) DEFAULT NULL COMMENT '委托单位',
  client_person       VARCHAR(50)  DEFAULT NULL COMMENT '委托人',
  supervision_unit    VARCHAR(200) DEFAULT NULL COMMENT '监理单位',
  witness_person      VARCHAR(50)  DEFAULT NULL COMMENT '见证人',
  construction_unit   VARCHAR(200) DEFAULT NULL COMMENT '施工单位',
  build_unit          VARCHAR(200) DEFAULT NULL COMMENT '建设单位',
  status              TINYINT      NOT NULL DEFAULT 1 COMMENT '0-禁用 1-正常',
  create_by           VARCHAR(50)  DEFAULT NULL COMMENT '创建人',
  create_time         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by           VARCHAR(50)  DEFAULT NULL COMMENT '更新人',
  update_time         DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  remark              VARCHAR(500) DEFAULT NULL COMMENT '备注'
) COMMENT '工程项目表';

-- 10. 委托单表
DROP TABLE IF EXISTS biz_entrust;
CREATE TABLE biz_entrust (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  entrust_no      VARCHAR(20)  NOT NULL UNIQUE COMMENT '委托编号(SYS/STJ/SWC+YYYY+5位流水)',
  category_code   VARCHAR(5)   NOT NULL COMMENT '类别号(SYS/STJ/SWC)',
  entrust_type    VARCHAR(20)  DEFAULT NULL COMMENT '委托类型(管道压实度/路基压实度/击实/弯沉)',
  project_id      INT          DEFAULT NULL COMMENT '关联工程项目',
  entrust_date    DATE         DEFAULT NULL COMMENT '委托日期',
  total_amount    DECIMAL(10,2) DEFAULT NULL COMMENT '总金额',
  status          TINYINT      NOT NULL DEFAULT 1 COMMENT '0-草稿 1-已确认',
  create_by       VARCHAR(50)  DEFAULT NULL,
  create_time     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_by       VARCHAR(50)  DEFAULT NULL,
  update_time     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  remark          VARCHAR(500) DEFAULT NULL,
  KEY idx_project (project_id)
) COMMENT '委托单表';

-- 11. 压实度委托明细表
DROP TABLE IF EXISTS biz_compaction_item;
CREATE TABLE biz_compaction_item (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  entrust_id          INT           NOT NULL COMMENT '委托单ID',
  position_name       VARCHAR(100)  NOT NULL COMMENT '检测部位',
  group_count         INT           NOT NULL DEFAULT 1 COMMENT '检测组数',
  material            VARCHAR(50)   DEFAULT NULL COMMENT '材料',
  design_requirement  DECIMAL(5,1)  NOT NULL DEFAULT 90.0 COMMENT '设计要求',
  sort                INT           NOT NULL DEFAULT 1 COMMENT '排序',
  remark              VARCHAR(200)  DEFAULT NULL,
  KEY idx_entrust (entrust_id)
) COMMENT '压实度委托明细表';

-- 12. 击实委托详情表
DROP TABLE IF EXISTS biz_proctor_item;
CREATE TABLE biz_proctor_item (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  entrust_id  INT          NOT NULL COMMENT '委托单ID',
  material    VARCHAR(50)  NOT NULL COMMENT '材料',
  test_method VARCHAR(10)  NOT NULL COMMENT '击实方式(轻型/重型)',
  remark      VARCHAR(200) DEFAULT NULL,
  KEY idx_entrust (entrust_id)
) COMMENT '击实委托详情表';

-- 13. 弯沉委托详情表
DROP TABLE IF EXISTS biz_deflection_item;
CREATE TABLE biz_deflection_item (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  entrust_id          INT           NOT NULL COMMENT '委托单ID',
  position_name       VARCHAR(100)  NOT NULL DEFAULT '车道' COMMENT '检测部位',
  design_requirement  DECIMAL(6,1)  DEFAULT NULL COMMENT '设计要求(mm)',
  remark              VARCHAR(200)  DEFAULT NULL,
  KEY idx_entrust (entrust_id)
) COMMENT '弯沉委托详情表';

-- 14. 原始记录表（按页存储）
DROP TABLE IF EXISTS biz_original_record;
CREATE TABLE biz_original_record (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  entrust_id    INT          NOT NULL COMMENT '委托单ID',
  page_no       INT          NOT NULL COMMENT '当前页码',
  total_pages   INT          NOT NULL DEFAULT 1 COMMENT '总页数',
  template_type VARCHAR(30)  NOT NULL COMMENT '模板类型',
  header_data   JSON         DEFAULT NULL COMMENT '抬头信息(JSON)',
  create_time   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_entrust (entrust_id)
) COMMENT '原始记录表';

-- 15. 原始记录明细行表
DROP TABLE IF EXISTS biz_original_record_item;
CREATE TABLE biz_original_record_item (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  record_id     INT          NOT NULL COMMENT '原始记录页ID',
  seq_no        INT          NOT NULL COMMENT '页内序号(1~9)',
  sample_no     VARCHAR(25)  NOT NULL COMMENT '编号',
  position_name VARCHAR(100) DEFAULT NULL COMMENT '检测部位',
  layer         VARCHAR(50)  DEFAULT NULL COMMENT '层次',
  test_values   JSON         DEFAULT NULL COMMENT '检测数据(JSON)',
  remark        VARCHAR(200) DEFAULT NULL,
  KEY idx_record (record_id)
) COMMENT '原始记录明细行表';

-- ============================================
-- 三、初始数据
-- ============================================

-- 管理员账号: admin (密码由 seed.js 脚本初始化)
INSERT INTO sys_user (username, password, real_name, phone, email, status) VALUES
('admin', '$2a$10$PLACEHOLDER_PLEASE_RUN_SEED_JS', '系统管理员', '13800000000', 'admin@jcweb.com', 1);

-- 角色
INSERT INTO sys_role (role_name, role_code) VALUES
('超级管理员', 'super_admin'),
('检测人员', 'tester'),
('审核人员', 'reviewer');

-- 用户-角色关联
INSERT INTO sys_user_role (user_id, role_id) VALUES (1, 1);

-- 菜单
INSERT INTO sys_menu (id, parent_id, menu_name, path, component, icon, sort, menu_type, permission, status) VALUES
(1,  0, '系统管理',     '/system',     'layout/Index',  'Setting',        1, 'M', NULL,          1),
(2,  1, '用户管理',     'user',        'system/User',   'User',           1, 'C', 'system:user', 1),
(3,  1, '角色管理',     'role',        'system/Role',   'Avatar',         2, 'C', 'system:role', 1),
(10, 0, '业务管理',     '/biz',        'layout/Index',  'Document',      10, 'M', NULL,          1),
(11, 10,'工程项目登记', 'project',     'project/List',  'FolderOpened',   1, 'C', 'project:list', 1),
(12, 10,'委托录入',     'entrust',     'entrust/Create', 'EditPen',        2, 'C', 'entrust:create', 1),
(13, 10,'原始记录录入', 'record',      'record/Input',  'Tickets',        3, 'C', 'record:input', 1);

-- 字典类型
INSERT INTO sys_dict_type (dict_name, dict_type) VALUES
('压实度材料',     'compaction_material'),
('管道压实度部位', 'compaction_position_pipe'),
('路基压实度部位', 'compaction_position_road'),
('击实方式',       'proctor_method'),
('委托类别号',     'entrust_category'),
('模板类型',       'template_type');

-- 字典数据
INSERT INTO sys_dict_data (dict_type, dict_label, dict_value, sort, is_default) VALUES
-- 压实度材料
('compaction_material',     '砂',    '砂',   1, 0),
('compaction_material',     '石屑',  '石屑', 2, 0),
('compaction_material',     '碎石',  '碎石', 3, 0),
('compaction_material',     '土',    '土',   4, 0),
('compaction_material',     '塘渣',  '塘渣', 5, 0),
-- 管道压实度部位
('compaction_position_pipe','管底',  '管底', 1, 1),
('compaction_position_pipe','胸腔',  '胸腔', 2, 1),
('compaction_position_pipe','管顶',  '管顶', 3, 1),
-- 路基压实度部位
('compaction_position_road','车道',  '车道', 1, 1),
-- 击实方式
('proctor_method',          '轻型',  '轻型', 1, 1),
('proctor_method',          '重型',  '重型', 2, 0),
-- 委托类别号
('entrust_category',        '压实度', 'SYS', 1, 0),
('entrust_category',        '击实',   'STJ', 2, 0),
('entrust_category',        '弯沉',   'SWC', 3, 0),
-- 模板类型
('template_type',           '管道压实度',     'pipe_compaction', 1, 0),
('template_type',           '路基压实度(土)',  'roadbed_soil',    2, 0),
('template_type',           '路基压实度(砂)',  'roadbed_sand',    3, 0),
('template_type',           '路基压实度(塘渣)','roadbed_slag',    4, 0);

-- 部门和测试用户
INSERT INTO sys_dept (id, parent_id, dept_name, sort, leader) VALUES
(1, 0, '检测中心',   1, '张主任'),
(2, 1, '材料检测室', 1, '王科长'),
(3, 1, '现场检测室', 2, '李科长');

INSERT INTO sys_user (username, password, real_name, dept_id, phone, status) VALUES
('zhangsan', '$2a$10$PLACEHOLDER_PLEASE_RUN_SEED_JS', '张三', 2, '13800000001', 1),
('lisi',     '$2a$10$PLACEHOLDER_PLEASE_RUN_SEED_JS', '李四', 3, '13800000002', 1);

-- ============================================
-- 四、示例数据
-- ============================================

INSERT INTO biz_project (project_no, project_name, client_unit, client_person, supervision_unit, witness_person, construction_unit, build_unit) VALUES
('00001', '东湖路道路改造工程',     'XX建设工程质量检测中心',  '张三', 'XX监理有限公司', '李四', 'XX路桥建设有限公司', 'XX市政管理处'),
('00002', '城北综合管廊一期工程',   'XX建设工程质量检测中心',  '王五', 'XX监理有限公司', '赵六', 'XX隧道建设有限公司', 'XX城市建设集团');

-- ============================================
-- 五、存储过程：重置委托编号（每年年初调用）
-- ============================================

-- 委托编号由应用层生成（查询当年最大号后递增），此处提供手动重置参考。
-- 如需重置 2026 年压实度编号：
-- UPDATE biz_entrust SET entrust_no = CONCAT('SYS', '2026', LPAD(@seq := @seq + 1, 5, '0'))
-- WHERE category_code = 'SYS' AND entrust_no LIKE 'SYS2026%'
-- ORDER BY id;
