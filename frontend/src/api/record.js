import request from './index'

export function getRecords(entrustNo) {
  return request.get(`/records/${entrustNo}`)
}

export function updateRecordRows(entrustNo, rows) {
  return request.put(`/records/${entrustNo}/rows`, { rows })
}

export function startPrint(entrustNo) {
  return request.post(`/records/${entrustNo}/print/start`)
}

export function getPrintStatus(entrustNo, taskId) {
  return request.get(`/records/${entrustNo}/print/status/${taskId}`)
}

export function downloadPrintPdf(entrustNo, taskId) {
  return request.get(`/records/${entrustNo}/print/download/${taskId}`, { responseType: 'blob' })
}

export function startPrintBlank(entrustNo) {
  return request.post(`/records/${entrustNo}/print/blank/start`)
}

export function getPrintBlankStatus(entrustNo, taskId) {
  return request.get(`/records/${entrustNo}/print/blank/status/${taskId}`)
}

export function downloadPrintBlankPdf(entrustNo, taskId) {
  return request.get(`/records/${entrustNo}/print/blank/download/${taskId}`, { responseType: 'blob' })
}
