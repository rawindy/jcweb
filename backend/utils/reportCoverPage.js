// 报告封面填充 — 共享工具
// 所有报告类型共用同一个封面格式，标签+值在同一段落中

function escXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 替换封面段落中标签后面的值为新内容
 * 保留原有字体设置：w:sz=30 (15pt)、加粗、Times New Roman / 宋体
 */
function replaceCoverValue(xml, label, value) {
  const escLabel = escapeRegex(label);
  const regex = new RegExp(
    `(<w:t[^>]*>)${escLabel}(</w:t>)\\s*</w:r>`,
    's'
  );
  const match = regex.exec(xml);
  if (!match) return xml;

  const afterLabelRun = match.index + match[0].length;
  const paraEnd = xml.indexOf('</w:p>', afterLabelRun);
  if (paraEnd === -1) return xml;

  // 找到段落起始位置及 pPr
  const paraStart = xml.lastIndexOf('<w:p', match.index);
  const pPrStart = xml.indexOf('<w:pPr', paraStart);
  const pPrEnd = xml.indexOf('</w:pPr>', pPrStart) + '</w:pPr>'.length;
  let pPr = xml.substring(pPrStart, pPrEnd);

  // 模板自身悬挂缩进 5 字符已经正确，不再修改 pPr

  const escVal = escXml(value);
  // 直接在标签后追加值文本，标签→值之间无 tab，依靠模板 w:left/w:hanging 控制换行对齐
  const valueRun = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="30"/><w:szCs w:val="30"/><w:b/></w:rPr><w:t xml:space="preserve">${escVal}</w:t></w:r>`;

  return xml.substring(0, pPrStart) + pPr +
         xml.substring(pPrEnd, afterLabelRun) + valueRun +
         xml.substring(paraEnd);
}

/**
 * 填充报告封面页的所有字段
 * @param {string} xml - word/document.xml 内容
 * @param {object} data - { report_no, project_name, client_unit, test_item, report_date }
 * @returns {string} 修改后的 XML
 */
function fillCoverPage(xml, data) {
  const fields = [
    { label: '报告编号：', value: data.report_no || '' },
    { label: '工程名称：', value: data.project_name || '' },
    { label: '委托单位：', value: data.client_unit || '' },
    { label: '检测项目：', value: data.test_item || '' },
    { label: '报告日期：', value: data.report_date || '' },
  ];

  for (const { label, value } of fields) {
    xml = replaceCoverValue(xml, label, value);
  }
  return xml;
}

module.exports = { fillCoverPage, escXml };
