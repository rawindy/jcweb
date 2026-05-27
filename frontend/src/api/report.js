import request from './index'

// 获取报告所需全部数据
export function getReportData(entrustId) {
  return request.get(`/reports/${entrustId}/data`)
}

// 启动报告生成
export function startReportPrint(entrustId, headerData) {
  return request.post(`/reports/${entrustId}/print/start`, headerData)
}

// 查询进度
export function getReportPrintStatus(entrustId, taskId) {
  return request.get(`/reports/${entrustId}/print/status/${taskId}`)
}

// 保存报告抬头数据
export function saveReportData(entrustId, data) {
  return request.post(`/reports/${entrustId}/save`, data)
}

// 下载 PDF
export function downloadReportPrint(entrustId, taskId) {
  return request.get(`/reports/${entrustId}/print/download/${taskId}`, { responseType: 'blob' })
}
