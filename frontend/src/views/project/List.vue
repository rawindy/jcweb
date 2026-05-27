<template>
  <div class="page-container">
    <div class="page-header">
      <h3>工程项目登记</h3>
      <el-button type="primary" @click="openDialog()">
        <el-icon style="margin-right:4px"><Plus /></el-icon>
        新增工程项目
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-icon blue"><el-icon :size="22"><FolderOpened /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ pagination.total }}</div>
          <div class="stat-label">工程项目总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><el-icon :size="22"><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ tableData.length }}</div>
          <div class="stat-label">当前页项目</div>
        </div>
      </div>
    </div>

    <!-- 搜索区 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="搜索字段">
          <el-select v-model="searchForm.field" placeholder="全部字段" clearable style="width:150px">
            <el-option label="工程编号" value="project_no" />
            <el-option label="工程名称" value="project_name" />
            <el-option label="委托单位" value="client_unit" />
            <el-option label="委托人" value="client_person" />
            <el-option label="监理单位" value="supervision_unit" />
            <el-option label="见证人" value="witness_person" />
            <el-option label="施工单位" value="construction_unit" />
            <el-option label="建设单位" value="build_unit" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="输入关键词搜索" clearable style="width:240px"
            @keyup.enter="handleSearch">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon style="margin-right:4px"><Search /></el-icon>搜索
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe style="width:100%"
        :header-cell-style="{ background: '#f8f9fb', color: '#1e1e1e', fontWeight: 600 }"
        @sort-change="handleSortChange">
        <el-table-column prop="project_no" label="工程编号" width="110" sortable="custom" />
        <el-table-column prop="project_name" label="工程名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="client_unit" label="委托单位" min-width="160" show-overflow-tooltip />
        <el-table-column prop="client_person" label="委托人" width="100" />
        <el-table-column prop="supervision_unit" label="监理单位" min-width="160" show-overflow-tooltip />
        <el-table-column prop="witness_person" label="见证人" width="100" />
        <el-table-column prop="construction_unit" label="施工单位" min-width="160" show-overflow-tooltip />
        <el-table-column prop="build_unit" label="建设单位" min-width="160" show-overflow-tooltip />
        <el-table-column prop="create_time" label="创建时间" width="160" sortable="custom" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchData"
          @current-change="fetchData"
        />
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑工程项目' : '新增工程项目'"
      width="680px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="工程编号" v-if="isEdit">
          <el-input v-model="form.project_no" placeholder="请输入工程编号" />
        </el-form-item>
        <el-form-item label="工程名称" prop="project_name">
          <el-input v-model="form.project_name" placeholder="请输入工程名称" />
        </el-form-item>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="委托单位" prop="client_unit">
              <el-input v-model="form.client_unit" placeholder="委托单位" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="委托人" prop="client_person">
              <el-input v-model="form.client_person" placeholder="委托人" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="监理单位" prop="supervision_unit">
              <el-input v-model="form.supervision_unit" placeholder="监理单位" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="见证人" prop="witness_person">
              <el-input v-model="form.witness_person" placeholder="见证人" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="施工单位" prop="construction_unit">
              <el-input v-model="form.construction_unit" placeholder="施工单位" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="建设单位" prop="build_unit">
              <el-input v-model="form.build_unit" placeholder="建设单位" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getProjectList, createProject, updateProject, deleteProject } from '../../api/project'

const loading = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref()

const searchForm = reactive({ field: '', keyword: '' })
const form = reactive({
  id: null,
  project_no: '',
  project_name: '',
  client_unit: '',
  client_person: '',
  supervision_unit: '',
  witness_person: '',
  construction_unit: '',
  build_unit: '',
  remark: ''
})

const tableData = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const sortParams = reactive({ field: '', order: '' })

const rules = {
  project_name: [{ required: true, message: '请输入工程名称', trigger: 'blur' }]
}

onMounted(() => fetchData())

async function fetchData() {
  loading.value = true
  try {
    const params = { page: pagination.page, pageSize: pagination.pageSize }
    if (searchForm.keyword) {
      params.field = searchForm.field
      params.keyword = searchForm.keyword
    }
    const res = await getProjectList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchData()
}

function resetSearch() {
  searchForm.field = ''
  searchForm.keyword = ''
  pagination.page = 1
  fetchData()
}

function handleSortChange({ prop, order }) {
  sortParams.field = prop
  sortParams.order = order
}

function openDialog(row) {
  if (row) {
    isEdit.value = true
    Object.assign(form, {
      id: row.id,
      project_no: row.project_no,
      project_name: row.project_name,
      client_unit: row.client_unit,
      client_person: row.client_person,
      supervision_unit: row.supervision_unit,
      witness_person: row.witness_person,
      construction_unit: row.construction_unit,
      build_unit: row.build_unit,
      remark: row.remark
    })
  } else {
    isEdit.value = false
    Object.assign(form, {
      id: null, project_no: '', project_name: '', client_unit: '', client_person: '',
      supervision_unit: '', witness_person: '', construction_unit: '', build_unit: '', remark: ''
    })
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (isEdit.value) {
      await updateProject(form.id, { ...form })
      ElMessage.success('更新成功')
    } else {
      const res = await createProject({ ...form })
      ElMessage.success(`创建成功，工程编号：${res.data.project_no}`)
    }
    dialogVisible.value = false
    fetchData()
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确定删除工程「${row.project_name}」吗？`, '确认删除', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
  await deleteProject(row.id)
  ElMessage.success('删除成功')
  fetchData()
}
</script>
