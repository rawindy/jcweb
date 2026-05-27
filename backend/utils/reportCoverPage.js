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
  // 匹配标签所在的 w:t 及其所在 w:r 的结束标签
  const regex = new RegExp(
    `(<w:t[^>]*>)${escLabel}(</w:t>)\\s*</w:r>`,
    's'
  );
  const match = regex.exec(xml);
  if (!match) return xml;

  const afterLabelRun = match.index + match[0].length;
  // 找到所在段落的结束位置
  const paraEnd = xml.indexOf('</w:p>', afterLabelRun);
  if (paraEnd === -1) return xml;

  const escVal = escXml(value);
  const newRun = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="30"/><w:szCs w:val="30"/><w:b/></w:rPr><w:t xml:space="preserve">${escVal}</w:t></w:r>`;

  return xml.substring(0, afterLabelRun) + newRun + xml.substring(paraEnd);
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
