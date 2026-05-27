import request from './index'

export function getRecords(entrustId) {
  return request.get(`/records/${entrustId}`)
}

export function updateRecordRows(entrustId, rows) {
  return request.put(`/records/${entrustId}/rows`, { rows })
}

export function startPrint(entrustId) {
  return request.post(`/records/${entrustId}/print/start`)
}

export function getPrintStatus(entrustId, taskId) {
  return request.get(`/records/${entrustId}/print/status/${taskId}`)
}

export function downloadPrintPdf(entrustId, taskId) {
  return request.get(`/records/${entrustId}/print/download/${taskId}`, { responseType: 'blob' })
}

export function startPrintBlank(entrustId) {
  return request.post(`/records/${entrustId}/print/blank/start`)
}

export function getPrintBlankStatus(entrustId, taskId) {
  return request.get(`/records/${entrustId}/print/blank/status/${taskId}`)
}

export function downloadPrintBlankPdf(entrustId, taskId) {
  return request.get(`/records/${entrustId}/print/blank/download/${taskId}`, { responseType: 'blob' })
}
