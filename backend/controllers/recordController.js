const path = require('path');
const fs = require('fs');
const os = require('os');
const PizZip = require('pizzip');
const { query, getDb } = require('../config/db');
const { generateSampleNos } = require('../utils/codeGenerator');
const { batchDocxToPdf } = require('../utils/pdfConverter');
const { bankersRound } = require('../utils/rounding');
const { injectComputedValues } = require('../utils/compaction');

exports.getRecords = async (req, res) => {
  try {
    const { entrustNo } = req.params;
    const [entrusts] = query(
      `SELECT e.*, p.project_no, p.project_name, p.client_unit, p.client_person,
              p.supervision_unit, p.witness_person, p.construction_unit, p.build_unit
       FROM biz_entrust e
       LEFT JOIN biz_project p ON e.project_id = p.id
       WHERE e.entrust_no = ?`, [entrustNo]
    );
    if (entrusts.length === 0) {
      return res.status(404).json({ code: 404, message: '委托单不存在' });
    }
    const entrust = entrusts[0];
    const entrustId = entrust.id;

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
        const parsedRows = rows.map(r => {
          const item = items.find(it => it.position_name === r.position_name)
          return {
            ...r,
            material: item?.material || '',
            test_values: typeof r.test_values === 'string' ? JSON.parse(r.test_values) : (r.test_values || {}),
            _empty: !r.sample_no
          }
        });
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

        // 旧格式兼容
        let maxDryDensities = extra.max_dry_densities || {};
        if (!Object.keys(maxDryDensities).length && extra.max_dry_density) {
          const mats = [...new Set(items.map(i => i.material).filter(Boolean))];
          if (mats.length > 0) maxDryDensities[mats[0]] = extra.max_dry_density;
        }

        pages.push({
          page_no: record.page_no,
          total_pages: record.total_pages,
          template_type: record.template_type,
          header_data: headerData,
          extra: {
            structure_layer: extra.structure_layer || '',
            design_req: extra.design_req || '',
            max_dry_densities: maxDryDensities,
            max_dry_density: Object.values(maxDryDensities).find(Boolean) || '',
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
            structure_layer: '', design_req: '', max_dry_densities: {}, max_dry_density: '',
            conclusion: '', remark_footer: '', tester: '', reviewer: '', test_date: ''
          },
          rows: pageRows
        });
      }
    }

    entrust.items = items;
    res.json({ code: 200, data: { entrust, totalSampleCount, totalPages, pages } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
};

exports.updateRows = async (req, res) => {
  try {
    const db = getDb();
    const { entrustNo } = req.params;
    const [entrusts] = query('SELECT id FROM biz_entrust WHERE entrust_no = ?', [entrustNo]);
    if (entrusts.length === 0) return res.status(404).json({ code: 404, message: '委托单不存在' });
    const entrustId = entrusts[0].id;
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

        const maxDryDensities = extra.max_dry_densities || {};

        const [recordResult] = query(
          `INSERT INTO biz_original_record (entrust_id, page_no, total_pages, template_type, header_data, remark, create_time, update_time)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
          [entrustId, pageNo, pageRows[0].total_pages || 1, pageRows[0].template_type || 'pipe_compaction',
           JSON.stringify(pageRows[0].header_data || {}), remark]
        );
        const recordId = recordResult.insertId;

        for (const row of pageRows) {
          // 查找该行的最大干密度
          let maxDry = 0;
          const mat = row.test_values?.material || row.material || '';
          if (mat && maxDryDensities[mat]) {
            maxDry = parseFloat(maxDryDensities[mat]) || 0;
          } else {
            const vals = Object.values(maxDryDensities).filter(Boolean);
            if (vals.length > 0) maxDry = parseFloat(vals[0]) || 0;
          }

          // 注入干密度和压实度到 test_values
          const testValues = injectComputedValues(row.test_values || {}, maxDry);

          query(
            `INSERT INTO biz_original_record_item (record_id, seq_no, sample_no, position_name, layer, test_values)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [recordId, row.seq_no, row.sample_no, row.position_name, row.layer,
             JSON.stringify(testValues)]
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
    const { entrustNo } = req.params;

    // 1. 查询数据
    const [entrusts] = query(
      `SELECT e.*, p.project_no, p.project_name, p.client_unit, p.client_person,
              p.supervision_unit, p.witness_person, p.construction_unit, p.build_unit
       FROM biz_entrust e LEFT JOIN biz_project p ON e.project_id = p.id
       WHERE e.entrust_no = ?`, [entrustNo]
    );
    if (entrusts.length === 0) {
      return res.status(404).json({ code: 404, message: '委托单不存在' });
    }
    const entrust = entrusts[0];
    const entrustId = entrust.id;

    const [savedRecords] = query(
      'SELECT * FROM biz_original_record WHERE entrust_id = ? ORDER BY page_no', [entrustId]
    );
    if (savedRecords.length === 0) {
      return res.status(400).json({ code: 400, message: '请先保存记录数据后再打印' });
    }

    // 根据 template_type 选择模板
    const tmplType = savedRecords[0]?.template_type || 'roadbed_sand';
    const isPipe = tmplType === 'pipe_compaction';
    const templateName = isPipe
      ? '压实度（管道）（灌砂法）检测原始记录单.docx'
      : '压实度（道路）（灌砂法）检测原始记录单.docx';
    const templatePath = path.join(__dirname, '..', '..', 'temp', templateName);
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ code: 404, message: 'DOCX模板文件不存在' });
    }

    // 3. 读取材料
    const [items] = query(
      'SELECT material, position_name FROM biz_compaction_item WHERE entrust_id = ? ORDER BY sort', [entrustId]
    );
    const materials = [...new Set(items.map(i => i.material).filter(Boolean))];
    const materialStr = materials.join('、');

    const totalPages = Math.max(...savedRecords.map(r => r.total_pages || 1));

    // 从有数据的页中提取共享的 extra（多页共用同一表头信息）
    let sharedExtra = {};
    for (const rec of savedRecords) {
      try {
        const r = typeof rec.remark === 'string' ? JSON.parse(rec.remark) : (rec.remark || {});
        if (r.max_dry_density || r.max_dry_densities || r.structure_layer || r.design_req || r.conclusion || r.tester) {
          sharedExtra = r;
          break;
        }
      } catch {}
    }

    // 最大干密度映射：{ '砂': '2.11', '石屑': '2.05' }
    const maxDryDensities = sharedExtra.max_dry_densities || {};
    if (!Object.keys(maxDryDensities).length && sharedExtra.max_dry_density) {
      const mats = [...new Set(items.map(i => i.material).filter(Boolean))];
      if (mats.length > 0) maxDryDensities[mats[0]] = sharedExtra.max_dry_density;
    }
    const maxDryDisplay = (() => {
      const entries = Object.entries(maxDryDensities).filter(([, v]) => v);
      if (!entries.length) return '';
      if (entries.length === 1) return `${entries[0][1]} g/cm³`;
      return entries.map(([k, v]) => `${k} ${v} g/cm³`).join('，');
    })();

    function getRowMaxDry(rd) {
      if (rd.material && maxDryDensities[rd.material]) {
        return parseFloat(maxDryDensities[rd.material]) || 0;
      }
      const vals = Object.values(maxDryDensities).filter(Boolean);
      return vals.length > 0 ? parseFloat(vals[0]) || 0 : 0;
    }

    const convertPairs = []; // { docx, pdf, pageNo }

    for (const record of savedRecords) {
      // 解析数据
      let headerData = {};
      try {
        headerData = typeof record.header_data === 'string'
          ? JSON.parse(record.header_data) : (record.header_data || {});
      } catch { headerData = {}; }

      const [rows] = query(
        'SELECT * FROM biz_original_record_item WHERE record_id = ? ORDER BY seq_no', [record.id]
      );
      const parsedRows = rows.map(r => {
        const item = items.find(it => it.position_name === r.position_name);
        return {
          ...r,
          material: item?.material || '',
          test_values: typeof r.test_values === 'string'
            ? JSON.parse(r.test_values) : (r.test_values || {})
        };
      });

      // 4. 填充 docx
      const zip = new PizZip(fs.readFileSync(templatePath));
      let xml = zip.files['word/document.xml'].asText();
      // 全局修正西文字体为 Times New Roman，去除东亚文字提示
      xml = xml.replace(/w:ascii="宋体"/g, 'w:ascii="Times New Roman"');
      xml = xml.replace(/w:hAnsi="宋体"/g, 'w:hAnsi="Times New Roman"');
      xml = xml.replace(/w:hint="eastAsia"/g, '');

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
        { label: '结构层次',   value: sharedExtra.structure_layer || materialStr },
        { label: '设计要求',   value: sharedExtra.design_req || '' },
        { label: '最大干密度', value: maxDryDisplay },
        { label: '检测结论',   value: sharedExtra.conclusion || '' },
        { label: '备    注',   value: sharedExtra.remark_footer || '' },
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
        'water_content', 'dry_density', 'max_dry_density',
        'compaction'
      ];
      const dataRowLabels = [
        '编号', '桩号', isPipe ? '取样位置' : '取样位置距中', '灌砂前砂', '灌砂后',
        '合计质量', '试坑灌入量砂', '量砂堆积', '试坑体积',
        '试坑中挖出的湿料质量', '试样湿密度', '盒号',
        '盒质量', '湿料质量', '干料质量',
        '含水率', '干密度', '最大干密度',
        '压实度'
      ];

      let searchPos = 0;
      for (let ri = 0; ri < dataRowLabels.length; ri++) {
        const label = dataRowLabels[ri];
        const key = paramKeys[ri];
        // 管道模板的桩号/取样位置每3列合并，按组填充
        const groupSize = (isPipe && (key === 'stake_no' || key === 'position')) ? 3 : 1;
        const groupCount = groupSize > 1 ? Math.ceil(9 / groupSize) : 9;
        const values = [];

        for (let col = 0; col < 9; col++) {
          const rd = parsedRows[col];
          if (!rd || rd._empty) { values.push(''); continue; }
          const tv = rd.test_values || {};

          if (key === 'sample') {
            values.push(String(rd.seq_no || col + 1));
          } else if (key === 'max_dry_density') {
            const mdd = getRowMaxDry(rd);
            values.push(mdd > 0 ? bankersRound(mdd, 2) : '');
          } else if (['pit_sand', 'pit_volume', 'wet_density', 'water_content', 'dry_density', 'compaction'].includes(key)) {
            values.push(calcField(key, tv, getRowMaxDry(rd)));
          } else {
            values.push(tv[key] !== undefined && tv[key] !== null ? String(tv[key]) : '');
          }
        }

        // 合并模式：取每组第一个样品的值作为该组的值
        const fillValues = groupSize > 1
          ? (() => { const gv = []; for (let g = 0; g < groupCount; g++) gv.push(values[g * groupSize] || ''); return gv; })()
          : values;

        const result = fillDataRow(xml, label, fillValues, searchPos);
        xml = result.xml;
        searchPos = result.nextPos;
      }

      // --- 底部签名 ---
      xml = replaceAfterLabel(xml, '试验人：', sharedExtra.tester || '');
      xml = replaceAfterLabel(xml, '复核人：', sharedExtra.reviewer || '');

      xml = fillTestDate(xml, sharedExtra.test_date);

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

// ===== 打印进度追踪 =====
const printJobs = new Map();

// 每 5 分钟清理超过 10 分钟的过期任务
setInterval(() => {
  const now = Date.now();
  for (const [taskId, job] of printJobs) {
    // taskId 前 8 位是时间戳（36进制），解码后判断是否过期
    const ts = parseInt(taskId, 36);
    if (!isNaN(ts) && now - ts > 10 * 60 * 1000) {
      if (job.pdfPath) try { fs.unlinkSync(job.pdfPath); } catch {}
      printJobs.delete(taskId);
    }
  }
}, 5 * 60 * 1000);

function yield_() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// POST /:entrustNo/print/start — 启动打印任务
exports.startPrint = async (req, res) => {
  try {
    const { entrustNo } = req.params;
    const [entrusts] = query('SELECT id FROM biz_entrust WHERE entrust_no = ?', [entrustNo]);
    if (entrusts.length === 0) return res.status(404).json({ code: 404, message: '委托单不存在' });
    const entrustId = entrusts[0].id;
    const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    printJobs.set(taskId, { step: 0, totalSteps: 1, message: '准备中...', done: false, error: null, pdfPath: null });

    // 异步处理，不阻塞响应
    generatePdf(entrustId, taskId).catch(err => {
      const job = printJobs.get(taskId);
      if (job) { job.message = err.message; job.error = true; job.done = true; }
    });

    res.json({ code: 200, data: { taskId } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// GET /:id/print/status/:taskId — 查询打印进度
exports.printStatus = (req, res) => {
  const job = printJobs.get(req.params.taskId);
  if (!job) return res.status(404).json({ code: 404, message: '任务不存在或已过期' });
  res.json({ code: 200, data: job });
};

// GET /:id/print/download/:taskId — 下载生成的 PDF
exports.printDownload = (req, res) => {
  const job = printJobs.get(req.params.taskId);
  if (!job || !job.pdfPath) return res.status(404).json({ code: 404, message: 'PDF未就绪' });

  const pdfPath = job.pdfPath;
  if (!fs.existsSync(pdfPath)) return res.status(404).json({ code: 404, message: 'PDF文件已丢失，请重新生成' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(pdfPath)}"`);

  const stream = fs.createReadStream(pdfPath);
  stream.pipe(res);
  stream.on('end', () => {
    try { fs.unlinkSync(pdfPath); } catch {}
    printJobs.delete(req.params.taskId);
  });
};

// ===== 空白记录单打印 =====

// POST /:entrustNo/print/blank/start — 启动空白记录单打印任务
exports.startPrintBlank = async (req, res) => {
  try {
    const { entrustNo } = req.params;
    const [entrusts] = query('SELECT id FROM biz_entrust WHERE entrust_no = ?', [entrustNo]);
    if (entrusts.length === 0) return res.status(404).json({ code: 404, message: '委托单不存在' });
    const entrustId = entrusts[0].id;
    const taskId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    printJobs.set(taskId, { step: 0, totalSteps: 1, message: '准备中...', done: false, error: null, pdfPath: null });

    generateBlankPdf(entrustId, taskId).catch(err => {
      const job = printJobs.get(taskId);
      if (job) { job.message = err.message; job.error = true; job.done = true; }
    });

    res.json({ code: 200, data: { taskId } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// GET /:id/print/blank/status/:taskId — 查询空白打印进度
exports.printBlankStatus = (req, res) => {
  const job = printJobs.get(req.params.taskId);
  if (!job) return res.status(404).json({ code: 404, message: '任务不存在或已过期' });
  res.json({ code: 200, data: job });
};

// GET /:id/print/blank/download/:taskId — 下载空白记录单 PDF
exports.printBlankDownload = (req, res) => {
  const job = printJobs.get(req.params.taskId);
  if (!job || !job.pdfPath) return res.status(404).json({ code: 404, message: 'PDF未就绪' });

  const pdfPath = job.pdfPath;
  if (!fs.existsSync(pdfPath)) return res.status(404).json({ code: 404, message: 'PDF文件已丢失，请重新生成' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(pdfPath)}"`);

  const stream = fs.createReadStream(pdfPath);
  stream.pipe(res);
  stream.on('end', () => {
    try { fs.unlinkSync(pdfPath); } catch {}
    printJobs.delete(req.params.taskId);
  });
};

// 异步生成空白记录单 PDF（仅抬头和编号，不填检测数据）
async function generateBlankPdf(entrustId, taskId) {
  const update = (step, total, msg) => {
    printJobs.set(taskId, { step, totalSteps: total, message: msg, done: false, error: null, pdfPath: null });
  };

  // Step 1: 查询数据
  update(1, 3, '正在查询数据...');
  await yield_();

  const [entrusts] = query(
    `SELECT e.*, p.project_no, p.project_name, p.client_unit, p.client_person,
            p.supervision_unit, p.witness_person, p.construction_unit, p.build_unit
     FROM biz_entrust e LEFT JOIN biz_project p ON e.project_id = p.id
     WHERE e.id = ?`, [entrustId]
  );
  if (entrusts.length === 0) throw new Error('委托单不存在');
  const entrust = entrusts[0];

  const [savedRecords] = query(
    'SELECT * FROM biz_original_record WHERE entrust_id = ? ORDER BY page_no', [entrustId]
  );
  if (savedRecords.length === 0) throw new Error('请先初始化记录数据后再打印');

  const tmplType = savedRecords[0]?.template_type || 'roadbed_sand';
  const isPipe = tmplType === 'pipe_compaction';
  const templateName = isPipe
    ? '压实度（管道）（灌砂法）检测原始记录单.docx'
    : '压实度（道路）（灌砂法）检测原始记录单.docx';
  const templatePath = path.join(__dirname, '..', '..', 'temp', templateName);
  if (!fs.existsSync(templatePath)) throw new Error('DOCX模板文件不存在');

  const [items] = query(
    'SELECT material, position_name FROM biz_compaction_item WHERE entrust_id = ? ORDER BY sort', [entrustId]
  );
  const materials = [...new Set(items.map(i => i.material).filter(Boolean))];
  const materialStr = materials.join('、');

  const totalPages = Math.max(...savedRecords.map(r => r.total_pages || 1));
  const entrustNo = entrust.entrust_no;

  let sharedExtra = {};
  for (const rec of savedRecords) {
    try {
      const r = typeof rec.remark === 'string' ? JSON.parse(rec.remark) : (rec.remark || {});
      if (r.max_dry_density || r.max_dry_densities || r.structure_layer || r.design_req || r.conclusion || r.tester) {
        sharedExtra = r; break;
      }
    } catch {}
  }

  const maxDryDensities = sharedExtra.max_dry_densities || {};
  if (!Object.keys(maxDryDensities).length && sharedExtra.max_dry_density) {
    const mats = [...new Set(items.map(i => i.material).filter(Boolean))];
    if (mats.length > 0) maxDryDensities[mats[0]] = sharedExtra.max_dry_density;
  }
  const maxDryDisplay = (() => {
    const entries = Object.entries(maxDryDensities).filter(([, v]) => v);
    if (!entries.length) return '';
    if (entries.length === 1) return `${entries[0][1]} g/cm³`;
    return entries.map(([k, v]) => `${k} ${v} g/cm³`).join('，');
  })();

  // 总步骤：查询(1) + 逐页生成(N) + 转换(1) + 合并(1) = N+3
  const totalSteps = savedRecords.length + 3;
  const convertPairs = [];

  const cellMap = [
    { label: '工程名称',   value: '' },
    { label: '委托单位',   value: '' },
    { label: '见证单位',   value: '' },
    { label: '结构层次',   value: sharedExtra.structure_layer || materialStr },
    { label: '设计要求',   value: sharedExtra.design_req || '' },
    { label: '最大干密度', value: maxDryDisplay },
    { label: '检测结论',   value: sharedExtra.conclusion || '' },
    { label: '备    注',   value: sharedExtra.remark_footer || '' },
  ];

  // Step 2: 逐页生成 docx
  for (let pi = 0; pi < savedRecords.length; pi++) {
    const record = savedRecords[pi];
    update(pi + 2, totalSteps, `正在生成第 ${pi + 1}/${savedRecords.length} 页空白文档...`);
    await yield_();

    let headerData = {};
    try {
      headerData = typeof record.header_data === 'string'
        ? JSON.parse(record.header_data) : (record.header_data || {});
    } catch { headerData = {}; }

    const [rows] = query(
      'SELECT * FROM biz_original_record_item WHERE record_id = ? ORDER BY seq_no', [record.id]
    );
    const parsedRows = rows.map(r => ({
      ...r,
      test_values: typeof r.test_values === 'string'
        ? JSON.parse(r.test_values) : (r.test_values || {})
    }));

    const zip = new PizZip(fs.readFileSync(templatePath));
    let xml = zip.files['word/document.xml'].asText();
    // 全局修正西文字体为 Times New Roman
    xml = xml.replace(/w:ascii="宋体"/g, 'w:ascii="Times New Roman"');
    xml = xml.replace(/w:hAnsi="宋体"/g, 'w:hAnsi="Times New Roman"');

    xml = xml.replace(
      '委托编号：                      共   页第   页              记录单编号：',
      `委托编号：${entrustNo}              共 ${totalPages} 页第 ${record.page_no} 页              记录单编号：`
    );
    xml = xml.replace('JL/', `JL/${entrustNo}`);

    const pageCellMap = cellMap.map(c => {
      if (c.label === '工程名称') return { ...c, value: headerData.project_name || entrust.project_name || '' };
      if (c.label === '委托单位') return { ...c, value: headerData.client_unit || entrust.client_unit || '' };
      if (c.label === '见证单位') return { ...c, value: headerData.supervision_unit || entrust.supervision_unit || '' };
      return c;
    });
    for (const { label, value } of pageCellMap) {
      xml = fillCellAfter(xml, label, value);
    }

    // 仅填写编号行，其余数据行留空
    let searchPos = 0;
    const sampleLabel = '编号';
    const sampleValues = [];
    for (let col = 0; col < 9; col++) {
      const rd = parsedRows[col];
      if (!rd || rd._empty) { sampleValues.push(''); continue; }
      sampleValues.push(String(rd.seq_no || col + 1));
    }
    const result = fillDataRow(xml, sampleLabel, sampleValues, searchPos);
    xml = result.xml;
    searchPos = result.nextPos;

    // 填写页脚信息（试验人、复核人、日期）
    xml = replaceAfterLabel(xml, '试验人：', sharedExtra.tester || '');
    xml = replaceAfterLabel(xml, '复核人：', sharedExtra.reviewer || '');
    if (sharedExtra.test_date) {
      const parts = String(sharedExtra.test_date).split(/[-/]/);
      if (parts.length === 3) {
        xml = replaceAfterLabel(xml, '试验日期：', parts[0]);
        xml = replaceInRun(xml, '年', parts[1], true);
        xml = replaceInRun(xml, '月', parts[2], true);
      }
    }

    zip.file('word/document.xml', xml);
    const tmpDocx = os.tmpdir().replace(/\//g, '\\') + '\\' + `blank_${entrustId}_p${record.page_no}.docx`;
    const tmpPdf = os.tmpdir().replace(/\//g, '\\') + '\\' + `blank_${entrustId}_p${record.page_no}.pdf`;
    const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(tmpDocx, buf);
    convertPairs.push({ docx: tmpDocx, pdf: tmpPdf, pageNo: record.page_no });
  }

  // Step N+3: PDF 转换
  update(totalSteps - 1, totalSteps, `正在转换 PDF（共 ${convertPairs.length} 页）...`);
  await yield_();

  if (convertPairs.length > 0) {
    await batchDocxToPdf(convertPairs);
  }
  await yield_();

  // Step N+4: 合并 PDF
  update(totalSteps, totalSteps, '正在合并 PDF...');
  await yield_();

  const pdfBuffers = [];
  for (const pair of convertPairs) {
    try {
      if (fs.existsSync(pair.pdf)) pdfBuffers.push({ pageNo: pair.pageNo, buffer: fs.readFileSync(pair.pdf) });
    } catch {}
    try { fs.unlinkSync(pair.docx); } catch {}
    try { fs.unlinkSync(pair.pdf); } catch {}
  }

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
  const pdfPath = path.join(os.tmpdir(), `blank_${entrustId}_${Date.now()}.pdf`);
  fs.writeFileSync(pdfPath, finalPdf);

  printJobs.set(taskId, {
    step: totalSteps, totalSteps, message: '生成完成，正在下载...',
    done: true, error: null, pdfPath
  });
}

// 异步生成 PDF，逐步更新进度
async function generatePdf(entrustId, taskId) {
  const update = (step, total, msg) => {
    printJobs.set(taskId, { step, totalSteps: total, message: msg, done: false, error: null, pdfPath: null });
  };

  // Step 1: 查询数据
  update(1, 3, '正在查询数据...');
  await yield_();

  const [entrusts] = query(
    `SELECT e.*, p.project_no, p.project_name, p.client_unit, p.client_person,
            p.supervision_unit, p.witness_person, p.construction_unit, p.build_unit
     FROM biz_entrust e LEFT JOIN biz_project p ON e.project_id = p.id
     WHERE e.id = ?`, [entrustId]
  );
  if (entrusts.length === 0) throw new Error('委托单不存在');
  const entrust = entrusts[0];

  const [savedRecords] = query(
    'SELECT * FROM biz_original_record WHERE entrust_id = ? ORDER BY page_no', [entrustId]
  );
  if (savedRecords.length === 0) throw new Error('请先保存记录数据后再打印');

  const tmplType = savedRecords[0]?.template_type || 'roadbed_sand';
  const isPipe = tmplType === 'pipe_compaction';
  const templateName = isPipe
    ? '压实度（管道）（灌砂法）检测原始记录单.docx'
    : '压实度（道路）（灌砂法）检测原始记录单.docx';
  const templatePath = path.join(__dirname, '..', '..', 'temp', templateName);
  if (!fs.existsSync(templatePath)) throw new Error('DOCX模板文件不存在');

  const [items] = query(
    'SELECT material, position_name FROM biz_compaction_item WHERE entrust_id = ? ORDER BY sort', [entrustId]
  );
  const materials = [...new Set(items.map(i => i.material).filter(Boolean))];
  const materialStr = materials.join('、');

  const totalPages = Math.max(...savedRecords.map(r => r.total_pages || 1));
  const entrustNo = entrust.entrust_no;

  let sharedExtra = {};
  for (const rec of savedRecords) {
    try {
      const r = typeof rec.remark === 'string' ? JSON.parse(rec.remark) : (rec.remark || {});
      if (r.max_dry_density || r.max_dry_densities || r.structure_layer || r.design_req || r.conclusion || r.tester) {
        sharedExtra = r; break;
      }
    } catch {}
  }

  // 最大干密度映射：{ '砂': '2.11', '石屑': '2.05' }
  const maxDryDensities = sharedExtra.max_dry_densities || {};
  if (!Object.keys(maxDryDensities).length && sharedExtra.max_dry_density) {
    const mats = [...new Set(items.map(i => i.material).filter(Boolean))];
    if (mats.length > 0) maxDryDensities[mats[0]] = sharedExtra.max_dry_density;
  }
  const maxDryDisplay = (() => {
    const entries = Object.entries(maxDryDensities).filter(([, v]) => v);
    if (!entries.length) return '';
    if (entries.length === 1) return `${entries[0][1]} g/cm³`;
    return entries.map(([k, v]) => `${k} ${v} g/cm³`).join('，');
  })();

  function getRowMaxDry(rd) {
    if (rd.material && maxDryDensities[rd.material]) {
      return parseFloat(maxDryDensities[rd.material]) || 0;
    }
    const vals = Object.values(maxDryDensities).filter(Boolean);
    return vals.length > 0 ? parseFloat(vals[0]) || 0 : 0;
  }

  // 总步骤：查询(1) + 逐页生成(N) + 转换(1) + 合并(1) = N+3
  const totalSteps = savedRecords.length + 3;
  const convertPairs = [];

  const paramKeys = [
    'sample', 'stake_no', 'position',
    'sand_before', 'sand_after', 'sand_surface',
    'pit_sand', 'sand_density', 'pit_volume',
    'wet_mass', 'wet_density', 'box_no',
    'box_mass', 'box_wet', 'box_dry',
    'water_content', 'dry_density', 'max_dry_density',
    'compaction'
  ];
  const dataRowLabels = [
    '编号', '桩号', isPipe ? '取样位置' : '取样位置距中', '灌砂前砂', '灌砂后',
    '合计质量', '试坑灌入量砂', '量砂堆积', '试坑体积',
    '试坑中挖出的湿料质量', '试样湿密度', '盒号',
    '盒质量', '湿料质量', '干料质量',
    '含水率', '干密度', '最大干密度',
    '压实度'
  ];
  const cellMap = [
    { label: '工程名称',   value: '' },
    { label: '委托单位',   value: '' },
    { label: '见证单位',   value: '' },
    { label: '结构层次',   value: sharedExtra.structure_layer || materialStr },
    { label: '设计要求',   value: sharedExtra.design_req || '' },
    { label: '最大干密度', value: maxDryDisplay },
    { label: '检测结论',   value: sharedExtra.conclusion || '' },
    { label: '备    注',   value: sharedExtra.remark_footer || '' },
  ];

  // Step 2: 逐页生成 docx
  for (let pi = 0; pi < savedRecords.length; pi++) {
    const record = savedRecords[pi];
    update(pi + 2, totalSteps, `正在生成第 ${pi + 1}/${savedRecords.length} 页文档...`);
    await yield_();

    let headerData = {};
    try {
      headerData = typeof record.header_data === 'string'
        ? JSON.parse(record.header_data) : (record.header_data || {});
    } catch { headerData = {}; }

    const [rows] = query(
      'SELECT * FROM biz_original_record_item WHERE record_id = ? ORDER BY seq_no', [record.id]
    );
    const parsedRows = rows.map(r => ({
      ...r,
      test_values: typeof r.test_values === 'string'
        ? JSON.parse(r.test_values) : (r.test_values || {})
    }));

    const zip = new PizZip(fs.readFileSync(templatePath));
    let xml = zip.files['word/document.xml'].asText();
    // 全局修正西文字体为 Times New Roman
    xml = xml.replace(/w:ascii="宋体"/g, 'w:ascii="Times New Roman"');
    xml = xml.replace(/w:hAnsi="宋体"/g, 'w:hAnsi="Times New Roman"');

    xml = xml.replace(
      '委托编号：                      共   页第   页              记录单编号：',
      `委托编号：${entrustNo}              共 ${totalPages} 页第 ${record.page_no} 页              记录单编号：`
    );
    xml = xml.replace('JL/', `JL/${entrustNo}`);

    const pageCellMap = cellMap.map(c => {
      if (c.label === '工程名称') return { ...c, value: headerData.project_name || entrust.project_name || '' };
      if (c.label === '委托单位') return { ...c, value: headerData.client_unit || entrust.client_unit || '' };
      if (c.label === '见证单位') return { ...c, value: headerData.supervision_unit || entrust.supervision_unit || '' };
      return c;
    });
    for (const { label, value } of pageCellMap) {
      xml = fillCellAfter(xml, label, value);
    }

    let searchPos = 0;
    for (let ri = 0; ri < dataRowLabels.length; ri++) {
      const label = dataRowLabels[ri];
      const key = paramKeys[ri];
      const groupSize = (isPipe && (key === 'stake_no' || key === 'position')) ? 3 : 1;
      const groupCount = groupSize > 1 ? Math.ceil(9 / groupSize) : 9;
      const values = [];
      for (let col = 0; col < 9; col++) {
        const rd = parsedRows[col];
        if (!rd || rd._empty) { values.push(''); continue; }
        const tv = rd.test_values || {};
        if (key === 'sample') {
          values.push(String(rd.seq_no || col + 1));
        } else if (key === 'max_dry_density') {
          const mdd = getRowMaxDry(rd);
          values.push(mdd > 0 ? bankersRound(mdd, 2) : '');
        } else if (['pit_sand', 'pit_volume', 'wet_density', 'water_content', 'dry_density', 'compaction'].includes(key)) {
          values.push(calcField(key, tv, getRowMaxDry(rd)));
        } else {
          values.push(tv[key] !== undefined && tv[key] !== null ? String(tv[key]) : '');
        }
      }
      const fillValues = groupSize > 1
        ? (() => { const gv = []; for (let g = 0; g < groupCount; g++) gv.push(values[g * groupSize] || ''); return gv; })()
        : values;
      const result = fillDataRow(xml, label, fillValues, searchPos);
      xml = result.xml;
      searchPos = result.nextPos;
    }

    xml = replaceAfterLabel(xml, '试验人：', sharedExtra.tester || '');
    xml = replaceAfterLabel(xml, '复核人：', sharedExtra.reviewer || '');
    if (sharedExtra.test_date) {
      const parts = String(sharedExtra.test_date).split(/[-/]/);
      if (parts.length === 3) {
        xml = replaceAfterLabel(xml, '试验日期：', parts[0]);
        xml = replaceInRun(xml, '年', parts[1], true);
        xml = replaceInRun(xml, '月', parts[2], true);
      }
    }

    zip.file('word/document.xml', xml);
    const tmpDocx = os.tmpdir().replace(/\//g, '\\') + '\\' + `record_${entrustId}_p${record.page_no}.docx`;
    const tmpPdf = os.tmpdir().replace(/\//g, '\\') + '\\' + `record_${entrustId}_p${record.page_no}.pdf`;
    const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(tmpDocx, buf);
    convertPairs.push({ docx: tmpDocx, pdf: tmpPdf, pageNo: record.page_no });
  }

  // Step N+3: PDF 转换
  update(totalSteps - 1, totalSteps, `正在转换 PDF（共 ${convertPairs.length} 页）...`);
  await yield_();

  if (convertPairs.length > 0) {
    await batchDocxToPdf(convertPairs);
  }
  await yield_();

  // Step N+4: 合并 PDF
  update(totalSteps, totalSteps, '正在合并 PDF...');
  await yield_();

  const pdfBuffers = [];
  for (const pair of convertPairs) {
    try {
      if (fs.existsSync(pair.pdf)) pdfBuffers.push({ pageNo: pair.pageNo, buffer: fs.readFileSync(pair.pdf) });
    } catch {}
    try { fs.unlinkSync(pair.docx); } catch {}
    try { fs.unlinkSync(pair.pdf); } catch {}
  }

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
  const pdfPath = path.join(os.tmpdir(), `print_${entrustId}_${Date.now()}.pdf`);
  fs.writeFileSync(pdfPath, finalPdf);

  printJobs.set(taskId, {
    step: totalSteps, totalSteps, message: '生成完成，正在下载...',
    done: true, error: null, pdfPath
  });
}

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

  // 移除预置干扰文字及所有旧 run（清除模板占位内容）
  tcContent = tcContent.replace(/<w:r[\s>][\s\S]*?<\/w:r>/g, '');
  // 移除固定列宽，让单元格自适应内容
  tcContent = tcContent.replace(/<w:tcW[^>]*\/>/g, '');

  // 填入新值
  if (value && tcContent.includes('</w:pPr>')) {
    // 段落居中
    if (/<w:jc\b/.test(tcContent)) {
      tcContent = tcContent.replace(/<w:jc w:val="[^"]*"\/>/g, '<w:jc w:val="center"/>');
    } else {
      tcContent = tcContent.replace('</w:pPr>', '<w:jc w:val="center"/></w:pPr>');
    }
    const sz = fitFontSize(value);
    const newRun = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escXml(value)}</w:t></w:r>`;
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
    const tr1 = xml.lastIndexOf('<w:tr>', idx);
    const tr2 = xml.lastIndexOf('<w:tr ', idx);
    const rowStart = Math.max(tr1, tr2);
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
    if (col >= values.length) break;

    const val = values[col] || '';

    // 清除原有文本（如果有 g/cm³ 之类的）
    let newContent = tc.content
      .replace(/<w:r[\s>][\s\S]*?<w:t[^>]*>[^<]*g\/[^<]*cm[^<]*<\/w:t>[\s\S]*?<\/w:r>/g, '')
      .replace(/<w:r[\s>][\s\S]*?<w:t[^>]*>3<\/w:t>[\s\S]*?<\/w:r>/g, '');

    // 插入数据 run
    if (val && newContent.includes('</w:pPr>')) {
      const newRun = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t xml:space="preserve">${escXml(val)}</w:t></w:r>`;
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

// 格式化试验日期并填入 XML（支持单日期和日期范围）
function fillTestDate(xml, dateStr) {
  if (!dateStr) return xml;
  const str = String(dateStr);
  if (str.includes('~')) {
    const [d1, d2] = str.split('~');
    const p1 = d1.split('-'); const p2 = d2.split('-');
    if (p1.length === 3 && p2.length === 3) {
      const formatted = p1[0] === p2[0]
        ? `${p1[0]}年${p1[1]}月${p1[2]}日～${p2[1]}月${p2[2]}日`
        : `${p1[0]}年${p1[1]}月${p1[2]}日～${p2[0]}年${p2[1]}月${p2[2]}日`;
      xml = replaceAfterLabel(xml, '试验日期：', formatted);
      // 清除年/月/日占位符（填入空值）
      xml = replaceAfterLabel(xml, '年', '');
      xml = replaceAfterLabel(xml, '月', '');
      xml = replaceAfterLabel(xml, '日', '');
    }
  } else {
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      xml = replaceAfterLabel(xml, '试验日期：', parts[0]);
      xml = replaceInRun(xml, '年', parts[1], true);
      xml = replaceInRun(xml, '月', parts[2], true);
    }
  }
  return xml;
}
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

// 根据文本长度自适应字号（半磅值），避免表格溢出
function fitFontSize(text) {
  let w = 0;
  for (const ch of String(text)) {
    w += /[一-鿿　-〿＀-￯]/.test(ch) ? 2 : 1;
  }
  if (w <= 60) return '21';  // 10.5pt
  if (w <= 80) return '18';  // 9pt
  if (w <= 100) return '15'; // 7.5pt
  if (w <= 120) return '13'; // 6.5pt
  return '12';               // 6pt
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
    case 'pit_sand':      return pitSand > 0 ? bankersRound(pitSand, 0) : '';
    case 'pit_volume':    return pitVolume > 0 ? bankersRound(pitVolume, 0) : '';
    case 'wet_density':   return wetDensity > 0 ? bankersRound(wetDensity, 2) : '';
    case 'water_content': return waterContent > 0 ? bankersRound(waterContent, 1) : '';
    case 'dry_density':   return dryDensity > 0 ? bankersRound(dryDensity, 2) : '';
    case 'compaction':    return compaction > 0 ? bankersRound(compaction, 1) : '';
    default: return '';
  }
}
