// 跨平台 docx → PDF 转换器
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

// 项目本地 LibreOffice 路径
const LOCAL_SOFFICE = path.join(__dirname, '..', '..', 'tools', 'LibreOffice', 'program', 'soffice.exe');

/**
 * 将 docx 文件转为 PDF
 * @param {string} docxPath - 输入的 docx 路径
 * @param {string} pdfPath - 输出的 pdf 路径
 * @param {string} [converter] - 'word' | 'libreoffice' | 'auto'
 */
async function docxToPdf(docxPath, pdfPath, converter = 'auto') {
  if (converter === 'auto') {
    converter = process.env.PDF_CONVERTER || (process.platform === 'win32' ? 'word' : 'libreoffice');
  }

  if (converter === 'libreoffice') {
    return libreofficeConvert(docxPath, pdfPath, `single_${Date.now()}`);
  } else {
    return wordComConvert(docxPath, pdfPath);
  }
}

function libreofficeConvert(docxPath, pdfPath, profileId) {
  return new Promise((resolve, reject) => {
    const outDir = path.dirname(pdfPath);
    const soffice = fs.existsSync(LOCAL_SOFFICE) ? LOCAL_SOFFICE : 'soffice';
    // 独立用户配置目录，避免并行实例冲突
    const profileDir = path.join(os.tmpdir(), `lo_profile_${profileId}`);
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
    const cmd = `"${soffice}" -env:UserInstallation="file:///${profileDir.replace(/\\/g, '/')}" --headless --convert-to pdf --outdir "${outDir}" "${docxPath}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error('LibreOffice转换失败: ' + (stderr || err.message)));

      // LibreOffice 输出的 pdf 名与输入同名，需重命名
      const baseName = path.basename(docxPath, '.docx');
      const generatedPdf = path.join(outDir, baseName + '.pdf');
      if (generatedPdf !== pdfPath && fs.existsSync(generatedPdf)) {
        fs.renameSync(generatedPdf, pdfPath);
      }
      // 清理临时配置目录
      try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
      resolve();
    });
  });
}

function libreofficeBatchConvert(pairs) {
  return new Promise((resolve, reject) => {
    const soffice = fs.existsSync(LOCAL_SOFFICE) ? LOCAL_SOFFICE : 'soffice';
    const profileDir = path.join(os.tmpdir(), `lo_profile_batch_${Date.now()}`);

    // 统一的输出目录（所有 PDF 生成在同一目录，方便批量操作）
    const outDir = path.dirname(pairs[0].docx);
    const fileArgs = pairs.map(p => `"${p.docx}"`).join(' ');
    const cmd = `"${soffice}" -env:UserInstallation="file:///${profileDir.replace(/\\/g, '/')}" --headless --convert-to pdf --outdir "${outDir}" ${fileArgs}`;

    exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      // LibreOffice 输出 PDF 名与 docx 同名，需逐个确认/重命名
      for (const { docx, pdf } of pairs) {
        const baseName = path.basename(docx, '.docx');
        const generatedPdf = path.join(outDir, baseName + '.pdf');
        if (generatedPdf !== pdf && fs.existsSync(generatedPdf)) {
          try { fs.renameSync(generatedPdf, pdf); } catch {}
        }
      }

      // 清理
      try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}

      if (err) {
        const missing = pairs.filter(p => !fs.existsSync(p.pdf));
        if (missing.length === pairs.length) {
          return reject(new Error('LibreOffice批量转换失败: ' + (stderr || err.message)));
        }
      }
      resolve();
    });
  });
}

function wordComConvert(docxPath, pdfPath) {
  return new Promise((resolve, reject) => {
    // 使用 -Command 内联执行（避免 PS1 文件编码问题）
    // Word COM 要求反斜杠路径
    const winDocx = docxPath.replace(/\//g, '\\').replace(/'/g, "''");
    const winPdf = pdfPath.replace(/\//g, '\\').replace(/'/g, "''");

    // Base64 编码脚本以避免命令行转义和编码问题
    const script = `$w=New-Object -ComObject Word.Application;$w.Visible=$false;$d=$w.Documents.Open('${winDocx}');$d.SaveAs([ref]'${winPdf}',[ref]17);$d.Close();$w.Quit()`;
    const b64 = Buffer.from(script, 'utf16le').toString('base64');

    exec(`powershell -EncodedCommand ${b64}`, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err && !fs.existsSync(pdfPath)) {
        return reject(new Error('Word转换失败: ' + (stderr || err.message)));
      }
      let retries = 10;
      function check() {
        if (fs.existsSync(pdfPath)) return resolve();
        if (retries-- <= 0) return reject(new Error('PDF 文件未生成'));
        setTimeout(check, 500);
      }
      check();
    });
  });
}

/**
 * 批量将 docx 文件转为 PDF（一次打开 Word，处理全部文件）
 * @param {Array<{docx: string, pdf: string}>} pairs
 * @param {string} [converter]
 */
async function batchDocxToPdf(pairs, converter = 'auto') {
  if (pairs.length === 0) return;
  if (converter === 'auto') {
    converter = process.env.PDF_CONVERTER || (process.platform === 'win32' ? 'word' : 'libreoffice');
  }

  if (converter === 'libreoffice') {
    // 单次调用批量转换：所有 docx 放入同一目录，一次 LibreOffice 启动全部转换
    await libreofficeBatchConvert(pairs);
  } else {
    await wordComBatchConvert(pairs);
  }
}

function wordComBatchConvert(pairs) {
  return new Promise((resolve, reject) => {
    // 构建批量操作脚本：打开一次 Word，逐个处理所有文件
    const lines = ['$w=New-Object -ComObject Word.Application', '$w.Visible=$false'];
    for (const { docx, pdf } of pairs) {
      const winDocx = docx.replace(/\//g, '\\').replace(/'/g, "''");
      const winPdf = pdf.replace(/\//g, '\\').replace(/'/g, "''");
      lines.push(`$d=$w.Documents.Open('${winDocx}')`);
      lines.push(`$d.SaveAs([ref]'${winPdf}',[ref]17)`);
      lines.push('$d.Close()');
    }
    lines.push('$w.Quit()');

    const script = lines.join(';');
    const b64 = Buffer.from(script, 'utf16le').toString('base64');

    exec(`powershell -EncodedCommand ${b64}`, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        // 检查哪些 PDF 已生成
        const missing = pairs.filter(p => !fs.existsSync(p.pdf));
        if (missing.length === pairs.length) {
          return reject(new Error('Word转换失败: ' + (stderr || err.message)));
        }
      }
      resolve();
    });
  });
}

module.exports = { docxToPdf, batchDocxToPdf };
