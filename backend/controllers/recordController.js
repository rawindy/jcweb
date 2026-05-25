const path = require('path');
const fs = require('fs');
const os = require('os');
const PizZip = require('pizzip');
const { query, getDb } = require('../config/db');
const { generateSampleNos } = require('../utils/codeGenerator');
const { batchDocxToPdf } = require('../utils/pdfConverter');

exports.getRecords = async (req, res) => {
  try {
    const { id: entrustId } = req.params;
    const [entrusts] = query(
      `SELECT e.*, p.project_no, p.project_name, p.client_unit, p.client_person,
              p.supervision_unit, p.witness_person, p.construction_unit, p.build_unit
       FROM biz_entrust e
       LEFT JOIN biz_project p ON e.project_id = p.id
       WHERE e.id = ?`, [entrustId]
    );
    if (entrusts.length === 0) {
      return res.status(404).json({ code: 404, message: '委托单不存在' });
    }
    const entrust = entrusts[0];

    let items = [];
    if (entrust.category_code === 'SYS') {
      const [compactionItems] = query(
        'SELECT * FROM biz_compaction_item WHERE entrust_id = ? ORDER BY sort', [entrustId]
      );
      items = compactionItems;
      if (entrust.entrust_type === '路基压实度') {
        items.forEach(item => {
          item._samplesPerGroup = item.material === '土' ? 6 : 3;
        });
      } else {
        items.forEach(item => { item._samplesPerGroup = 3; });
      }
    }

    let totalSampleCount = 0;
    items.forEach(item => {
      totalSampleCount += item.group_count * (item._samplesPerGroup || 3);
    });

    const itemsPerPage = 9;
    const totalPages = Math.ceil(totalSampleCount / itemsPerPage) || 1;

    const [savedRecords] = query(
      'SELECT * FROM biz_original_record WHERE entrust_id = ? ORDER BY page_no', [entrustId]
    );

    let pages = [];

    if (savedRecords.length > 0) {
      for (const record of savedRecords) {
        const [rows] = query(
          'SELECT * FROM biz_original_record_item WHERE record_id = ? ORDER BY seq_no', [record.id]
        );
        const parsedRows = rows.map(r => ({
          ...r,
          test_values: typeof r.test_values === 'string' ? JSON.parse(r.test_values) : (r.test_values || {}),
          _empty: !r.sample_no
        }));
        while (parsedRows.length < itemsPerPage) {
          parsedRows.push({
            seq_no: parsedRows.length + 1, sample_no: '', position_name: '',
            layer: '', material: '', design_requirement: null, test_values: {}, _empty: true
          });
        }

        let headerData = {};
        try {
          headerData = typeof record.header_data === 'string'
            ? JSON.parse(record.header_data) : (record.header_data || {});
        } catch { headerData = {}; }

        const extraStr = record.remark || '{}';
        let extra = {};
        try { extra = typeof extraStr === 'string' ? JSON.parse(extraStr) : extraStr; } catch { extra = {}; }

        pages.push({
          page_no: record.page_no,
          total_pages: record.total_pages,
          template_type: record.template_type,
          header_data: headerData,
          extra: {
            structure_layer: extra.structure_layer || '',
            design_req: extra.design_req || '',
            max_dry_density: extra.max_dry_density || '',
            conclusion: extra.conclusion || '',
            remark_footer: extra.remark_footer || '',
            tester: extra.tester || '',
            reviewer: extra.reviewer || '',
            test_date: extra.test_date || ''
          },
          rows: parsedRows
        });
      }
    } else {
      const sampleNos = generateSampleNos(entrust.entrust_no, totalSampleCount);
      const allRows = [];
      let sampleIdx = 0;
      for (const item of items) {
        const spg = item._samplesPerGroup || 3;
        for (let g = 0; g < item.group_count; g++) {
          const layers = ['第一层', '第二层', '第三层'];
          if (spg === 6) layers.push('第四层', '第五层', '第六层');
          for (let l = 0; l < spg; l++) {
            allRows.push({
              sample_no: sampleNos[sampleIdx] || '',
              position_name: item.position_name,
              group_index: g + 1,
              layer: layers[l] || `第${l + 1}层`,
              material: item.material,
              design_requirement: item.design_requirement,
              test_values: {}
            });
            sampleIdx++;
          }
        }
      }

      for (let p = 0; p < totalPages; p++) {
        const start = p * itemsPerPage;
        const end = Math.min(start + itemsPerPage, allRows.length);
        const pageRows = [];
        for (let i = start; i < end; i++) {
          pageRows.push({ ...allRows[i], seq_no: (i % itemsPerPage) + 1 });
        }
        while (pageRows.length < itemsPerPage) {
          pageRows.push({
            seq_no: pageRows.length + 1, sample_no: '', position_name: '',
            layer: '', material: '', design_requirement: null,
            test_values: {}, _empty: true
          });
        }

        const headerData = {
          entrust_no: entrust.entrust_no,
          project_name: entrust.project_name || '',
          client_unit: entrust.client_unit || '',
          client_person: entrust.client_person || '',
          supervision_unit: entrust.supervision_unit || '',
          witness_person: entrust.witness_person || '',
          construction_unit: entrust.construction_unit || '',
          build_unit: entrust.build_unit || '',
          entrust_type: entrust.entrust_type,
          entrust_date: entrust.entrust_date
        };

        let tmplType = 'pipe_compaction';
        if (entrust.entrust_type === '路基压实度') {
          const firstItem = items[0];
          if (firstItem?.material === '土') tmplType = 'roadbed_soil';
          else if (firstItem?.material === '砂') tmplType = 'roadbed_sand';
          else if (firstItem?.material === '塘渣') tmplType = 'roadbed_slag';
          else tmplType = 'roadbed_sand';
        }

        pages.push({
          page_no: p + 1,
          total_pages: totalPages,
          template_type: tmplType,
          header_data: headerData,
          extra: {
            structure_layer: '', design_req: '', max_dry_density: '',
            conclusion: '', remark_footer: '', tester: '', reviewer: '', test_date: ''
          },
          rows: pageRows
        });
      }
    }

    res.json({ code: 200, data: { entrust, totalSampleCount, totalPages, pages } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.updateRows = async (req, res) => {
  try {
    const db = getDb();
    const { entrustId } = req.params;
    const { rows } = req.body;

    const doUpdate = db.transaction(() => {
      const [oldRecords] = query('SELECT id FROM biz_original_record WHERE entrust_id = ?', [entrustId]);
      for (const r of oldRecords) {
        query('DELETE FROM biz_original_record_item WHERE record_id = ?', [r.id]);
      }
      query('DELETE FROM biz_original_record WHERE entrust_id = ?', [entrustId]);

      const pageMap = {};
      for (const row of rows) {
        if (row._empty) continue;
        if (!pageMap[row.page_no]) pageMap[row.page_no] = [];
        pageMap[row.page_no].push(row);
      }

      for (const [pageNo, pageRows] of Object.entries(pageMap)) {
        const extra = pageRows[0].extra || {};
        const remark = JSON.stringify(extra);

        const [recordResult] = query(
          `INSERT INTO biz_original_record (entrust_id, page_no, total_pages, template_type, header_data, remark, create_time, update_time)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
          [entrustId, pageNo, pageRows[0].total_pages || 1, pageRows[0].template_type || 'pipe_compaction',
           JSON.stringify(pageRows[0].header_data || {}), remark]
        );
        const recordId = recordResult.insertId;

        for (const row of pageRows) {
          query(
            `INSERT INTO biz_original_record_item (record_id, seq_no, sample_no, position_name, layer, test_values)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [recordId, row.seq_no, row.sample_no, row.position_name, row.layer,
             JSON.stringify(row.test_values || {})]
          );
        }
      }
    });

    doUpdate();
    res.json({ code: 200, message: '保存成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.printPdf = async (req, res) => {
  try {
    const { id: entrustId } = req.params;

    // 1. 查询数据
    const [entrusts] = query(
      `SELECT e.*, p.project_no, p.project_name, p.client_unit, p.client_person,
              p.supervision_unit, p.witness_person, p.construction_unit, p.build_unit
       FROM biz_entrust e LEFT JOIN biz_project p ON e.project_id = p.id
       WHERE e.id = ?`, [entrustId]
    );
    if (entrusts.length === 0) {
      return res.status(404).json({ code: 404, message: '委托单不存在' });
    }
    const entrust = entrusts[0];

    if (entrust.entrust_type !== '路基压实度') {
      return res.status(400).json({ code: 400, message: '此模板仅支持路基压实度' });
    }

    const [savedRecords] = query(
      'SELECT * FROM biz_original_record WHERE entrust_id = ? ORDER BY page_no', [entrustId]
    );
    if (savedRecords.length === 0) {
      return res.status(400).json({ code: 400, message: '请先保存记录数据后再打印' });
    }

    // 2. 加载模板
    const templatePath = path.join(__dirname, '..', '..', 'temp', '压实度（道路）（灌砂法）检测原始记录单.docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ code: 404, message: 'DOCX模板文件不存在' });
    }

    // 3. 读取材料
    const [items] = query(
      'SELECT material FROM biz_compaction_item WHERE entrust_id = ? ORDER BY sort', [entrustId]
    );
    const materials = [...new Set(items.map(i => i.material).filter(Boolean))];
    const materialStr = materials.join('、');

    const totalPages = Math.max(...savedRecords.map(r => r.total_pages || 1));
    const entrustNo = entrust.entrust_no;

    // 因 docx 的 ZIP 本质，逐页填充需要为每页生成独立的 docx，然后合并或分别处理。
    // 简单方案：每页一个 docx → 转 PDF → 合并 PDF（如有多页）
    // 当前先用逐页方案：
    const convertPairs = []; // { docx, pdf, pageNo }

    for (const record of savedRecords) {
      // 解析数据
      let headerData = {};
      try {
        headerData = typeof record.header_data === 'string'
          ? JSON.parse(record.header_data) : (record.header_data || {});
      } catch { headerData = {}; }

      let extra = {};
      try {
        extra = typeof record.remark === 'string'
          ? JSON.parse(record.remark) : (record.remark || {});
      } catch { extra = {}; }

      const maxDryDensity = parseFloat(extra.max_dry_density) || 0;

      const [rows] = query(
        'SELECT * FROM biz_original_record_item WHERE record_id = ? ORDER BY seq_no', [record.id]
      );
      const parsedRows = rows.map(r => ({
        ...r,
        test_values: typeof r.test_values === 'string'
          ? JSON.parse(r.test_values) : (r.test_values || {})
      }));

      // 4. 填充 docx
      const zip = new PizZip(fs.readFileSync(templatePath));
      let xml = zip.files['word/document.xml'].asText();

      // --- 抬头文本替换 ---
      xml = xml.replace(
        '委托编号：                      共   页第   页              记录单编号：',
        `委托编号：${entrustNo}              共 ${totalPages} 页第 ${record.page_no} 页              记录单编号：`
      );
      xml = xml.replace('JL/', `JL/${entrustNo}`);

      // --- 表格单元格填充 ---
      // 命名规则: {label} → 后面的第一个空单元格填入对应值
      const cellMap = [
        { label: '工程名称',   value: headerData.project_name || entrust.project_name || '' },
        { label: '委托单位',   value: headerData.client_unit || entrust.client_unit || '' },
        { label: '见证单位',   value: headerData.supervision_unit || entrust.supervision_unit || '' },
        { label: '结构层次',   value: extra.structure_layer || materialStr },
        { label: '设计要求',   value: extra.design_req || '' },
        { label: '最大干密度', value: maxDryDensity > 0 ? maxDryDensity.toFixed(3) : '' },
        { label: '检测结论',   value: extra.conclusion || '' },
        { label: '备    注',   value: extra.remark_footer || '' },
      ];

      for (const { label, value } of cellMap) {
        xml = fillCellAfter(xml, label, value);
      }

      // --- 数据表格 ---
      // 19 个参数标签顺序
      const paramKeys = [
        'sample', 'stake_no', 'position',
        'sand_before', 'sand_after', 'sand_surface',
        'pit_sand', 'sand_density', 'pit_volume',
        'wet_mass', 'wet_density', 'box_no',
        'box_mass', 'box_wet', 'box_dry',
        'water_content', 'dry_density', 'compaction'
      ];
      const dataRowLabels = [
        '编号', '桩号', '取样位置距中', '灌砂前砂', '灌砂后',
        '合计质量', '试坑灌入量砂', '量砂堆积', '试坑体积',
        '试坑中挖出的湿料质量', '试样湿密度', '盒号',
        '盒质量', '湿料质量', '干料质量',
        '含水率', '干密度', '压实度'
      ];

      let searchPos = 0;
      for (let ri = 0; ri < dataRowLabels.length; ri++) {
        const label = dataRowLabels[ri];
        const key = paramKeys[ri];
        const values = [];

        for (let col = 0; col < 9; col++) {
          const rd = parsedRows[col];
          if (!rd || rd._empty) { values.push(''); continue; }
          const tv = rd.test_values || {};

          if (key === 'sample') {
            values.push(rd.sample_no || '');
          } else if (key === 'max_dry_density') {
            values.push(maxDryDensity > 0 ? maxDryDensity.toFixed(3) : '');
          } else if (['pit_sand', 'pit_volume', 'wet_density', 'water_content', 'dry_density', 'compaction'].includes(key)) {
            values.push(calcField(key, tv, maxDryDensity));
          } else {
            values.push(tv[key] !== undefined && tv[key] !== null ? String(tv[key]) : '');
          }
        }

        const result = fillDataRow(xml, label, values, searchPos);
        xml = result.xml;
        searchPos = result.nextPos;
      }

      // --- 底部签名 ---
      xml = replaceAfterLabel(xml, '试验人：', extra.tester || '');
      xml = replaceAfterLabel(xml, '复核人：', extra.reviewer || '');

      if (extra.test_date) {
        const parts = String(extra.test_date).split(/[-/]/);
        if (parts.length === 3) {
          xml = replaceAfterLabel(xml, '试验日期：', parts[0]);
          xml = replaceInRun(xml, '年', parts[1], true);
          xml = replaceInRun(xml, '月', parts[2], true);
        }
      }

      // 保存修改后的 docx
      zip.file('word/document.xml', xml);
      // 确保路径使用反斜杠（Word COM 需要）
      const tmpDocx = os.tmpdir().replace(/\//g, '\\') + '\\' + `record_${entrustId}_p${record.page_no}.docx`;
      const tmpPdf = os.tmpdir().replace(/\//g, '\\') + '\\' + `record_${entrustId}_p${record.page_no}.pdf`;
      const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      fs.writeFileSync(tmpDocx, buf);
      convertPairs.push({ docx: tmpDocx, pdf: tmpPdf, pageNo: record.page_no });
    }

    // 5. 批量转换 — 只打开一次 Word
    if (convertPairs.length > 0) {
      try {
        await batchDocxToPdf(convertPairs);
      } catch (convErr) {
        throw new Error('PDF转换失败: ' + convErr.message);
      }
    }

    // 6. 读取并清理临时文件
    const pdfBuffers = [];
    for (const pair of convertPairs) {
      try {
        if (fs.existsSync(pair.pdf)) {
          pdfBuffers.push({ pageNo: pair.pageNo, buffer: fs.readFileSync(pair.pdf) });
        }
      } catch {}
      try { fs.unlinkSync(pair.docx); } catch {}
      try { fs.unlinkSync(pair.pdf); } catch {}
    }

    // 7. 合并多页 PDF
    const { PDFDocument: PDFLib } = require('pdf-lib');
    const merged = await PDFLib.create();

    for (const { buffer } of pdfBuffers.sort((a, b) => a.pageNo - b.pageNo)) {
      const src = await PDFLib.load(buffer);
      const pages = await merged.embedPdf(src);
      for (let i = 0; i < pages.length; i++) {
        const page = merged.addPage([pages[i].width, pages[i].height]);
        page.drawPage(pages[i]);
      }
    }

    const finalPdf = await merged.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${entrust.entrust_no}.pdf"`);
    res.send(Buffer.from(finalPdf));
  } catch (err) {
    console.error('PDF生成失败:', err);
    res.status(500).json({ code: 500, message: 'PDF生成失败: ' + err.message });
  }
};

// ===== XML 操作辅助函数 =====

// 在标签文字后找到紧跟的空数据单元格，填入 value
function fillCellAfter(xml, label, value) {
  const labelIdx = xml.indexOf(label);
  if (labelIdx === -1) return xml;

  // 精确匹配 <w:tc> 或 <w:tc >（排除 <w:tcPr>）
  const tc1 = xml.lastIndexOf('<w:tc>', labelIdx);
  const tc2 = xml.lastIndexOf('<w:tc ', labelIdx);
  const labelTcStart = Math.max(tc1, tc2);
  if (labelTcStart === -1) return xml;

  const labelTcEnd = xml.indexOf('</w:tc>', labelIdx);
  if (labelTcEnd === -1) return xml;

  // 从标签单元格结束位置之后找下一个 <w:tc>（数据单元格）
  const nextTcStart = xml.indexOf('<w:tc', labelTcEnd + '</w:tc>'.length);
  if (nextTcStart === -1) return xml;

  const nextTcEnd = xml.indexOf('</w:tc>', nextTcStart);
  if (nextTcEnd === -1) return xml;

  // 获取 <w:tc> 标签的实际结束位置（可能有属性）
  const tcTagEnd = xml.indexOf('>', nextTcStart);
  let tcContent = xml.substring(tcTagEnd + 1, nextTcEnd);

  // 移除预置干扰文字（<w:r[\s>] 确保只匹配 <w:r> 而不匹配 <w:rPr>）
  tcContent = tcContent.replace(/<w:r[\s>][\s\S]*?<w:t[^>]*>[^<]*g\/[^<]*cm[^<]*<\/w:t>[\s\S]*?<\/w:r>/g, '');
  tcContent = tcContent.replace(/<w:r[\s>][\s\S]*?<w:t[^>]*>3<\/w:t>[\s\S]*?<\/w:r>/g, '');
  tcContent = tcContent.replace(/<w:r[\s>][\s\S]*?<w:t[^>]*>塘渣层<\/w:t>[\s\S]*?<\/w:r>/g, '');

  // 填入新值
  if (value && tcContent.includes('</w:pPr>')) {
    const newRun = `<w:r><w:rPr><w:rFonts w:ascii="宋体" w:hAnsi="宋体" w:hint="eastAsia"/><w:szCs w:val="21"/></w:rPr><w:t xml:space="preserve">${escXml(value)}</w:t></w:r>`;
    tcContent = tcContent.replace('</w:pPr>', '</w:pPr>' + newRun);
  }

  // 保留原始开始标签（可能包含属性如宽度）
  const actualTcOpen = xml.substring(nextTcStart, tcTagEnd + 1);
  const oldTc = xml.substring(nextTcStart, nextTcEnd + '</w:tc>'.length);
  xml = xml.replace(oldTc, actualTcOpen + tcContent + '</w:tc>');
  return xml;
}

// 填入数据行（9列），返回 { xml, nextPos } 供后续搜索
function fillDataRow(xml, label, values, startPos) {
  let pos = startPos || 0;
  let idx;

  // 循环查找，跳过不在 <w:tr> 内的匹配（如标签出现在表头段落中）
  while ((idx = xml.indexOf(label, pos)) !== -1) {
    const rowStart = xml.lastIndexOf('<w:tr', idx);
    const rowEnd = xml.indexOf('</w:tr>', idx) + '</w:tr>'.length;

    // 在有效的 <w:tr> 行内找到了
    if (rowStart === -1 || rowEnd <= rowStart) {
      pos = idx + label.length; // 跳过此匹配，继续搜索下一个
      continue;
    }

  const rowXml = xml.substring(rowStart, rowEnd);
  let newRowXml = rowXml;

  // 提取所有 tc（处理有无属性的情况）
  const tcRegex = /<w:tc\b([^>]*)>([\s\S]*?)<\/w:tc>/g;
  const tcs = [];
  let m;
  while ((m = tcRegex.exec(rowXml)) !== null) {
    tcs.push({ full: m[0], openTag: '<w:tc' + m[1] + '>', content: m[2] });
  }

  // 跳过标签所在的 tc，后面的填数据
  let col = 0;
  let skipped = false;
  for (const tc of tcs) {
    if (!skipped && tc.content.includes(label)) { skipped = true; continue; }
    if (!skipped) continue;
    if (col >= 9) break;

    const val = values[col] || '';

    // 清除原有文本（如果有 g/cm³ 之类的）
    let newContent = tc.content
      .replace(/<w:r[\s>][\s\S]*?<w:t[^>]*>[^<]*g\/[^<]*cm[^<]*<\/w:t>[\s\S]*?<\/w:r>/g, '')
      .replace(/<w:r[\s>][\s\S]*?<w:t[^>]*>3<\/w:t>[\s\S]*?<\/w:r>/g, '');

    // 插入数据 run
    if (val && newContent.includes('</w:pPr>')) {
      const newRun = `<w:r><w:rPr><w:rFonts w:ascii="宋体" w:hAnsi="宋体" w:hint="eastAsia"/><w:szCs w:val="21"/></w:rPr><w:t xml:space="preserve">${escXml(val)}</w:t></w:r>`;
      newContent = newContent.replace('</w:pPr>', '</w:pPr>' + newRun);
    }

    newRowXml = newRowXml.replace(tc.full, tc.openTag + newContent + '</w:tc>');
    col++;
  }

    xml = xml.replace(rowXml, newRowXml);
    return { xml, nextPos: rowStart + newRowXml.length };
  }

  return { xml, nextPos: pos };
}

// 替换标签后的文本（同一段落内）
function replaceAfterLabel(xml, label, value) {
  // 找到标签所在的 w:t 元素，在其后的空格处插入值
  const pattern = `(<w:t[^>]*>${escXml(label)})(\\s*)(<\\/w:t>)`;
  const re = new RegExp(pattern);
  if (re.test(xml)) {
    return xml.replace(re, `$1${escXml(value)}$3`);
  }
  // 备选：在标签后的第一个空格处插入
  const idx = xml.indexOf(label);
  if (idx !== -1) {
    const after = xml.substring(idx + label.length);
    // 在 w:t 内标签后的空格中放入值
    const runMatch = after.match(/(<w:t[^>]* xml:space="preserve">)(\s*)(?=年<\/w:t>|月<\/w:t>|日<\/w:t>|<)/);
    if (runMatch) {
      const start = idx + label.length + runMatch.index + runMatch[1].length;
      const end = start + runMatch[2].length;
      xml = xml.substring(0, start) + escXml(value) + xml.substring(end);
    }
  }
  return xml;
}

// 在一个 run 的 <w:t> 中，在特殊字符（年月日）前插入值
function replaceInRun(xml, char, value, before) {
  if (before) {
    // 在 "年" 前插入月份值 → 找到 "年" 前最近的空白 w:t
    const pattern = new RegExp(
      `(<w:t[^>]* xml:space="preserve">)(\\s*)${escXml(char)}`,
      'g'
    );
    let found = false;
    xml = xml.replace(pattern, (match, p1, spaces) => {
      if (found) return match; // 只替换第一次
      found = true;
      return p1 + escXml(value) + char;
    });
  }
  return xml;
}

// XML 特殊字符转义
function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== 计算字段 =====
function calcField(key, tv, maxDryDensity) {
  const n = (k) => { const v = parseFloat(tv[k]); return isNaN(v) ? 0 : v; };

  const sandBefore = n('sand_before');
  const sandAfter = n('sand_after');
  const sandSurface = n('sand_surface');
  const sandDensity = n('sand_density');
  const wetMass = n('wet_mass');
  const boxWet = n('box_wet');
  const boxDry = n('box_dry');
  const boxMass = n('box_mass');

  const pitSand = sandBefore - sandAfter - sandSurface;
  const pitVolume = sandDensity > 0 && pitSand > 0 ? pitSand / sandDensity : 0;
  const wetDensity = pitVolume > 0 && wetMass > 0 ? wetMass / pitVolume : 0;
  const dryMass = boxDry - boxMass;
  const waterContent = dryMass > 0 ? (boxWet - boxDry) / dryMass * 100 : 0;
  const dryDensity = wetDensity > 0 ? wetDensity / (1 + waterContent / 100) : 0;
  const compaction = maxDryDensity > 0 && dryDensity > 0 ? dryDensity / maxDryDensity * 100 : 0;

  switch (key) {
    case 'pit_sand':      return pitSand > 0 ? pitSand.toFixed(1) : '';
    case 'pit_volume':    return pitVolume > 0 ? pitVolume.toFixed(1) : '';
    case 'wet_density':   return wetDensity > 0 ? wetDensity.toFixed(3) : '';
    case 'water_content': return waterContent > 0 ? waterContent.toFixed(1) : '';
    case 'dry_density':   return dryDensity > 0 ? dryDensity.toFixed(3) : '';
    case 'compaction':    return compaction > 0 ? compaction.toFixed(1) : '';
    default: return '';
  }
}
