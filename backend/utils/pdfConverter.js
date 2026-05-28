// docx to PDF converter (LibreOffice headless)
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

function getSofficeCmd() {
  // 优先使用项目本地 LibreOffice Portable
  const local = path.join(__dirname, '..', '..', 'tools', 'LibreOfficePortable', 'App', 'libreoffice', 'program', 'soffice.exe');
  if (fs.existsSync(local)) return { path: local, isSystem: false };
  // 回退到系统安装的 LibreOffice
  const sysPaths = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'LibreOffice', 'program', 'soffice.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'LibreOffice', 'program', 'soffice.exe')
  ];
  for (const p of sysPaths) { if (fs.existsSync(p)) return { path: p, isSystem: true }; }
  try { execSync('where soffice 2>nul', { stdio: 'pipe' }); return { path: 'soffice', isSystem: true }; } catch {}
  throw new Error('LibreOffice 未找到，请将 LibreOffice Portable 放到 tools/LibreOfficePortable/ 目录');
}

function runSoffice(inputFiles, outDir, timeout) {
  return new Promise(function(resolve) {
    var soffice = getSofficeCmd();
    var args = ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", outDir];
    args.push.apply(args, inputFiles);
    var proc = spawn(soffice.path, args, {
      cwd: path.dirname(soffice.path)
    });
    var timer = setTimeout(function() {
      proc.kill();
      resolve({ code: 1, stderr: 'Timeout after ' + timeout + 'ms' });
    }, timeout);
    var stderr = '';
    proc.stderr.on('data', function(data) { stderr += data; });
    proc.on('close', function(code) {
      clearTimeout(timer);
      resolve({ code: code, stderr: stderr });
    });
    proc.on('error', function(err) {
      clearTimeout(timer);
      resolve({ code: 1, stderr: err.message });
    });
  });
}

async function docxToPdf(docxPath, pdfPath) {
  var outDir = path.dirname(pdfPath);
  var result = await runSoffice([docxPath], outDir, 30000);
  var baseName = path.basename(docxPath, ".docx");
  var generatedPdf = path.join(outDir, baseName + ".pdf");
  if (generatedPdf !== pdfPath && fs.existsSync(generatedPdf)) fs.renameSync(generatedPdf, pdfPath);
  if (!fs.existsSync(pdfPath)) console.error("LO exit=" + result.code + " stderr=" + JSON.stringify(result.stderr));
  if (fs.existsSync(pdfPath)) return;
  throw new Error("LibreOffice convert failed: " + (result.stderr || "PDF not generated"));
}

async function batchDocxToPdf(pairs) {
  if (pairs.length === 0) return;
  var outDir = path.dirname(pairs[0].docx);
  var result = await runSoffice(pairs.map(function(p) { return p.docx; }), outDir, 120000);
  for (var i = 0; i < pairs.length; i++) {
    var docx = pairs[i].docx, pdf = pairs[i].pdf;
    var baseName = path.basename(docx, ".docx");
    var generatedPdf = path.join(outDir, baseName + ".pdf");
    if (generatedPdf !== pdf && fs.existsSync(generatedPdf)) {
      try { fs.renameSync(generatedPdf, pdf); } catch(e) {}
    }
  }
  var missing = pairs.filter(function(p) { return !fs.existsSync(p.pdf); });
  if (missing.length === pairs.length) {
    throw new Error("LibreOffice batch convert failed: " + (result.stderr || "PDF not generated"));
  }
}

module.exports = { docxToPdf, batchDocxToPdf };
