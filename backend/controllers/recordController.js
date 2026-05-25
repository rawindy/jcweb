const path = require('path');
const fs = require('fs');
const { query, getDb } = require('../config/db');
const { generateSampleNos } = require('../utils/codeGenerator');

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

    const [savedRecords] = query(
      'SELECT * FROM biz_original_record WHERE entrust_id = ? ORDER BY page_no', [entrustId]
    );

    const totalPages = savedRecords.length > 0
      ? Math.max(...savedRecords.map(r => r.total_pages || 1))
      : 1;

    let extra = {};
    if (savedRecords.length > 0 && savedRecords[0].remark) {
      try {
        extra = typeof savedRecords[0].remark === 'string'
          ? JSON.parse(savedRecords[0].remark) : savedRecords[0].remark;
      } catch { extra = {}; }
    }

    const templatePath = path.join(__dirname, '..', '..', 'temp', '压实度（道路）（灌砂法）检测原始记录单.pdf');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ code: 404, message: 'PDF模板文件不存在' });
    }

    const { PDFDocument, rgb } = require('pdf-lib');
    const fontkit = require('@pdf-lib/fontkit');

    // 单独加载模板
    const templateDoc = await PDFDocument.load(fs.readFileSync(templatePath));

    // 创建新文档，从模板复制需要的页数
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const copies = await pdfDoc.copyPages(templateDoc, new Array(totalPages).fill(0));
    copies.forEach(cp => pdfDoc.addPage(cp));

    const fontDir = path.join(process.env.SystemRoot || 'C:\\Windows', 'Fonts');

    // 宋体
    let cnFont;
    for (const name of ['STSONG.TTF', 'simsunb.ttf', 'simhei.ttf']) {
      const fp = path.join(fontDir, name);
      if (fs.existsSync(fp)) { cnFont = await pdfDoc.embedFont(fs.readFileSync(fp)); break; }
    }

    // Times New Roman
    let enFont;
    const timesPath = path.join(fontDir, 'times.ttf');
    if (fs.existsSync(timesPath)) {
      enFont = await pdfDoc.embedFont(fs.readFileSync(timesPath));
    }

    const FONT_SIZE = 10.5; // 五号

    function pickFont(text) {
      if (!text) return cnFont || enFont;
      return /[一-鿿]/.test(String(text)) ? (cnFont || enFont) : (enFont || cnFont);
    }

    // 左对齐 + 垂直居中（抬头用）
    function leftText(page, text, x, cellTop, cellH, fs) {
      if (!text) return;
      const str = String(text);
      const f = pickFont(str);
      if (!f) return;
      const sz = fs || FONT_SIZE;
      const th = sz * 0.8;
      const y = cellTop + (cellH - th) / 2;
      page.drawText(str, { x, y, size: sz, font: f, color: rgb(0, 0, 0) });
    }

    // 水平+垂直居中（共X页/第X页/表格用）
    function centerText(page, text, cx, cellTop, cw, cellH, fs) {
      if (!text || !cw) return;
      const str = String(text);
      const f = pickFont(str);
      if (!f) return;
      const sz = fs || FONT_SIZE;
      const tw = f.widthOfTextAtSize(str, sz);
      const th = sz * 0.8;
      const x = Math.max(cx, cx + (cw - tw) / 2);
      const y = cellTop + (cellH - th) / 2;
      page.drawText(str, { x, y, size: sz, font: f, color: rgb(0, 0, 0) });
    }

    const pages = pdfDoc.getPages();

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pn = i + 1;

      // 行1 — 标签基线 y:733
      // 委托编号：左对齐，cellTop:726, cellH:14
      leftText(page, entrust.entrust_no, 123, 726, 14);
      // 共X页：居中
      centerText(page, String(totalPages), 249, 726, 14, 14);
      // 第X页：居中
      centerText(page, String(pn), 286, 726, 14, 14);
      // 记录单编号（原PDF已有JL/，只填编号）
      leftText(page, entrust.entrust_no, 462, 726, 14, 9);

      // 行2 — 标签基线 y:710
      // 工程名称：左对齐，cellTop:702, cellH:16
      leftText(page, entrust.project_name || '', 81, 702, 16);
      // 委托单位：左对齐
      leftText(page, entrust.client_unit || '', 367, 702, 16);

      // 行3 — 标签基线 y:682
      // 见证单位：左对齐，cellTop:674, cellH:16
      leftText(page, entrust.supervision_unit || '', 81, 674, 16);
      // 结构层次：左对齐
      leftText(page, extra.structure_layer || '', 367, 674, 16);

      // 行4 — 标签基线 y:659
      // 设计要求：左对齐，cellTop:651, cellH:16
      leftText(page, extra.design_req || '', 81, 651, 16);
      // 最大干密度：左对齐
      const mdd = extra.max_dry_density ? extra.max_dry_density + ' g/cm³' : '';
      leftText(page, mdd, 372, 651, 16);
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${entrust.entrust_no}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ code: 500, message: 'PDF生成失败: ' + err.message });
  }
};
