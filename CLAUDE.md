# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

市政工程检测业务系统 — 管理建筑材料检测流程（压实度、击实、弯沉），支持委托录入、原始记录录入和 PDF 报告生成。

## 技术栈

- **后端**: Express.js + better-sqlite3 (SQLite)，JWT 认证
- **前端**: Vue 3 + Vite + Element Plus + Pinia + Vue Router
- **PDF 生成**: docx 模板 + Word COM / LibreOffice headless 转 PDF

## 常用命令

```bash
# 后端
cd backend && npm run dev          # 启动后端（nodemon，端口 3000）
cd backend && node app.js          # 生产启动
cd backend && node sql/seed.js     # 初始化用户密码

# 前端
cd frontend && npm run dev         # 启动前端（端口 6002，API 代理到 localhost:3000）
cd frontend && npm run build       # 构建生产版本
cd frontend && npm run preview     # 预览生产构建
```

## 架构要点

### 数据库层 (`backend/config/db.js`)

使用 better-sqlite3，但封装了 `query()` 函数模拟 mysql2 返回格式（返回 `[rows]` 数组）。`getDb()` 返回原始 db 实例供事务使用。SQLite 文件位于 `backend/data/jcweb.db`。

**注意**: `backend/sql/init.sql` 是参考用的 MySQL 语法 schema，实际运行时 SQLite 会自动适配。如果有表结构变更，直接修改 SQLite 或通过脚本迁移。

### 编号生成 (`backend/utils/codeGenerator.js`)

三类编号均通过查询数据库当前最大值 + 1 生成：
- **委托编号**: `{类别号}{年份}{5位流水}`，如 `SYS202600001`
- **工程编号**: `{5位流水}`，如 `00001`
- **样品编号**: `{委托编号}-{3位流水}`，如 `SYS202600001-001`

### 检测类别（category_code）

| 代码 | 名称 | 明细表 |
|------|------|--------|
| SYS  | 压实度 | `biz_compaction_item`（部位、组数、材料、设计要求、运算符、公差） |

委托创建/更新时根据 category_code 写入不同的明细表，委托查询时也按类别 JOIN 对应的明细表。

设计要求支持格式：
- `design_requirement` (DECIMAL): 目标值，如 90
- `design_operator` (VARCHAR): 运算符 — `≥`（默认）、`≤`、`=`、`±`
- `design_tolerance` (DECIMAL, nullable): 公差值，仅 `±` 时使用
- 显示格式：`≥90%` 或 `90%±2%`
| STJ  | 击实   | `biz_proctor_item`（材料、击实方式） |
| SWC  | 弯沉   | `biz_deflection_item`（部位、设计要求） |

委托创建/更新时根据 category_code 写入不同的明细表，委托查询时也按类别 JOIN 对应的明细表。

### 原始记录 (`backend/controllers/recordController.js`)

- `getRecords`: 首次访问时根据委托的组数自动生成样品编号和空白行（每页 9 行），之后从 `biz_original_record` + `biz_original_record_item` 读取已保存数据
- `updateRows`: 全量替换保存（先删后插，在事务中执行）
- 前端 `Input.vue` 支持从 Excel 直接粘贴批量数据、单元格键盘导航（Enter/Tab）和实时压实度公式计算

### PDF 生成

- **模板**: 
  - `temp/压实度（道路）（灌砂法）检测原始记录单.docx`（道路压实度）
  - `temp/压实度（管道）（灌砂法）检测原始记录单.docx`（管道压实度）
- **方案**: 用 pizzip 编辑 docx 内部 XML → 填充数据 → zip 重打包 → 转为 PDF
- **Windows**: 通过 PowerShell 调用 Word COM 自动化（`$doc.SaveAs([ref] $path, [ref] 17)`）
- **Linux/Docker**: 通过 `libreoffice --headless --convert-to pdf` 转换，优先查找 `tools/LibreOffice/`
- **环境变量**: 设置 `PDF_CONVERTER=libreoffice` 强制使用 LibreOffice（配置在 `backend/.env`）
- **异步打印**: `printPdf` 可能耗时较长，支持异步任务模式——前端调用 `startPrint` 启动任务获取 `taskId`，通过 `printStatus` 轮询进度，完成后用 `printDownload` 下载合并后的 PDF
- **多页处理**: 每页生成独立 PDF，用 pdf-lib 合并后返回
- **转换逻辑**: `backend/utils/pdfConverter.js`

### 前端路由与权限

路由守卫在 `router/index.js`：非登录页需要 token，已登录访问 /login 会重定向到 /。后端除 `/api/auth/login` 外所有接口都需要 JWT（在 `routes/*.js` 中通过 `router.use(auth)` 全局应用）。

### 前端架构

- **Element Plus 自动导入**: 配置了 `unplugin-auto-import` 和 `unplugin-vue-components`，Element Plus 组件和 API（如 `ElMessage`、`ElLoading`）无需手动 import
- **Axios 实例** (`api/index.js`): baseURL 为 `/api`，超时 15s。请求拦截器自动附加 JWT token，响应拦截器统一处理错误（`code !== 200` 弹出错误提示，401 清除 token 跳转登录页，blob/PDF 下载特殊处理）
- **API 模块**: `api/auth.js`、`api/project.js`、`api/entrust.js`、`api/record.js` 各封装对应端点
- **布局** (`layout/Index.vue`): 可折叠侧边栏 + 顶栏（面包屑、动态标题、时钟、用户信息），主体内容区通过 `<router-view>` 渲染

### API 响应格式

统一格式 `{ code: 200, data: ..., message: ... }`。前端 axios 拦截器在 `code !== 200` 时自动弹出错误提示，401 时清除 token 并跳转登录页。
