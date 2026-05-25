import request from './index'

export function getProjectList(params) {
  return request.get('/projects', { params })
}

export function createProject(data) {
  return request.post('/projects', data)
}

export function updateProject(id, data) {
  return request.put(`/projects/${id}`, data)
}

export function deleteProject(id) {
  return request.delete(`/projects/${id}`)
}

export function getProjectByNo(projectNo) {
  return request.get(`/projects/${projectNo}`)
}

export function searchProjects(keyword) {
  return request.get('/projects/search', { params: { keyword } })
}
