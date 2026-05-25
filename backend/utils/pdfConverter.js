// 跨平台 docx → PDF 转换器
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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
    return libreofficeConvert(docxPath, pdfPath);
  } else {
    return wordComConvert(docxPath, pdfPath);
  }
}

function libreofficeConvert(docxPath, pdfPath) {
  return new Promise((resolve, reject) => {
    const outDir = path.dirname(pdfPath);
    const cmd = `libreoffice --headless --convert-to pdf --outdir "${outDir}" "${docxPath}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error('LibreOffice转换失败: ' + (stderr || err.message)));

      // LibreOffice 输出的 pdf 名与输入同名，需重命名
      const baseName = path.basename(docxPath, '.docx');
      const generatedPdf = path.join(outDir, baseName + '.pdf');
      if (generatedPdf !== pdfPath && fs.existsSync(generatedPdf)) {
        fs.renameSync(generatedPdf, pdfPath);
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
    for (const { docx, pdf } of pairs) {
      await libreofficeConvert(docx, pdf);
    }
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
