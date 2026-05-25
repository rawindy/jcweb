import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/login/Login.vue'),
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: () => import('../views/layout/Index.vue'),
    redirect: '/project',
    children: [
      {
        path: 'project',
        name: 'ProjectList',
        component: () => import('../views/project/List.vue'),
        meta: { title: '工程项目登记' }
      },
      {
        path: 'entrust',
        name: 'EntrustList',
        component: () => import('../views/entrust/List.vue'),
        meta: { title: '委托录入' }
      },
      {
        path: 'entrust/create',
        name: 'EntrustCreate',
        component: () => import('../views/entrust/Create.vue'),
        meta: { title: '新建委托' }
      },
      {
        path: 'entrust/:id',
        name: 'EntrustDetail',
        component: () => import('../views/entrust/Detail.vue'),
        meta: { title: '委托详情' }
      },
      {
        path: 'record',
        name: 'RecordInput',
        component: () => import('../views/record/List.vue'),
        meta: { title: '原始记录录入' }
      },
      {
        path: 'record/:entrustId',
        name: 'RecordEdit',
        component: () => import('../views/record/Input.vue'),
        meta: { title: '录入原始记录' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else {
    next()
  }
})

export default router
