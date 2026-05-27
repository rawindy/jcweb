import request from './index'

export function getInstruments(category) {
  return request.get('/instruments', { params: { category } })
}

export function getInstrument(id) {
  return request.get(`/instruments/${id}`)
}

export function createInstrument(data) {
  return request.post('/instruments', data)
}

export function updateInstrument(id, data) {
  return request.put(`/instruments/${id}`, data)
}

export function deleteInstrument(id) {
  return request.delete(`/instruments/${id}`)
}

export function lookupInstrument(category, code) {
  return request.get(`/instruments/lookup/${encodeURIComponent(category)}/${encodeURIComponent(code)}`)
}
