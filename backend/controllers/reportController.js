// 检测报告 PDF 生成
const fs = require('fs');
const os = require('os');
const path = require('path');
const PizZip = require('pizzip');
const { getDb } = require('../config/db');
const { fillCoverPage, escXml } = require('../utils/reportCoverPage');
const { batchDocxToPdf } = require('../utils/pdfConverter');
const { calcDryDensity, calcCompaction } = require('../utils/compaction');

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

function bankersRound(num, decimals = 1) {
  const factor = Math.pow(10, decimals);
  const n = num * factor;
  const floor = Math.floor(n);
  const frac = n - floor;
  if (frac < 0.5) return floor / factor;
  if (frac > 0.5) return (floor + 1) / factor;
  return (floor % 2 === 0 ? floor : floor + 1) / factor;
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

// 替换段落中 w:t 内容（用于 info 页非表格文本）
function replaceWT(xml, target, value) {
  const idx = xml.indexOf(target);
  if (idx === -1) return xml;
  const before = xml.substring(0, idx);
  const after = xml.substring(idx + target.length);
  return before + escXml(value) + after;
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
      if (r.max_dry_densities || r.test_basis || r.structure_layer || r.tester) {
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
  const dataPages = Math.ceil(totalSamples / 9);
  const defaultSectionPile = dataPages <= 1
    ? `详见报告第2页`
    : `详见报告第2-${1 + dataPages}页`;

  return {
    entrust,
    items,
    records,
    rows: parsedRows,
    extra,
    totalSamples,
    defaultSectionPile,
  };
}

// ===== 模板加载与合并 =====

const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'temp');
const TEMPLATE_COVER = path.join(TEMPLATE_DIR, '检测报告封面页.docx');
const TEMPLATE_INFO = path.join(TEMPLATE_DIR, '检测报告信息页.docx');
const TEMPLATE_DATA = path.join(TEMPLATE_DIR, '检测报告管道详情数据页.docx');
const ROWS_PER_PAGE = 9;

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

  // 计算数据页数（封面不编页码，从信息页开始）
  const dataPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const totalReportPages = 1 + dataPages; // 信息页 + 数据页

  // 封面无页码，信息页 = 第1页
  // 封面 body 中如有页头行则清除
  const coverBodyClean = removePageHeaderLine(coverBody);
  let infoBodyFilled = fillPageHeaderLine(infoBody, entrustNo, 1, totalReportPages);

  // 组装完整 body（多页数据时每页独立填入页码，数据页从第2页起）
  let allBody = coverBodyClean + infoBodyFilled;
  for (let i = 0; i < dataPages; i++) {
    let pageBody = fillPageHeaderLine(dataBody, entrustNo, 2 + i, totalReportPages);
    allBody += pageBody;
  }

  // 组装完整 document.xml
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
  const conclusion = headerData.conclusion || extra.report_conclusion || defaultConclusionText;
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
  xml = fillAllDataTables(xml, rows, items, maxDryDensities, totalReportPages);

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
function fillPageHeaderLine(bodyXml, entrustNo, pageNo, totalPages) {
  const gongIdx = bodyXml.indexOf('共');
  if (gongIdx === -1) return bodyXml;

  const pOpen = bodyXml.lastIndexOf('<w:p', gongIdx);
  const pClose = bodyXml.indexOf('</w:p>', gongIdx) + '</w:p>'.length;
  if (pOpen === -1 || pClose === -1) return bodyXml;

  const escNo = escXml(entrustNo);
  const newP = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:szCs w:val="21"/></w:rPr><w:t xml:space="preserve">报告编号：${escNo}    共 ${totalPages} 页 第 ${pageNo} 页</w:t></w:r></w:p>`;

  return bodyXml.substring(0, pOpen) + newP + bodyXml.substring(pClose);
}

// 移除页面头部行（封面不需要页码）
function removePageHeaderLine(bodyXml) {
  const gongIdx = bodyXml.indexOf('共');
  if (gongIdx === -1) return bodyXml;

  const pOpen = bodyXml.lastIndexOf('<w:p', gongIdx);
  const pClose = bodyXml.indexOf('</w:p>', gongIdx) + '</w:p>'.length;
  if (pOpen === -1 || pClose === -1) return bodyXml;

  // 检查这个段落是否包含"报告编号"（是页头行才移除）
  if (bodyXml.substring(pOpen, pClose).includes('报告编号')) {
    return bodyXml.substring(0, pOpen) + bodyXml.substring(pClose);
  }
  return bodyXml;
}

// 填充分页的数据表
function fillAllDataTables(xml, rows, items, maxDryDensities, totalReportPages) {
  const dataPages = Math.ceil(rows.length / ROWS_PER_PAGE);

  // 找到所有数据表（通过 "试样编号" 定位）
  let searchFrom = 0;
  for (let page = 0; page < dataPages; page++) {
    const pageRows = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    xml = fillOneDataTable(xml, pageRows, items, maxDryDensities, searchFrom);
    // 更新下次搜索的起始位置（跳过当前已处理的表）
    searchFrom = xml.indexOf('</w:tbl>', xml.indexOf('试样编号', searchFrom)) + '</w:tbl>'.length;
    if (searchFrom < '</w:tbl>'.length) searchFrom = 0; // 未找到
  }

  // 清除多余的空表（数据不足时剩余的空白模板页面）
  // 找到所有数据表，如果某页没有数据行则清除该表
  return xml;
}

// 填充单个数据表
function fillOneDataTable(xml, pageRows, items, maxDryDensities, startFrom) {
  // 组装设计要求字符串
  let designReqStr = '';
  if (items.length > 0) {
    const item = items[0];
    const dr = item.design_requirement;
    const op = item.design_operator || '≥';
    const tol = item.design_tolerance;
    if (op === '±' && tol != null) {
      designReqStr = `${dr}%±${tol}%`;
    } else {
      designReqStr = `${op}${dr}%`;
    }
  }

  function getMaxDry(material) {
    if (material && maxDryDensities[material]) return parseFloat(maxDryDensities[material]);
    const vals = Object.values(maxDryDensities).filter(Boolean);
    return vals.length > 0 ? parseFloat(vals[0]) : 0;
  }

  // 从 startFrom 位置开始找数据表
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

  const templateDataRows = allTrs.slice(headerRowIdx + 1);

  // 构建行数据
  const rowData = pageRows.map((rd, i) => {
    const tv = rd.test_values || {};
    const maxDry = getMaxDry(tv.material || rd.material);

    // 优先用记录单已存储的计算值
    let dryDensity = tv.dry_density ? parseFloat(tv.dry_density) : 0;
    let compaction = tv.compaction ? parseFloat(tv.compaction) : 0;
    if (!dryDensity) dryDensity = calcDryDensity(tv);
    if (!compaction && dryDensity > 0 && maxDry > 0) compaction = dryDensity / maxDry * 100;

    const designReq = parseFloat(items[0]?.design_requirement || 90);
    const judgment = compaction > 0 ? (compaction >= designReq ? '符合设计要求' : '不符合设计要求') : '';

    return {
      seq: i + 1,
      stake_no: tv.stake_no || rd.position_name || '',
      position: (rd.position_name || '') + (rd.layer ? ' ' + rd.layer : ''),
      design_req: designReqStr,
      dry_density: dryDensity > 0 ? bankersRound(dryDensity, 2) : '',
      compaction: compaction > 0 ? String(bankersRound(compaction, 1)) : '',
      judgment,
    };
  });

  // 填充数据行
  for (let i = 0; i < Math.min(rowData.length, templateDataRows.length); i++) {
    const rd = rowData[i];
    const tr = templateDataRows[i];

    const tcs = [];
    const tcRegex = /<w:tc\b([^>]*)>([\s\S]*?)<\/w:tc>/g;
    let tcMatch;
    while ((tcMatch = tcRegex.exec(tr.content)) !== null) {
      tcs.push({ full: tcMatch[0], openTag: '<w:tc' + tcMatch[1] + '>', content: tcMatch[2] });
    }

    if (tcs.length < 7) continue;

    const colValues = [
      String(rd.seq),
      rd.stake_no,
      rd.position,
      rd.design_req,
      rd.dry_density,
      rd.compaction,
      rd.judgment,
    ];

    let newRow = tr.content;
    for (let c = 0; c < colValues.length && c < tcs.length; c++) {
      const val = colValues[c];
      let tcContent = tcs[c].content;
      tcContent = tcContent.replace(/<w:r[\s>][\s\S]*?<\/w:r>/g, '');

      if (val && tcContent.includes('</w:pPr>')) {
        if (!/<w:jc\b/.test(tcContent)) {
          tcContent = tcContent.replace('</w:pPr>', '<w:jc w:val="center"/></w:pPr>');
        } else {
          tcContent = tcContent.replace(/<w:jc w:val="[^"]*"\/>/g, '<w:jc w:val="center"/>');
        }
        const sz = c === 2 ? fitFontSize(val) : '21';
        const newRun = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escXml(val)}</w:t></w:r>`;
        tcContent = tcContent.replace('</w:pPr>', '</w:pPr>' + newRun);
      }

      newRow = newRow.replace(tcs[c].full, tcs[c].openTag + tcContent + '</w:tc>');
    }

    tableXml = tableXml.replace(tr.full, '<w:tr' + tr.attrs + '>' + newRow + '</w:tr>');
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
    if (tcs.length < 7) continue;

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
      remark.report_conclusion = body.conclusion || '';
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
    const { entrust, items, records, rows, extra, totalSamples, defaultSectionPile } = data;

    const categoryNames = { 'SYS': '管道压实度（灌砂法）' };

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
          conclusion: extra.report_conclusion || '',
          remark: extra.remark_footer || '',
          tester: extra.tester || '',
          reviewer: extra.reviewer || '',
        },
        // 数据预览
        data_rows: rows.map((r, idx) => {
          const tv = r.test_values || {};
          const rawPosition = tv.position || r.position_name || '';
          const maxDry = (() => {
            const md = extra.max_dry_densities || {};
            const mat = tv.material || r.material || '';
            if (mat && md[mat]) return parseFloat(md[mat]);
            const vals = Object.values(md).filter(Boolean);
            return vals.length > 0 ? parseFloat(vals[0]) : 0;
          })();

          // 优先用记录单已存储的计算值，旧数据回退到实时计算
          const dry = tv.dry_density ? parseFloat(tv.dry_density) : calcDryDensity(tv);
          const comp = tv.compaction ? parseFloat(tv.compaction)
            : (dry > 0 && maxDry > 0 ? dry / maxDry * 100 : 0);

          const designReq = (() => {
            const item = items[0];
            if (!item) return '';
            const dr = item.design_requirement;
            const op = item.design_operator || '≥';
            const tol = item.design_tolerance;
            if (op === '±' && tol != null) return `${dr}%±${tol}%`;
            return `${op}${dr}%`;
          })();

          return {
            seq_no: r.seq_no,
            sample_no: r.sample_no,
            stake_no: tv.stake_no || r.position_name || '',
            position_name: (() => {
              let p = rawPosition;
              if (p.endsWith('左侧')) return p.slice(0, -2);
              if (p.endsWith('右侧')) return p.slice(0, -2);
              if (p.endsWith('管底') || p.endsWith('管顶')) return p;
              return p || r.position_name || '';
            })(),
            position_side: (() => {
              if (rawPosition.endsWith('左侧')) return '左侧';
              if (rawPosition.endsWith('右侧')) return '右侧';
              if (rawPosition.includes('管底') || rawPosition.endsWith('底')) return '底侧';
              if (rawPosition.includes('管顶') || rawPosition.endsWith('顶')) return '上侧';
              return r.layer || '';
            })(),
            material: tv.material || '',
            design_requirement: designReq,
            dry_density: dry > 0 ? bankersRound(dry, 2) : '',
            max_dry_density: maxDry,
            compaction: comp > 0 ? bankersRound(comp, 1) : '',
            judgment: comp > 0 ? (comp >= (parseFloat(items[0]?.design_requirement) || 90) ? '符合设计要求' : '不符合设计要求') : '',
          };
        }),
        // 保存 entrust 原有值（供更新用）
        entrust_id: entrust.id,
        entrust_no: entrust.entrust_no,
      },
    });
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
