import { defineStore } from 'pinia'
import { login, getUserInfo } from '../api/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: {}
  }),
  actions: {
    async loginAction(credentials) {
      const res = await login(credentials)
      this.token = res.data.token
      this.userInfo = res.data.user
      localStorage.setItem('token', res.data.token)
      return res
    },
    async fetchUserInfo() {
      const res = await getUserInfo()
      this.userInfo = res.data
    },
    logout() {
      this.token = ''
      this.userInfo = {}
      localStorage.removeItem('token')
    }
  }
})
