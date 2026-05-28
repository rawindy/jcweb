// 检测报告 PDF 生成
const fs = require('fs');
const os = require('os');
const path = require('path');
const PizZip = require('pizzip');
const { getDb } = require('../config/db');
const { fillCoverPage, escXml } = require('../utils/reportCoverPage');
const { batchDocxToPdf } = require('../utils/pdfConverter');
const { calcDryDensity } = require('../utils/compaction');
const { bankersRound } = require('../utils/rounding');

// 内存任务存储（与 recordController 的 printJobs 模式一致）
const reportJobs = new Map();

// 每 5 分钟清理超过 10 分钟的过期任务
setInterval(() => {
  const now = Date.now();
  for (const [taskId, job] of reportJobs) {
    const ts = parseInt(taskId, 36);
    if (!isNaN(ts) && now - ts > 10 * 60 * 1000) {
      if (job.pdfPath) try { fs.unlinkSync(job.pdfPath); } catch {}
      reportJobs.delete(taskId);
    }
  }
}, 5 * 60 * 1000);

function yield_() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// ===== 辅助函数 =====

function fitFontSize(text) {
  let w = 0;
  for (const ch of String(text)) {
    w += /[一-鿿　-〿＀-￯]/.test(ch) ? 2 : 1;
  }
  if (w <= 60) return '21';
  if (w <= 80) return '18';
  if (w <= 100) return '15';
  if (w <= 120) return '13';
  return '12';
}

// 在表格中，找到含 label 的单元格，填充其后第一个空单元格
function fillCellAfter(xml, label, value) {
  const labelIdx = xml.indexOf(label);
  if (labelIdx === -1) return xml;

  const tc1 = xml.lastIndexOf('<w:tc>', labelIdx);
  const tc2 = xml.lastIndexOf('<w:tc ', labelIdx);
  const labelTcStart = Math.max(tc1, tc2);
  if (labelTcStart === -1) return xml;

  const labelTcEnd = xml.indexOf('</w:tc>', labelIdx);
  if (labelTcEnd === -1) return xml;

  const nextTcStart = xml.indexOf('<w:tc', labelTcEnd + '</w:tc>'.length);
  if (nextTcStart === -1) return xml;

  const nextTcEnd = xml.indexOf('</w:tc>', nextTcStart);
  if (nextTcEnd === -1) return xml;

  const tcTagEnd = xml.indexOf('>', nextTcStart);
  let tcContent = xml.substring(tcTagEnd + 1, nextTcEnd);
  tcContent = tcContent.replace(/<w:r[\s>][\s\S]*?<\/w:r>/g, '');
  tcContent = tcContent.replace(/<w:tcW[^>]*\/>/g, '');

  if (value && tcContent.includes('</w:pPr>')) {
    if (/<w:jc\b/.test(tcContent)) {
      tcContent = tcContent.replace(/<w:jc w:val="[^"]*"\/>/g, '<w:jc w:val="center"/>');
    } else {
      tcContent = tcContent.replace('</w:pPr>', '<w:jc w:val="center"/></w:pPr>');
    }
    const sz = fitFontSize(value);
    const newRun = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escXml(value)}</w:t></w:r>`;
    tcContent = tcContent.replace('</w:pPr>', '</w:pPr>' + newRun);
  }

  const actualTcOpen = xml.substring(nextTcStart, tcTagEnd + 1);
  const oldTc = xml.substring(nextTcStart, nextTcEnd + '</w:tc>'.length);
  xml = xml.replace(oldTc, actualTcOpen + tcContent + '</w:tc>');
  return xml;
}

// 构造单个部位的设计要求信息
function makeItemDesign(item) {
  const op = item.design_operator || '≥';
  const dr = item.design_requirement || 90;
  const tol = item.design_tolerance || null;
  const str = op === '±' && tol != null ? `${dr}%±${tol}%` : `${op}${dr}%`;
  return { str, num: dr, operator: op, tolerance: tol };
}

// ===== 数据查询 =====

async function fetchReportData(entrustId) {
  const db = getDb();

  // 委托 + 工程
  const entrust = db.prepare(`
    SELECT e.*, p.project_no, p.project_name, p.client_unit, p.client_person,
           p.supervision_unit, p.witness_person, p.construction_unit, p.build_unit
    FROM biz_entrust e LEFT JOIN biz_project p ON e.project_id = p.id
    WHERE e.id = ?
  `).get(entrustId);
  if (!entrust) throw new Error('委托单不存在');

  // 压实度明细
  const items = db.prepare(
    'SELECT * FROM biz_compaction_item WHERE entrust_id = ? ORDER BY sort'
  ).all(entrustId);

  // 原始记录
  const records = db.prepare(
    'SELECT * FROM biz_original_record WHERE entrust_id = ? ORDER BY page_no'
  ).all(entrustId);

  // 原始记录明细行
  const recordIds = records.map(r => r.id);
  let rows = [];
  if (recordIds.length > 0) {
    const placeholders = recordIds.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT * FROM biz_original_record_item WHERE record_id IN (${placeholders}) ORDER BY record_id, seq_no`
    ).all(...recordIds);
  }

  // 解析 remark 中的 extra 数据
  let extra = {};
  for (const rec of records) {
    try {
      const r = typeof rec.remark === 'string' ? JSON.parse(rec.remark) : (rec.remark || {});
      if (r.max_dry_densities || r.test_basis || r.structure_layer || r.tester || r.design_req) {
        extra = r; break;
      }
    } catch {}
  }

  // 解析每行 test_values
  const parsedRows = rows.map(r => {
    let tv = {};
    try { tv = typeof r.test_values === 'string' ? JSON.parse(r.test_values) : (r.test_values || {}); } catch {}
    return {
      id: r.id, record_id: r.record_id, seq_no: r.seq_no,
      sample_no: r.sample_no,
      position_name: r.position_name || '',
      layer: r.layer || '',
      test_values: tv,
    };
  });

  // 计算总样本数
  const totalSamples = items.reduce((s, i) => s + (i.group_count || 0) * 3, 0);

  // 默认路段桩号
  const dataPages = Math.ceil(totalSamples / ROWS_PER_PAGE);
  const defaultSectionPile = dataPages <= 1
    ? '详见报告第2页'
    : `详见报告第2-${1 + dataPages}页`;

  return { entrust, items, rows: parsedRows, extra, totalSamples, defaultSectionPile };
}

// ===== 模板加载与合并 =====

const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'temp');
const TEMPLATE_COVER = path.join(TEMPLATE_DIR, '检测报告封面页.docx');
const TEMPLATE_INFO = path.join(TEMPLATE_DIR, '检测报告信息页.docx');
const TEMPLATE_DATA = path.join(TEMPLATE_DIR, '检测报告管道详情数据页.docx');
const ROWS_PER_PAGE = 18;

// 从封面 body 中提取底部两段（公司名称 + 地址），返回清理后的 body 和提取的段落 XML
function extractFooterFromCoverBody(bodyXml) {
  const companyText = '余姚市姚州建设工程检测有限公司';
  const idx = bodyXml.indexOf(companyText);
  if (idx === -1) return { body: bodyXml, footerParas: '' };

  // 用正则找真正的段落起始标签 <w:p> 或 <w:p ...>（排除 <w:pPr>）
  const re = /<w:p[>\s]/g;
  let m, pStart = -1;
  while ((m = re.exec(bodyXml)) !== null) {
    if (m.index > idx) break;
    pStart = m.index;
  }
  if (pStart === -1) return { body: bodyXml, footerParas: '' };

  const addressIdx = bodyXml.indexOf('地址：浙江省余姚市胜山路', idx);
  let footerEnd;
  if (addressIdx !== -1) {
    footerEnd = bodyXml.indexOf('</w:p>', addressIdx) + '</w:p>'.length;
  } else {
    footerEnd = bodyXml.indexOf('</w:p>', idx) + '</w:p>'.length;
  }

  const footerParas = bodyXml.substring(pStart, footerEnd);
  const cleanBody = bodyXml.substring(0, pStart) + bodyXml.substring(footerEnd);
  return { body: cleanBody, footerParas };
}

// 将底部段落包装为标准 OOXML 页脚
function buildFooterXml(footerParas) {
  let cleaned = footerParas
    .replace(/w:ascii="宋体"/g, 'w:ascii="Times New Roman"')
    .replace(/w:hAnsi="宋体"/g, 'w:hAnsi="Times New Roman"')
    .replace(/w:hint="eastAsia"/g, '');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
       xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
       mc:Ignorable="w14">
${cleaned}
</w:ftr>`;
}

// 将页脚文件注入 DOCX ZIP（添加文件、更新 Content_Types 和 rels）
function injectFooterToZip(baseZip, footerXml) {
  baseZip.file('word/footer1.xml', footerXml);

  let ct = baseZip.files['[Content_Types].xml'].asText();
  ct = ct.replace('</Types>',
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>');
  baseZip.file('[Content_Types].xml', ct);

  let rels = baseZip.files['word/_rels/document.xml.rels'].asText();
  rels = rels.replace('</Relationships>',
    '<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>');
  baseZip.file('word/_rels/document.xml.rels', rels);
}

// 从 DOCX 提取 body 内容（不含 sectPr）
function extractDocxBody(docxPath) {
  const z = new PizZip(fs.readFileSync(docxPath));
  const x = z.files['word/document.xml'].asText();
  const bodyStart = x.indexOf('<w:body>') + '<w:body>'.length;
  const sectPrStart = x.lastIndexOf('<w:sectPr');
  return x.substring(bodyStart, sectPrStart);
}

// 从 DOCX 提取 sectPr
function extractDocxSectPr(docxPath) {
  const z = new PizZip(fs.readFileSync(docxPath));
  const x = z.files['word/document.xml'].asText();
  const sectPrStart = x.lastIndexOf('<w:sectPr');
  const sectPrEnd = x.indexOf('</w:sectPr>', sectPrStart) + '</w:sectPr>'.length;
  return x.substring(sectPrStart, sectPrEnd);
}

// ===== 报告生成 =====

async function generateReportPdf(entrustId, headerData, taskId) {
  const update = (step, total, msg) => {
    reportJobs.set(taskId, { step, totalSteps: total, message: msg, done: false, error: null, pdfPath: null });
  };

  // Step 1: 查询数据
  update(1, 4, '正在查询数据...');
  await yield_();
  const data = await fetchReportData(entrustId);
  const { entrust, items, rows, extra, totalSamples } = data;
  const entrustNo = entrust.entrust_no;

  // Step 2: 合并模板 + 填充数据
  update(2, 4, '正在生成报告文档...');
  await yield_();

  // 检查模板文件
  if (!fs.existsSync(TEMPLATE_COVER)) throw new Error('封面模板不存在');
  if (!fs.existsSync(TEMPLATE_INFO)) throw new Error('信息页模板不存在');
  if (!fs.existsSync(TEMPLATE_DATA)) throw new Error('数据页模板不存在');

  // 用封面模板作为基础 ZIP（字体、样式等）
  const baseZip = new PizZip(fs.readFileSync(TEMPLATE_COVER));
  let baseXml = baseZip.files['word/document.xml'].asText();

  const coverBody = extractDocxBody(TEMPLATE_COVER);
  const infoBody = extractDocxBody(TEMPLATE_INFO);
  const dataBody = extractDocxBody(TEMPLATE_DATA);
  const sectPr = extractDocxSectPr(TEMPLATE_COVER);

  // 封面 sectPr（无页眉、有页脚、nextPage 分节），嵌入段落作为节分隔符
  const coverSectPr = sectPr
    .replace(/<w:headerReference[^>]*\/>/g, '')
    .replace('<w:pgSz', '<w:type w:val="nextPage"/><w:footerReference w:type="default" r:id="rId10"/><w:pgSz');
  const coverSectionBreak = `<w:p><w:pPr>${coverSectPr}</w:pPr></w:p>`;

  // 计算数据页数（封面不编页码，从信息页开始）
  const dataPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const totalReportPages = 1 + dataPages; // 信息页 + 数据页

  // 封面无页码，信息页 = 第1页
  // 封面 body 中如有页头行则清除，底部两行移入页脚
  const coverBodyClean = removePageHeaderLine(coverBody);
  const { body: coverBodyFinal, footerParas } = extractFooterFromCoverBody(coverBodyClean);
  const footerXml = buildFooterXml(footerParas);
  injectFooterToZip(baseZip, footerXml);

  let infoBodyFilled = fillPageHeaderLine(infoBody, entrustNo, 1, totalReportPages);

  // 组装完整 body：封面 + 节分隔（含页脚引用的 sectPr）+ 信息页 + 数据页
  let allBody = coverBodyFinal + coverSectionBreak + infoBodyFilled;
  for (let i = 0; i < dataPages; i++) {
    let pageBody = fillPageHeaderLine(dataBody, entrustNo, 2 + i, totalReportPages);
    allBody += pageBody;
  }

  // 组装完整 document.xml（末尾 sectPr 用于信息页+数据页，无页脚）
  const docPrologue = baseXml.substring(0, baseXml.indexOf('<w:body>'));
  const docEpilogue = baseXml.substring(baseXml.indexOf('</w:body>') + '</w:body>'.length);

  let xml = docPrologue + '<w:body>' + allBody + sectPr + '</w:body>' + docEpilogue;

  // 全局字体修复
  xml = xml.replace(/w:ascii="宋体"/g, 'w:ascii="Times New Roman"');
  xml = xml.replace(/w:hAnsi="宋体"/g, 'w:hAnsi="Times New Roman"');
  xml = xml.replace(/w:hint="eastAsia"/g, '');

  // === 填充封面 ===
  const categoryNames = { 'SYS': '管道压实度（灌砂法）' };
  xml = fillCoverPage(xml, {
    report_no: entrustNo,
    project_name: headerData.project_name || entrust.project_name || '',
    client_unit: headerData.client_unit || entrust.client_unit || '',
    test_item: headerData.test_item || categoryNames[entrust.category_code] || entrust.entrust_type || '',
    report_date: headerData.report_date || '',
  });

  // === 填充信息页 ===
  // 信息页表格字段（页头已在合并前预填充）
  const infoFields = [
    { label: '工程名称', value: headerData.project_name || entrust.project_name || '' },
    { label: '检测类别', value: headerData.entrust_type || entrust.entrust_type || '' },
    { label: '委托单位', value: headerData.client_unit || entrust.client_unit || '' },
    { label: '建设单位', value: headerData.build_unit || entrust.build_unit || '' },
    { label: '施工单位', value: headerData.construction_unit || entrust.construction_unit || '' },
    { label: '见证单位', value: headerData.supervision_unit || entrust.supervision_unit || '' },
    { label: '检测项目', value: headerData.test_item || categoryNames[entrust.category_code] || '' },
    { label: '见证人', value: headerData.witness_person || entrust.witness_person || '' },
    { label: '样本数量', value: `${totalSamples}点` },
    { label: '取样日期', value: headerData.sampling_date || '' },
    { label: '检测日期', value: headerData.test_date || '' },
    { label: '报告日期', value: headerData.report_date || '' },
    { label: '路段桩号', value: headerData.section_pile || data.defaultSectionPile },
    { label: '结构部位', value: headerData.structure_part || extra.structure_layer || [...new Set(items.map(i => i.position_name).filter(Boolean))].join('、') },
  ];

  for (const { label, value } of infoFields) {
    xml = fillCellAfter(xml, label, value);
  }

  // 检测依据
  const testBasis = headerData.test_basis || extra.test_basis || [];
  const basisMap = {
    'JTG 3450-2019': '《公路路基路面现场测试规程》（JTG 3450—2019）',
    'GB/T 50123-2019': '《土工试验方法标准》（GB/T 50123—2019）',
    'CJJ 1-2008': '《城镇道路工程施工与质量验收规范》（CJJ 1—2008）',
    'GB 50268-2008': '《给水排水管工程施工及验收规范》（GB 50268—2008）',
  };
  const basisText = (Array.isArray(testBasis) ? testBasis : []).map(b => basisMap[b] || b).join('\n');
  xml = fillCellAfter(xml, '检测依据', basisText);

  // 检测设备
  const equipment = headerData.test_equipment || {};
  const sandCylinder = equipment.sand_cylinder || extra.sand_cylinder || '150mm';
  const dryingOvens = equipment.drying_oven || extra.drying_oven || [];
  const ovenList = (Array.isArray(dryingOvens) ? dryingOvens : []).map(code => `电热鼓风干燥箱（${code}）`).join('、');
  const equipText = ovenList
    ? `灌砂筒（${sandCylinder}）（SB143） 电子秤（SB133）${ovenList} 电子秤（SB139）`
    : `灌砂筒（${sandCylinder}）（SB143） 电子秤（SB133） 电子秤（SB139）`;
  xml = fillCellAfter(xml, '检测设备', equipText);

  // 检测结论（报告结论，非记录单结论）
  const dataPageStart = 2;
  const dataPageEnd = 1 + dataPages;
  const pageRef = dataPages <= 1 ? `第${dataPageStart}页` : `第${dataPageStart}-${dataPageEnd}页`;
  const defaultConclusionText = `依据《公路路基路面现场测试规程》（JTG 3450—2019）进行检测，所检测项目结果符合《给水排水管工程施工及验收规范》GB 50268-2008的标准和设计要求。详见报告${pageRef}。`;
  const conclusion = headerData.conclusion || extra.conclusion || defaultConclusionText;
  xml = fillCellAfter(xml, '检测结论', conclusion);

  // 备注 — 最大干密度
  const maxDryDensities = extra.max_dry_densities || {};
  const mdValue = headerData.max_dry_density || (
    Object.keys(maxDryDensities).length > 0
      ? Object.entries(maxDryDensities).filter(([, v]) => v).map(([k, v]) => `${k}：${v} g/cm³`).join('，')
      : ''
  );
  xml = fillCellAfter(xml, '备    注', mdValue ? `最大干密度：${mdValue}` : '');

  // === 填充数据表（多页） ===
  update(3, 4, '正在生成报告文档...');
  // 构建部位 → 设计要求映射
  const positionDesigns = {};
  for (const item of items) {
    positionDesigns[item.position_name] = makeItemDesign(item);
  }
  // 构建 部位→材料 映射（当 test_values 中无 material 时按部位查找）
  const posMaterialMap = {};
  for (const ci of items) { posMaterialMap[ci.position_name] = ci.material; }

  xml = fillAllDataTables(xml, rows, positionDesigns, maxDryDensities, posMaterialMap);

  // 保存 DOCX
  baseZip.file('word/document.xml', xml);
  const tmpDocx = path.join(os.tmpdir(), `report_${entrustId}_${Date.now()}.docx`);
  fs.writeFileSync(tmpDocx, baseZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));

  // Step 4: 转换 PDF
  update(4, 4, '正在转换 PDF...');
  await yield_();
  const tmpPdf = tmpDocx.replace(/\.docx$/, '.pdf');
  await batchDocxToPdf([{ docx: tmpDocx, pdf: tmpPdf }]);

  // 清理并保存
  const finalPdf = path.join(os.tmpdir(), `report_${entrustNo}_${Date.now().toString(36)}.pdf`);
  if (fs.existsSync(tmpPdf)) {
    fs.copyFileSync(tmpPdf, finalPdf);
    try { fs.unlinkSync(tmpPdf); } catch {}
  } else if (fs.existsSync(tmpDocx.replace(/\.docx$/, '.pdf'))) {
    const loPdf = tmpDocx.replace(/\.docx$/, '.pdf');
    fs.copyFileSync(loPdf, finalPdf);
    try { fs.unlinkSync(loPdf); } catch {}
  }
  try { fs.unlinkSync(tmpDocx); } catch {}

  reportJobs.set(taskId, {
    step: 4, totalSteps: 4, message: '生成完成，正在下载...',
    done: true, error: null, pdfPath: finalPdf,
  });
}

// 填充页面头部行（报告编号 + 页码）
// 将包含"报告编号："和"共"的整个段落改写为单 run 格式
function lastParOpen(xml, beforeIdx) {
  let pos = -1;
  const re = /<w:p[\s>]/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m.index > beforeIdx) break;
    pos = m.index;
  }
  return pos;
}

function fillPageHeaderLine(bodyXml, entrustNo, pageNo, totalPages) {
  const gongIdx = bodyXml.indexOf('共');
  if (gongIdx === -1) return bodyXml;

  const pOpen = lastParOpen(bodyXml, gongIdx);
  const pClose = bodyXml.indexOf('</w:p>', gongIdx) + '</w:p>'.length;
  if (pOpen === -1 || pClose < '</w:p>'.length) return bodyXml;

  const escNo = escXml(entrustNo);
  const newP = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:szCs w:val="21"/></w:rPr><w:t xml:space="preserve">报告编号：${escNo}    共 ${totalPages} 页 第 ${pageNo} 页</w:t></w:r></w:p>`;

  return bodyXml.substring(0, pOpen) + newP + bodyXml.substring(pClose);
}

// 移除页面头部行（封面不需要页码）
function removePageHeaderLine(bodyXml) {
  const gongIdx = bodyXml.indexOf('共');
  if (gongIdx === -1) return bodyXml;

  const pOpen = lastParOpen(bodyXml, gongIdx);
  const pClose = bodyXml.indexOf('</w:p>', gongIdx) + '</w:p>'.length;
  if (pOpen === -1 || pClose < '</w:p>'.length) return bodyXml;

  // 检查这个段落是否包含"报告编号"（是页头行才移除）
  if (bodyXml.substring(pOpen, pClose).includes('报告编号')) {
    return bodyXml.substring(0, pOpen) + bodyXml.substring(pClose);
  }
  return bodyXml;
}

// 填充分页的数据表
function fillAllDataTables(xml, rows, positionDesigns, maxDryDensities, posMaterialMap) {
  const dataPages = Math.ceil(rows.length / ROWS_PER_PAGE);

  let searchFrom = 0;
  for (let page = 0; page < dataPages; page++) {
    const pageRows = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    // 整表流水起始序号
    const baseSeq = page * ROWS_PER_PAGE + 1;
    xml = fillOneDataTable(xml, pageRows, positionDesigns, maxDryDensities, baseSeq, searchFrom, posMaterialMap);
    searchFrom = xml.indexOf('</w:tbl>', xml.indexOf('试样编号', searchFrom)) + '</w:tbl>'.length;
    if (searchFrom < '</w:tbl>'.length) searchFrom = 0;
  }

  return xml;
}

// 填充单个数据表（9列：序号|试样编号|取样桩号(vMerge)|取样位置(vMerge,2段)|层位|设计要求|干密度|压实度|单项判定）
function fillOneDataTable(xml, pageRows, positionDesigns, maxDryDensities, baseSeq, startFrom, posMaterialMap) {
  const headerIdx = xml.indexOf('试样编号', startFrom);
  if (headerIdx === -1) return xml;

  const tableStart = xml.lastIndexOf('<w:tbl>', headerIdx);
  const tableEnd = xml.indexOf('</w:tbl>', headerIdx) + '</w:tbl>'.length;
  if (tableStart === -1 || tableEnd < tableStart) return xml;

  let tableXml = xml.substring(tableStart, tableEnd);

  // 收集所有行
  const allTrs = [];
  const trRegex = /<w:tr\b([^>]*)>([\s\S]*?)<\/w:tr>/g;
  let trMatch;
  while ((trMatch = trRegex.exec(tableXml)) !== null) {
    allTrs.push({ full: trMatch[0], content: trMatch[2], attrs: trMatch[1] });
  }

  // 找到表头行
  let headerRowIdx = -1;
  for (let i = 0; i < allTrs.length; i++) {
    if (allTrs[i].content.includes('试样编号')) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return xml;

  // 分离数据行（9列单元格），模板无页底行
  const templateDataRows = [];
  for (let i = headerRowIdx + 1; i < allTrs.length; i++) {
    const cellCount = (allTrs[i].content.match(/<w:tc\b/g) || []).length;
    if (cellCount >= 9) {
      templateDataRows.push(allTrs[i]);
    } else {
      break;
    }
  }

  // 构建行数据，按 3 行一组
  // 查找材料对应的最大干密度
  function getMaxDry(material, position) {
    const mat = material || posMaterialMap[position] || '';
    if (mat && maxDryDensities[mat]) return parseFloat(maxDryDensities[mat]);
    const vals = Object.values(maxDryDensities).filter(Boolean);
    return vals.length > 0 ? parseFloat(vals[0]) : 0;
  }

  const rowData = pageRows.map((rd, i) => {
    const tv = rd.test_values || {};
    const rawPosition = tv.position || rd.position_name || '';

    // 解析桩号中的左右侧标记
    let posName = rawPosition;
    let posSide = '';
    if (rawPosition.endsWith('左侧')) { posName = rawPosition.slice(0, -2); posSide = '左侧'; }
    else if (rawPosition.endsWith('右侧')) { posName = rawPosition.slice(0, -2); posSide = '右侧'; }
    // 精确匹配：只有部位名完全等于"管底"或"管顶"时才推断侧位
    if (!posSide && posName === '管底') posSide = '底侧';
    else if (!posSide && posName === '管顶') posSide = '上侧';

    // 干密度直接用存储值（不依赖MDD，存储值可靠）
    const dryDensity = tv.dry_density ? parseFloat(tv.dry_density) : 0;
    // 压实度从原始数据重算（MDD可能已变更，存储值可能过期）
    const rawDD = dryDensity || calcDryDensity(tv);
    const maxDry = getMaxDry(tv.material || rd.material, rd.position_name);
    const compaction = rawDD > 0 && maxDry > 0 ? parseFloat(bankersRound(rawDD / maxDry * 100, 1)) : 0;

    // 按部位查找设计要求
    const posKey = rd.position_name || '';
    const posDesign = positionDesigns[posKey] || { str: '', num: 90, operator: '≥', tolerance: null };

    // 判定逻辑
    let judgment = '';
    if (compaction > 0) {
      if (posDesign.operator === '±' && posDesign.tolerance != null) {
        judgment = Math.abs(compaction - posDesign.num) <= posDesign.tolerance ? '符合设计要求' : '不符合设计要求';
      } else {
        judgment = compaction >= posDesign.num ? '符合设计要求' : '不符合设计要求';
      }
    }

    const groupIndex = i % 3;
    const isGroupFirst = groupIndex === 0;

    return {
      seq: baseSeq + i,
      sample_no: String(baseSeq + i),
      stake_no: (isGroupFirst ? (tv.stake_no || rd.position_name || '') : ''),
      position_name: (isGroupFirst ? posName : ''),
      side: (isGroupFirst ? posSide : ''),
      layer: rd.layer || '',
      design_req: posDesign.str,
      dry_density: dryDensity > 0 ? String(dryDensity) : '',
      compaction: compaction > 0 ? String(compaction) : '',
      judgment,
      isGroupFirst,
    };
  });

  // 辅助：填充单段文本
  function fillCellText(tcContent, text) {
    tcContent = tcContent.replace(/<w:r[\s>][\s\S]*?<\/w:r>/g, '');
    if (!text) return tcContent;
    if (!/<w:jc\b/.test(tcContent)) {
      tcContent = tcContent.replace('</w:pPr>', '<w:jc w:val="center"/></w:pPr>');
    } else {
      tcContent = tcContent.replace(/<w:jc w:val="[^"]*"\/>/g, '<w:jc w:val="center"/>');
    }
    const sz = fitFontSize(text);
    const run = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`;
    return tcContent.replace('</w:pPr>', '</w:pPr>' + run);
  }

  // 辅助：填充多段文本（每段对应一个 <w:p>）
  function fillCellMultiText(tcContent, texts) {
    const pRegex = /<w:p\b([\s\S]*?)<\/w:p>/g;
    const paragraphs = [];
    let pm;
    while ((pm = pRegex.exec(tcContent)) !== null) {
      paragraphs.push(pm);
    }
    if (!paragraphs.length) return tcContent;

    let result = tcContent;
    for (let pi = paragraphs.length - 1; pi >= 0; pi--) {
      const oldP = paragraphs[pi][0];
      const text = texts[pi] || '';
      let newP = oldP;
      newP = newP.replace(/<w:r[\s>][\s\S]*?<\/w:r>/g, '');
      if (text) {
        const sz = fitFontSize(text);
        const run = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escXml(text)}</w:t></w:r>`;
        newP = newP.replace('</w:pPr>', '</w:pPr>' + run);
      }
      result = result.replace(oldP, newP);
    }
    return result;
  }

  // 列映射: 0=序号 1=试样编号 2=取样桩号(vMerge) 3=取样位置(vMerge,2段) 4=层位 5=设计要求 6=干密度 7=压实度 8=单项判定
  function fillDataRow(tr, rd) {
    const tcs = [];
    const tcRegex = /<w:tc\b([^>]*)>([\s\S]*?)<\/w:tc>/g;
    let tcMatch;
    while ((tcMatch = tcRegex.exec(tr.content)) !== null) {
      tcs.push({ full: tcMatch[0], openTag: '<w:tc' + tcMatch[1] + '>', content: tcMatch[2] });
    }
    if (tcs.length < 9) return tr.full;

    let newRow = tr.content;
    // col 0: 序号
    newRow = newRow.replace(tcs[0].full, tcs[0].openTag + fillCellText(tcs[0].content, String(rd.seq)) + '</w:tc>');
    // col 1: 试样编号
    newRow = newRow.replace(tcs[1].full, tcs[1].openTag + fillCellText(tcs[1].content, rd.sample_no) + '</w:tc>');
    // col 2: 取样桩号 (vMerge — 仅首行有内容)
    if (rd.isGroupFirst) {
      newRow = newRow.replace(tcs[2].full, tcs[2].openTag + fillCellText(tcs[2].content, rd.stake_no) + '</w:tc>');
    } else {
      newRow = newRow.replace(tcs[2].full, tcs[2].openTag + fillCellText(tcs[2].content, '') + '</w:tc>');
    }
    // col 3: 取样位置 (vMerge, 2段 — 仅首行有内容)
    if (rd.isGroupFirst) {
      newRow = newRow.replace(tcs[3].full, tcs[3].openTag + fillCellMultiText(tcs[3].content, [rd.position_name, rd.side]) + '</w:tc>');
    } else {
      newRow = newRow.replace(tcs[3].full, tcs[3].openTag + fillCellText(tcs[3].content, '') + '</w:tc>');
    }
    // col 4: 层位
    newRow = newRow.replace(tcs[4].full, tcs[4].openTag + fillCellText(tcs[4].content, rd.layer) + '</w:tc>');
    // col 5: 设计要求
    newRow = newRow.replace(tcs[5].full, tcs[5].openTag + fillCellText(tcs[5].content, rd.design_req) + '</w:tc>');
    // col 6: 干密度
    newRow = newRow.replace(tcs[6].full, tcs[6].openTag + fillCellText(tcs[6].content, rd.dry_density) + '</w:tc>');
    // col 7: 压实度
    newRow = newRow.replace(tcs[7].full, tcs[7].openTag + fillCellText(tcs[7].content, rd.compaction) + '</w:tc>');
    // col 8: 单项判定
    newRow = newRow.replace(tcs[8].full, tcs[8].openTag + fillCellText(tcs[8].content, rd.judgment) + '</w:tc>');

    return newRow;
  }

  // 填充数据行
  for (let i = 0; i < Math.min(rowData.length, templateDataRows.length); i++) {
    const newRow = fillDataRow(templateDataRows[i], rowData[i]);
    tableXml = tableXml.replace(templateDataRows[i].full, '<w:tr' + templateDataRows[i].attrs + '>' + newRow + '</w:tr>');
  }

  // 清除多余空行
  for (let i = rowData.length; i < templateDataRows.length; i++) {
    const tr = templateDataRows[i];
    const tcs = [];
    const tcRegex = /<w:tc\b([^>]*)>([\s\S]*?)<\/w:tc>/g;
    let tcMatch;
    while ((tcMatch = tcRegex.exec(tr.content)) !== null) {
      tcs.push({ full: tcMatch[0], openTag: '<w:tc' + tcMatch[1] + '>', content: tcMatch[2] });
    }
    if (tcs.length < 9) continue;
    let newRow = tr.content;
    for (let c = 0; c < tcs.length; c++) {
      let tcContent = tcs[c].content.replace(/<w:r[\s>][\s\S]*?<\/w:r>/g, '');
      newRow = newRow.replace(tcs[c].full, tcs[c].openTag + tcContent + '</w:tc>');
    }
    tableXml = tableXml.replace(tr.full, '<w:tr' + tr.attrs + '>' + newRow + '</w:tr>');
  }

  xml = xml.substring(0, tableStart) + tableXml + xml.substring(tableEnd);
  return xml;
}

// ===== API 端点 =====

// POST /:id/save — 保存报告抬头数据
exports.saveReportData = async (req, res) => {
  try {
    const entrustId = parseInt(req.params.id);
    if (isNaN(entrustId)) return res.status(400).json({ code: 400, message: '无效的委托ID' });

    const db = getDb();
    const body = req.body || {};

    // 查询委托单获取 project_id
    const entrust = db.prepare('SELECT * FROM biz_entrust WHERE id = ?').get(entrustId);
    if (!entrust) return res.status(404).json({ code: 404, message: '委托单不存在' });

    // 更新 biz_entrust 字段
    db.prepare(`UPDATE biz_entrust SET report_date = ?, sampling_date = ?, section_pile = ? WHERE id = ?`)
      .run(body.report_date || '', body.sampling_date || '', body.section_pile || '', entrustId);

    // 更新 biz_project 字段
    db.prepare(`UPDATE biz_project SET project_name = ?, client_unit = ?, build_unit = ?, construction_unit = ?, supervision_unit = ?, witness_person = ? WHERE id = ?`)
      .run(
        body.project_name || '', body.client_unit || '', body.build_unit || '',
        body.construction_unit || '', body.supervision_unit || '', body.witness_person || '',
        entrust.project_id
      );

    // 更新记录单的 remark JSON（存储 extra 数据）
    const records = db.prepare('SELECT * FROM biz_original_record WHERE entrust_id = ? ORDER BY page_no').all(entrustId);
    if (records.length > 0) {
      const firstRecord = records[0];
      let remark = {};
      try { remark = typeof firstRecord.remark === 'string' ? JSON.parse(firstRecord.remark) : (firstRecord.remark || {}); } catch {}

      remark.entrust_type = body.entrust_type || '';
      remark.test_date = body.test_date || '';
      remark.test_basis = body.test_basis || [];
      remark.sand_cylinder = body.test_equipment?.sand_cylinder || '150mm';
      remark.drying_oven = body.test_equipment?.drying_oven || [];
      remark.conclusion = body.conclusion || '';
      remark.max_dry_densities = remark.max_dry_densities || {};

      // 如果传了 max_dry_density 文本，尝试解析回对象
      if (body.max_dry_density) {
        const parts = body.max_dry_density.split('，');
        for (const part of parts) {
          const m = part.match(/^(.+?)[：:]\s*([\d.]+)\s*g\/cm³?$/);
          if (m) remark.max_dry_densities[m[1].trim()] = parseFloat(m[2]);
        }
      }

      db.prepare('UPDATE biz_original_record SET remark = ? WHERE id = ?')
        .run(JSON.stringify(remark), firstRecord.id);
    }

    res.json({ code: 200, data: { message: '保存成功' } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// GET /:id/data — 获取报告所需全部数据
exports.getReportData = async (req, res) => {
  try {
    const data = await fetchReportData(req.params.id);
    const { entrust, items, rows, extra, totalSamples, defaultSectionPile } = data;

    const categoryNames = { 'SYS': '管道压实度（灌砂法）' };

    // 部位 → 设计要求映射
    const posDesigns = {};
    for (const item of items) {
      posDesigns[item.position_name] = makeItemDesign(item);
    }

    // 最大干密度查找（用于旧数据回退计算）
    const maxDryDensities = extra.max_dry_densities || {};
    const posMaterialMap = {};
    for (const ci of items) { posMaterialMap[ci.position_name] = ci.material; }
    function getMaxDry(material, position) {
      const mat = material || posMaterialMap[position] || '';
      if (mat && maxDryDensities[mat]) return parseFloat(maxDryDensities[mat]);
      const vals = Object.values(maxDryDensities).filter(Boolean);
      return vals.length > 0 ? parseFloat(vals[0]) : 0;
    }

    res.json({
      code: 200,
      data: {
        // 封面
        cover: {
          report_no: entrust.entrust_no,
          project_name: entrust.project_name || '',
          client_unit: entrust.client_unit || '',
          test_item: categoryNames[entrust.category_code] || entrust.entrust_type || '',
          report_date: entrust.report_date || '',
        },
        // 信息页
        info: {
          entrust_type: entrust.entrust_type || '',
          build_unit: entrust.build_unit || '',
          construction_unit: entrust.construction_unit || '',
          supervision_unit: entrust.supervision_unit || '',
          witness_person: entrust.witness_person || '',
          total_samples: totalSamples,
          sampling_date: entrust.sampling_date || '',
          test_date: extra.test_date || '',
          section_pile: entrust.section_pile || defaultSectionPile,
          structure_part: extra.structure_layer || [...new Set(items.map(i => i.position_name).filter(Boolean))].join('、'),
          test_basis: extra.test_basis || [],
          test_equipment: {
            sand_cylinder: extra.sand_cylinder || '150mm',
            drying_oven: extra.drying_oven || [],
          },
          max_dry_density: (() => {
            const md = extra.max_dry_densities || {};
            const entries = Object.entries(md).filter(([, v]) => v);
            if (!entries.length) return '';
            return entries.map(([k, v]) => `${k}：${v} g/cm³`).join('，');
          })(),
          conclusion: extra.conclusion || '',
          remark: extra.remark_footer || '',
          tester: extra.tester || '',
          reviewer: extra.reviewer || '',
        },
        // 数据预览 — 直接从记录单已存储值读取
        data_rows: rows.map(r => {
          const tv = r.test_values || {};
          const rawPosition = tv.position || r.position_name || '';

          // 干密度直接用存储值（不依赖MDD，存储值可靠）
          const dryDensity = tv.dry_density ? parseFloat(tv.dry_density) : 0;
          // 压实度从原始数据重算（MDD可能已变更，存储值可能过期）
          const rawDD = dryDensity || calcDryDensity(tv);
          const maxDry = getMaxDry(tv.material || r.material, r.position_name);
          const comp = rawDD > 0 && maxDry > 0 ? parseFloat(bankersRound(rawDD / maxDry * 100, 1)) : 0;

          // 解析侧位
          let posName = rawPosition;
          let posSide = '';
          if (rawPosition.endsWith('左侧')) { posName = rawPosition.slice(0, -2); posSide = '左侧'; }
          else if (rawPosition.endsWith('右侧')) { posName = rawPosition.slice(0, -2); posSide = '右侧'; }
          if (!posSide && posName === '管底') posSide = '底侧';
          else if (!posSide && posName === '管顶') posSide = '上侧';

          // 按部位取设计要求
          const posKey = r.position_name || '';
          const pd = posDesigns[posKey] || { str: '', num: 90, operator: '≥', tolerance: null };

          // 判定
          let judgment = '';
          if (comp > 0) {
            if (pd.operator === '±' && pd.tolerance != null) {
              judgment = Math.abs(comp - pd.num) <= pd.tolerance ? '符合设计要求' : '不符合设计要求';
            } else {
              judgment = comp >= pd.num ? '符合设计要求' : '不符合设计要求';
            }
          }

          return {
            seq_no: r.seq_no,
            sample_no: r.sample_no,
            stake_no: tv.stake_no || r.position_name || '',
            position_name: posName || r.position_name || '',
            position_side: posSide,
            material: tv.material || '',
            design_requirement: pd.str,
            dry_density: dryDensity > 0 ? String(dryDensity) : '',
            compaction: comp > 0 ? String(comp) : '',
            judgment,
          };
        }),
        // 保存 entrust 原有值（供更新用）
        entrust_id: entrust.id,
        entrust_no: entrust.entrust_no,
      },
    });

    // 异步更新数据库中的压实度（MDD可能已变更，存储值可能过期；干密度不受MDD影响，无需更新）
    try {
      const db = getDb();
      const updateStmt = db.prepare('UPDATE biz_original_record_item SET test_values = ? WHERE id = ?');
      db.transaction(() => {
        for (const r of rows) {
          const tv = r.test_values || {};
          const dd = tv.dry_density ? parseFloat(tv.dry_density) : 0;
          const rawDD = dd || calcDryDensity(tv);
          const maxDry = getMaxDry(tv.material || r.material, r.position_name);
          const newComp = rawDD > 0 && maxDry > 0 ? bankersRound(rawDD / maxDry * 100, 1) : '';
          if (newComp !== String(tv.compaction || '')) {
            const updated = { ...tv, compaction: newComp };
            updateStmt.run(JSON.stringify(updated), r.id);
          }
        }
      })();
    } catch (e) {
      console.error('更新计算值失败:', e.message);
    }
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// POST /:id/print/start
exports.startPrint = async (req, res) => {
  try {
    const entrustId = parseInt(req.params.id);
    if (isNaN(entrustId)) return res.status(400).json({ code: 400, message: '无效的委托ID' });

    const headerData = req.body || {};
    const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    reportJobs.set(taskId, { step: 0, totalSteps: 1, message: '准备中...', done: false, error: null, pdfPath: null });

    generateReportPdf(entrustId, headerData, taskId).catch(err => {
      const job = reportJobs.get(taskId);
      if (job) { job.message = err.message; job.error = true; job.done = true; }
    });

    res.json({ code: 200, data: { taskId } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// GET /:id/print/status/:taskId
exports.printStatus = (req, res) => {
  const job = reportJobs.get(req.params.taskId);
  if (!job) return res.status(404).json({ code: 404, message: '任务不存在或已过期' });
  res.json({ code: 200, data: job });
};

// GET /:id/print/download/:taskId
exports.printDownload = (req, res) => {
  const job = reportJobs.get(req.params.taskId);
  if (!job || !job.pdfPath) return res.status(404).json({ code: 404, message: 'PDF未就绪' });

  const pdfPath = job.pdfPath;
  if (!fs.existsSync(pdfPath)) return res.status(404).json({ code: 404, message: 'PDF文件已丢失，请重新生成' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(pdfPath)}"`);

  const stream = fs.createReadStream(pdfPath);
  stream.pipe(res);
  stream.on('end', () => {
    try { fs.unlinkSync(pdfPath); } catch {}
    reportJobs.delete(req.params.taskId);
  });
};
