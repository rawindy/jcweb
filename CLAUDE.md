# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

市政工程检测业务系统 — 管理建筑材料检测流程（压实度、击实、弯沉），支持委托录入、原始记录录入、检测报告打印和 PDF 报告生成。

## 技术栈

- **后端**: Express.js + better-sqlite3 (SQLite)，JWT 认证
- **前端**: Vue 3 + Vite + Element Plus + Pinia + Vue Router
- **PDF 生成**: docx 模板 + pizzip XML 直接编辑 / LibreOffice headless 转 PDF

## 常用命令

```bash
# 后端
cd backend && npm run dev          # 启动后端（nodemon，端口 3000）
cd backend && node app.js          # 生产启动
cd backend && node init-sqlite.js  # 初始化数据库表结构
cd backend && node migrate-report.js # 执行报告相关字段迁移

# 前端
cd frontend && npm run dev          # 启动前端（端口 6002，API 代理到 localhost:3000）
cd frontend && npm run build       # 构建生产版本
```

## .env 配置

```env
PORT=3000                 # 后端端口
JWT_SECRET=xxx            # JWT 签名密钥
JWT_EXPIRES_IN=24h        # Token 有效期
# PDF 转换器已统一为 LibreOffice
ROUNDING_MODE=bankers     # 数值修约：bankers（四舍六入五成双）| standard（标准四舍五入）
```

## 架构要点

### 数据库层 (`backend/config/db.js`)

使用 better-sqlite3，封装了 `query()` 函数模拟 mysql2 返回格式（返回 `[rows]` 数组）。`getDb()` 返回原始 db 实例供事务使用。SQLite 文件位于 `backend/data/jcweb.db`，启用 WAL 模式和外键约束。

**表结构初始化**: `backend/init-sqlite.js` 创建所有表（含初始用户 admin/123456）。
**迁移**: `backend/migrate-report.js` 用于报告功能相关的字段增量迁移。

### 编号生成 (`backend/utils/codeGenerator.js`)

- **委托编号**: `{类别号}{年份}{5位流水}`，如 `SYS202600001`
- **工程编号**: `{5位流水}`，如 `00001`
- **样品编号**: `{委托编号}-{3位流水}`，如 `SYS202600001-001`

均通过查询数据库当前最大值 + 1 生成。

### 检测类别（category_code）

| 代码 | 名称 | 明细表 | 局部类型 |
|------|------|--------|---------|
| SYS  | 压实度 | `biz_compaction_item`（部位、组数、材料、设计要求、运算符、公差） | `entrust_type`：道路 / 管道 |

委托创建/更新时根据 category_code 写入对应的明细表。设计要求支持 `design_requirement`（目标值）、`design_operator`（`≥`/`≤`/`=`/`±`）、`design_tolerance`（公差，仅 `±` 时使用），显示格式：`≥90%` 或 `90%±2%`。

### 数值修约 — 四舍六入五成双 (`backend/utils/rounding.js`)

规则：四舍（1-4 舍）、六入（6-9 入）、五成双（5 看前一位奇偶，奇进偶舍）。前后端各有一份独立实现（`frontend/src/utils/rounding.js`），通过 `ROUNDING_MODE` 环境变量控制，默认启用。压实度计算、干密度计算均使用此规则修约到指定小数位。

### 原始记录 (`backend/controllers/recordController.js`)

- `getRecords`: 首次访问时根据委托的组数自动生成样品编号和空白行（每页 9 行），之后从 `biz_original_record` + `biz_original_record_item` 读取已保存数据
- `updateRows`: 全量替换保存（先删后插，在事务中执行），保存时通过 `utils/compaction.js` 的 `injectComputedValues()` 自动计算并注入干密度和压实度
- **打印（异步）**: 同样支持 `startPrint` / `printStatus` / `printDownload` 异步任务模式，生成原始记录单 PDF

### 检测报告 (`backend/controllers/reportController.js`)

独立于原始记录的报告生成模块，生成包含封面页 + 信息页 + 数据页的完整检测报告。

- **模板组装**: 从三个独立 DOCX 模板（封面页、信息页、数据页）提取 body 内容，拼接为一个完整 DOCX，统一 sectPr
- **数据填充**: 使用 `fillCellAfter()`（表格中标签后单元格填充）和 `fillCoverPage()`（封面段落值替换）直接编辑 DOCX 内部 XML
- **多页支持**: 数据表按每页 9 行自动分页，每页独立生成页码（封面不编页码，信息页第 1 页）
- **异步打印**: `startPrint` → `printStatus`（轮询进度）→ `printDownload`（下载合并后的 PDF）
- **报告抬头保存**: `saveReportData` 将用户修改的工程信息/检测依据/设备/结论等回写到 `biz_entrust`、`biz_project` 和记录单 remark JSON

### PDF 生成方案

两种 PDF 生成路径：

1. **原始记录单**（DOCX 模板 + 数据填充 → PDF）: 
   - 模板: `temp/压实度（道路）（灌砂法）检测原始记录单.docx` / `temp/压实度（管道）（灌砂法）检测原始记录单.docx`
   - 使用 pizzip 编辑 docx 内部 XML → zip 重打包 → 转换 PDF
2. **检测报告**（三合一模板组装 → PDF）:
   - 模板: `temp/检测报告封面页.docx` + `info页` + `data页`
   - 方式同上

转换层 (`backend/utils/pdfConverter.js`):
- 统一使用 LibreOffice headless 转换 docx → PDF
- 优先查找 `tools/LibreOffice/` 本地便携版，找不到则使用系统 `soffice`
- `batchDocxToPdf()` 支持批量转换

### DOCX 排版规范

DOCX 模板数据填入时必须遵循（来自项目反馈）：
- 中文: **宋体** (`w:eastAsia="宋体"`)
- 英文/数字/符号: **Times New Roman** (`w:ascii="Times New Roman" w:hAnsi="Times New Roman"`)
- 表格数据: **水平居中** (`<w:jc w:val="center"/>`)
- 全局修复: 报告生成时会将 Word 自动误写的 `w:ascii="宋体"` 替换为 Times New Roman

### 仪器库 (`backend/routes/instrument.js`)

管理检测仪器（灌砂筒、电子秤、烘箱等），表 `sys_instrument` 自动创建。按类别+编号唯一约束，支持按类别+编号查找。前端在原始记录录入中选择关联仪器。

### 前端路由与权限

路由守卫在 `router/index.js`：非登录页需要 token，已登录访问 /login 会重定向到 /。后端除 `/api/auth/login` 外所有接口都需要 JWT（在 `routes/*.js` 中通过 `router.use(auth)` 全局应用）。

### 前端架构

- **Element Plus 自动导入**: `unplugin-auto-import` + `unplugin-vue-components`，Element Plus 组件和 API（如 `ElMessage`）无需手动 import
- **Axios 实例** (`api/index.js`): baseURL 为 `/api`，超时 15s。请求拦截器自动附加 JWT token，响应拦截器统一处理错误
- **Vite 代理**: 前端 6002 端口，`/api` 代理到 `http://localhost:3000`

### API 响应格式与异步任务模式

统一格式 `{ code: 200, data: ..., message: ... }`。前端 axios 拦截器在 `code !== 200` 时自动弹出错误提示，401 时清除 token 并跳转登录页。

异步 PDF 生成均采用 **taskId 模式**：发起 → 返回 taskId → 前端轮询状态 → 下载 PDF。任务在内存中存储，5 分钟清理一次过期任务。
