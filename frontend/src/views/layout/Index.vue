<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">
        <el-icon :size="22"><Document /></el-icon>
        <span>检测业务系统</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        background-color="#1a3a5c"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item index="/project">
          <el-icon><FolderOpened /></el-icon>
          <span>工程项目登记</span>
        </el-menu-item>
        <el-menu-item index="/entrust">
          <el-icon><EditPen /></el-icon>
          <span>委托录入</span>
        </el-menu-item>
        <el-menu-item index="/record">
          <el-icon><Tickets /></el-icon>
          <span>原始记录录入</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left" />
        <div class="header-right">
          <span class="user-name">{{ userStore.userInfo.real_name }}</span>
          <el-button text @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../../store/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = computed(() => {
  const p = route.path
  if (p.startsWith('/project')) return '/project'
  if (p.startsWith('/entrust')) return '/entrust'
  if (p.startsWith('/record')) return '/record'
  return p
})

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout {
  height: 100vh;
}
.aside {
  background-color: #1a3a5c;
  overflow-y: auto;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-name {
  color: #606266;
}
.main {
  background: #f0f2f5;
  min-height: 0;
}
</style>
