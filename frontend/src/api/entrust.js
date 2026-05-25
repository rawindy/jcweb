import request from './index'

export function getEntrustList(params) {
  return request.get('/entrusts', { params })
}

export function createEntrust(data) {
  return request.post('/entrusts', data)
}

export function getEntrustDetail(id) {
  return request.get(`/entrusts/${id}`)
}

export function updateEntrust(id, data) {
  return request.put(`/entrusts/${id}`, data)
}

export function deleteEntrust(id) {
  return request.delete(`/entrusts/${id}`)
}
