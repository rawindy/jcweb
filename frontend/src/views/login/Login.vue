<template>
  <div class="login-container">
    <div class="login-bg-shapes">
      <div class="shape shape-1" />
      <div class="shape shape-2" />
      <div class="shape shape-3" />
    </div>
    <div class="login-card">
      <div class="login-brand">
        <el-icon :size="40"><Document /></el-icon>
      </div>
      <h2 class="login-title">市政工程检测业务系统</h2>
      <p class="login-subtitle">建筑材料检测流程管理平台</p>
      <el-form ref="formRef" :model="form" :rules="rules" size="large">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            :prefix-icon="User"
            clearable
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            style="width:100%;height:44px;font-size:15px;font-weight:500"
            :loading="loading"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../store/user'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref()
const form = ref({ username: 'admin', password: '123456' })
const loading = ref(false)

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await userStore.loginAction(form.value)
    router.push('/')
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a2a3a 0%, #1a5fb4 50%, #3584e4 100%);
  position: relative;
  overflow: hidden;
}

.login-bg-shapes {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.shape {
  position: absolute;
  border-radius: 50%;
  opacity: 0.06;
  background: #fff;
}

.shape-1 {
  width: 500px;
  height: 500px;
  top: -150px;
  right: -100px;
}

.shape-2 {
  width: 300px;
  height: 300px;
  bottom: -80px;
  left: -80px;
}

.shape-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  left: 30%;
}

.login-card {
  width: 420px;
  padding: 44px 40px 36px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  position: relative;
  z-index: 1;
}

.login-brand {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.login-title {
  text-align: center;
  margin-bottom: 4px;
  color: var(--color-text-primary);
  font-size: 22px;
  font-weight: 700;
}

.login-subtitle {
  text-align: center;
  margin-bottom: 32px;
  color: var(--color-text-secondary);
  font-size: 13px;
}
</style>
