<template>
  <div class="page-container" v-loading="loading">
    <div class="page-header">
      <h3>
        委托详情 - {{ entrust.entrust_no }}
        <el-tag v-if="entrust.category_code === 'SYS'" type="primary" effect="dark">压实度</el-tag>
        <el-tag v-else-if="entrust.category_code === 'STJ'" type="warning" effect="dark">击实</el-tag>
        <el-tag v-else-if="entrust.category_code === 'SWC'" type="success" effect="dark">弯沉</el-tag>
        <span style="font-size:14px;color:var(--color-text-secondary);margin-left:8px">{{ entrust.entrust_type }}</span>
      </h3>
      <div style="display:flex;gap:8px">
        <el-button v-if="!editing" type="primary" @click="startEdit">编辑</el-button>
        <el-button v-if="editing" type="primary" :loading="saving" @click="handleSave">保存</el-button>
        <el-button v-if="editing" @click="cancelEdit">取消</el-button>
        <el-button v-if="!editing" @click="$router.back()">返回列表</el-button>
      </div>
    </div>

    <!-- 工程信息 -->
    <el-card shadow="never">
      <template #header><strong>工程信息</strong></template>
      <template v-if="editing">
        <el-form :inline="true">
          <el-form-item label="工程编号">
            <el-input v-model="projectSearch" placeholder="输入工程编号" style="width:160px" @change="searchProject">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item label="工程名称">
            <el-select v-model="editForm.project_id" filterable remote reserve-keyword
              :remote-method="searchProjectByName" :loading="projectLoading"
              placeholder="输入工程名称搜索" style="width:320px" clearable
              @change="onProjectSelect">
              <el-option v-for="p in projectOptions" :key="p.id"
                :label="`${p.project_no} - ${p.project_name}`" :value="p.id" />
            </el-select>
          </el-form-item>
        </el-form>
        <div v-if="selectedProject" class="project-info">
          <el-descriptions :column="4" size="small" border>
            <el-descriptions-item label="工程编号">{{ selectedProject.project_no }}</el-descriptions-item>
            <el-descriptions-item label="工程名称">{{ selectedProject.project_name }}</el-descriptions-item>
            <el-descriptions-item label="委托单位">{{ selectedProject.client_unit }}</el-descriptions-item>
            <el-descriptions-item label="委托人">{{ selectedProject.client_person }}</el-descriptions-item>
            <el-descriptions-item label="监理单位">{{ selectedProject.supervision_unit }}</el-descriptions-item>
            <el-descriptions-item label="见证人">{{ selectedProject.witness_person }}</el-descriptions-item>
            <el-descriptions-item label="施工单位">{{ selectedProject.construction_unit }}</el-descriptions-item>
            <el-descriptions-item label="建设单位">{{ selectedProject.build_unit }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </template>
      <template v-else>
        <el-descriptions :column="4" size="small" border v-if="entrust.project_name">
          <el-descriptions-item label="工程编号">{{ entrust.project_no }}</el-descriptions-item>
          <el-descriptions-item label="工程名称">{{ entrust.project_name }}</el-descriptions-item>
          <el-descriptions-item label="委托单位">{{ entrust.client_unit }}</el-descriptions-item>
          <el-descriptions-item label="委托人">{{ entrust.client_person }}</el-descriptions-item>
          <el-descriptions-item label="监理单位">{{ entrust.supervision_unit }}</el-descriptions-item>
          <el-descriptions-item label="见证人">{{ entrust.witness_person }}</el-descriptions-item>
          <el-descriptions-item label="施工单位">{{ entrust.construction_unit }}</el-descriptions-item>
          <el-descriptions-item label="建设单位">{{ entrust.build_unit }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-else description="未关联工程" :image-size="80" />
      </template>
    </el-card>

    <!-- 检测明细 -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div style="display:flex;align-items:center;gap:12px">
          <strong>检测明细</strong>
          <el-tag v-if="entrust.category_code === 'SYS' && totalGroups" type="info" effect="plain">
            总组数：{{ totalGroups }}
          </el-tag>
          <el-button v-if="editing && entrust.category_code === 'SYS' && entrust.entrust_type !== '击实'"
            type="primary" size="small" @click="addItem">添加部位</el-button>
          <el-button v-if="editing && entrust.category_code === 'SWC'"
            type="primary" size="small" @click="addDeflectionItem">添加部位</el-button>
        </div>
      </template>

      <!-- 压实度（编辑模式） -->
      <template v-if="entrust.category_code === 'SYS' && editing">
        <el-table :data="editItems" border>
          <el-table-column label="检测部位" width="180">
            <template #default="{ row }">
              <el-input v-model="row.position_name" placeholder="输入部位名称" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="检测数量(组)" width="140">
            <template #default="{ row }">
              <el-input-number v-model="row.group_count" :min="1" :max="99" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="材料" width="200">
            <template #default="{ row }">
              <el-select v-model="row.material" placeholder="选择材料" size="small" style="width:160px"
                filterable allow-create>
                <el-option v-for="m in materialOptions" :key="m" :label="m" :value="m" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="设计要求" width="260">
            <template #default="{ row }">
              <div style="display:flex;align-items:center;gap:4px">
                <el-select v-model="row.design_operator" size="small" style="width:60px">
                  <el-option label="≥" value="≥" /><el-option label="≤" value="≤" />
                  <el-option label="=" value="=" /><el-option label="±" value="±" />
                </el-select>
                <el-input-number v-model="row.design_requirement" :min="0" :max="100" :precision="1" size="small" style="width:80px" />
                <template v-if="row.design_operator === '±'">
                  <span style="font-size:12px;color:#999">±</span>
                  <el-input-number v-model="row.design_tolerance" :min="0" :max="50" :precision="1" size="small" style="width:70px" />
                  <span style="font-size:12px;color:#999">%</span>
                </template>
                <span v-else style="font-size:12px;color:#999">%</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ $index }">
              <el-button link type="danger" @click="removeItem($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- 击实（编辑模式） -->
      <template v-if="entrust.category_code === 'STJ' && editing">
        <el-form label-width="100px">
          <el-form-item label="材料">
            <el-select v-model="editItems[0].material" placeholder="选择材料" style="width:240px"
              filterable allow-create>
              <el-option label="土" value="土" /><el-option label="砂" value="砂" />
              <el-option label="石屑" value="石屑" /><el-option label="碎石" value="碎石" />
              <el-option label="塘渣" value="塘渣" />
            </el-select>
          </el-form-item>
          <el-form-item label="击实方式">
            <el-radio-group v-model="editItems[0].test_method">
              <el-radio value="轻型">轻型</el-radio>
              <el-radio value="重型">重型</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </template>

      <!-- 弯沉（编辑模式） -->
      <template v-if="entrust.category_code === 'SWC' && editing">
        <el-table :data="editItems" border>
          <el-table-column label="检测部位" width="220">
            <template #default="{ row }">
              <el-input v-if="row._custom" v-model="row.position_name" placeholder="输入部位名称" size="small" />
              <span v-else>{{ row.position_name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="设计要求(mm)" width="180">
            <template #default="{ row }">
              <el-input-number v-model="row.design_requirement" :min="0" :precision="1" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80">
            <template #default="{ $index }">
              <el-button link type="danger" @click="removeDeflectionItem($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- 查看模式保持原样 -->
      <template v-if="!editing">
        <template v-if="entrust.category_code === 'SYS'">
          <el-table :data="entrust.items" border stripe>
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="position_name" label="检测部位" width="180" />
            <el-table-column prop="group_count" label="检测数量(组)" width="120" align="center" />
            <el-table-column prop="material" label="材料" width="120" />
            <el-table-column label="设计要求" width="140" align="center">
              <template #default="{ row }">
                {{ formatDesign(row) }}
              </template>
            </el-table-column>
          </el-table>
        </template>
        <template v-if="entrust.category_code === 'STJ'">
          <el-descriptions :column="2" border v-if="entrust.items.length">
            <el-descriptions-item label="材料">{{ entrust.items[0]?.material }}</el-descriptions-item>
            <el-descriptions-item label="击实方式">
              <el-tag :type="entrust.items[0]?.test_method === '重型' ? 'danger' : ''">
                {{ entrust.items[0]?.test_method }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </template>
        <template v-if="entrust.category_code === 'SWC'">
          <el-table :data="entrust.items" border stripe>
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="position_name" label="检测部位" />
            <el-table-column prop="design_requirement" label="设计要求(mm)" align="center" />
          </el-table>
        </template>
      </template>
    </el-card>

    <!-- 其他信息 -->
    <el-card shadow="never" class="section-card">
      <template #header><strong>其他信息</strong></template>
      <template v-if="editing">
        <el-form label-width="80px">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="委托编号">
                <el-input v-model="editForm.entrust_no" placeholder="委托编号" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="委托日期">
                <el-date-picker v-model="editForm.entrust_date" type="date"
                  value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="备注">
                <el-input v-model="editForm.remark" placeholder="备注" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </template>
      <template v-else>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="委托编号">{{ entrust.entrust_no }}</el-descriptions-item>
          <el-descriptions-item label="委托日期">{{ entrust.entrust_date }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ entrust.create_time }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ entrust.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getEntrustDetail, updateEntrust } from '../../api/entrust'
import { searchProjects, getProjectByNo } from '../../api/project'

const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const editing = ref(false)
const entrust = reactive({})

// 编辑表单
const editForm = reactive({ entrust_no: '', project_id: null, entrust_date: '', remark: '' })
const editItems = reactive([])

// 工程搜索
const projectSearch = ref('')
const selectedProject = ref(null)
const projectOptions = ref([])
const projectLoading = ref(false)

const materialOptions = ['砂', '石屑', '碎石']

const totalGroups = computed(() => {
  const items = editing.value ? editItems : (entrust.items || [])
  return items.reduce((sum, it) => sum + (it.group_count || 0), 0)
})

function formatDesign(row) {
  const op = row.design_operator || '≥'
  const val = row.design_requirement != null ? row.design_requirement : ''
  if (op === '±' && row.design_tolerance != null) {
    return `${val}%±${row.design_tolerance}%`
  }
  return `${op}${val}%`
}

onMounted(async () => {
  loading.value = true
  try {
    const res = await getEntrustDetail(route.params.id)
    Object.assign(entrust, res.data)
  } finally {
    loading.value = false
  }
})

function startEdit() {
  editForm.entrust_no = entrust.entrust_no
  editForm.project_id = entrust.project_id
  editForm.entrust_date = entrust.entrust_date
  editForm.remark = entrust.remark || ''

  editItems.length = 0
  if (entrust.items) {
    for (const item of entrust.items) {
      editItems.push({ ...item })
    }
  }

  if (entrust.project_name) {
    selectedProject.value = {
      project_no: entrust.project_no, project_name: entrust.project_name,
      client_unit: entrust.client_unit, client_person: entrust.client_person,
      supervision_unit: entrust.supervision_unit, witness_person: entrust.witness_person,
      construction_unit: entrust.construction_unit, build_unit: entrust.build_unit
    }
  }

  editing.value = true
}

function cancelEdit() {
  editing.value = false
  selectedProject.value = null
}

async function handleSave() {
  saving.value = true
  try {
    const items = editItems.map((it, i) => {
      const { _custom, design_operator, design_tolerance, ...rest } = it
      return {
        ...rest,
        design_operator: design_operator || '≥',
        design_tolerance: design_operator === '±' ? design_tolerance : null,
        sort: i + 1
      }
    })
    await updateEntrust(entrust.id, {
      entrust_no: editForm.entrust_no,
      project_id: editForm.project_id || null,
      entrust_date: editForm.entrust_date,
      remark: editForm.remark,
      items
    })
    ElMessage.success('保存成功')
    editing.value = false
    // 刷新数据
    const res = await getEntrustDetail(route.params.id)
    Object.assign(entrust, res.data)
  } finally {
    saving.value = false
  }
}

// 工程搜索
async function searchProject() {
  if (!projectSearch.value) return
  try {
    const res = await getProjectByNo(projectSearch.value)
    if (res.data) {
      selectedProject.value = res.data
      editForm.project_id = res.data.id
    }
  } catch { /* 未找到 */ }
}

async function searchProjectByName(query) {
  if (!query || query.length < 1) { projectOptions.value = []; return }
  projectLoading.value = true
  try {
    const res = await searchProjects(query)
    projectOptions.value = res.data || []
  } finally { projectLoading.value = false }
}

function onProjectSelect(id) {
  const p = projectOptions.value.find(item => item.id === id)
  if (p) selectedProject.value = p
}

function addItem() {
  editItems.push({
    position_name: '', group_count: 1, material: '砂',
    design_requirement: 90, design_operator: '≥', design_tolerance: null,
    sort: editItems.length + 1
  })
}

function removeItem(idx) { editItems.splice(idx, 1) }

function addDeflectionItem() {
  editItems.push({ position_name: '', design_requirement: null, _custom: true })
}

function removeDeflectionItem(idx) {
  if (editItems.length <= 1) return
  editItems.splice(idx, 1)
}
</script>

<style scoped>
.section-card { margin-top: var(--spacing-md); }
.project-info { margin-top: 12px; }
</style>
