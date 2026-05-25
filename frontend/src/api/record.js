import request from './index'

export function getRecords(entrustId) {
  return request.get(`/records/${entrustId}`)
}

export function updateRecordRows(entrustId, rows) {
  return request.put(`/records/${entrustId}/rows`, { rows })
}
