<template>
  <el-container class="layout">
    <el-aside :width="isCollapse ? '64px' : '220px'" class="aside">
      <div class="logo">
        <el-icon :size="22"><Document /></el-icon>
        <span v-show="!isCollapse" class="logo-text">检测业务系统</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        :collapse="isCollapse"
        background-color="transparent"
        text-color="var(--sidebar-text)"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/project">
          <el-icon><FolderOpened /></el-icon>
          <template #title>工程项目登记</template>
        </el-menu-item>
        <el-menu-item index="/entrust">
          <el-icon><EditPen /></el-icon>
          <template #title>委托录入</template>
        </el-menu-item>
        <el-menu-item index="/record">
          <el-icon><Tickets /></el-icon>
          <template #title>原始记录录入</template>
        </el-menu-item>
        <el-menu-item index="/print">
          <el-icon><DocumentChecked /></el-icon>
          <template #title>报告打印</template>
        </el-menu-item>
        <el-menu-item index="/instruments">
          <el-icon><Box /></el-icon>
          <template #title>仪器库</template>
        </el-menu-item>
      </el-menu>
      <div class="collapse-btn" @click="isCollapse = !isCollapse">
        <el-icon :size="16">
          <DArrowLeft v-if="!isCollapse" />
          <DArrowRight v-else />
        </el-icon>
      </div>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="breadcrumbTitle">{{ breadcrumbTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <span class="header-time">{{ currentTime }}</span>
          <el-divider direction="vertical" />
          <el-icon><User /></el-icon>
          <span class="user-name">{{ userStore.userInfo.real_name || '管理员' }}</span>
          <el-button text type="danger" @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="slide-up" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../../store/user'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isCollapse = ref(false)
const currentTime = ref('')
let timer = null

onMounted(() => {
  currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
  timer = setInterval(() => {
    currentTime.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const activeMenu = computed(() => {
  const p = route.path
  if (p.startsWith('/project')) return '/project'
  if (p.startsWith('/entrust')) return '/entrust'
  if (p.startsWith('/record')) return '/record'
  if (p.startsWith('/print')) return '/print'
  if (p.startsWith('/instruments')) return '/instruments'
  return p
})

const breadcrumbTitle = computed(() => {
  const meta = route.meta
  return meta?.title || ''
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
  background: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
  overflow: hidden;
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
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  padding: 0 16px;
}

.logo-text {
  white-space: nowrap;
  overflow: hidden;
}

/* 侧边栏菜单 */
:deep(.el-menu) {
  border-right: none;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 0;
}

:deep(.el-menu-item) {
  margin: 2px 8px;
  border-radius: 8px;
  height: 44px;
  line-height: 44px;
  color: var(--sidebar-text);
  transition: all 0.2s;
}

:deep(.el-menu-item:hover) {
  background: var(--sidebar-hover) !important;
  color: #e0e5eb;
}

:deep(.el-menu-item.is-active) {
  background: var(--sidebar-active) !important;
  color: #ffffff !important;
}

/* 折叠按钮 */
.collapse-btn {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sidebar-text);
  cursor: pointer;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  transition: color 0.2s;
}

.collapse-btn:hover {
  color: #ffffff;
  background: var(--sidebar-hover);
}

/* 顶栏 */
.header {
  background: #fff;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-regular);
  font-size: 13px;
}

.header-time {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.user-name {
  color: var(--color-text-primary);
  font-weight: 500;
}

/* 主内容区 */
.main {
  background: var(--color-bg);
  min-height: 0;
  padding: var(--spacing-lg);
  overflow-y: auto;
}
</style>
