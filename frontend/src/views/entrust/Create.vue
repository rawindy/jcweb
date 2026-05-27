<template>
  <div class="page-container">
    <div class="page-header">
      <h3>新建委托</h3>
      <el-button @click="$router.back()">返回列表</el-button>
    </div>

    <!-- 步骤 1: 选择委托类型 -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="card-header">
          <span class="step-badge">1</span>
          <strong>选择委托项目</strong>
        </div>
      </template>
      <div class="type-options">
        <div
          v-for="t in entrustTypes"
          :key="t.code"
          class="type-item"
          :class="{ active: selectedType === t.code }"
          @click="selectType(t.code)"
        >
          <div class="type-icon" :class="t.colorClass">
            <el-icon :size="32"><component :is="t.icon" /></el-icon>
          </div>
          <div class="type-info">
            <span class="type-label">{{ t.label }}</span>
            <span class="type-desc">{{ t.desc }}</span>
          </div>
          <div v-if="selectedType === t.code" class="type-check">
            <el-icon :size="20"><CircleCheck /></el-icon>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 步骤 2: 关联工程 -->
    <el-card shadow="never" class="section-card" v-if="selectedType">
      <template #header>
        <div class="card-header">
          <span class="step-badge">2</span>
          <strong>关联工程</strong>
        </div>
      </template>
      <el-form :inline="true">
        <el-form-item label="工程编号">
          <el-input v-model="projectSearch" placeholder="输入工程编号" style="width:160px"
            @change="searchProject">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="工程名称">
          <el-select
            v-model="selectedProjectId"
            filterable
            remote
            reserve-keyword
            :remote-method="searchProjectByName"
            :loading="projectLoading"
            placeholder="输入工程名称搜索"
            style="width:320px"
            @change="onProjectSelect"
            clearable
          >
            <el-option
              v-for="p in projectOptions"
              :key="p.id"
              :label="`${p.project_no} - ${p.project_name}`"
              :value="p.id"
            />
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
    </el-card>

    <!-- 压实度委托表单 -->
    <template v-if="selectedType === 'SYS'">
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-header">
            <span class="step-badge">3</span>
            <strong>压实度类型</strong>
          </div>
        </template>
        <el-radio-group v-model="compactionType" size="large">
          <el-radio-button value="管道压实度">管道压实度</el-radio-button>
          <el-radio-button value="路基压实度">路基压实度</el-radio-button>
        </el-radio-group>
      </el-card>

      <!-- 管道压实度 -->
      <el-card shadow="never" class="section-card" v-if="compactionType === '管道压实度'">
        <template #header>
          <div class="card-header">
            <strong>管道压实度 — 检测部位</strong>
            <el-button type="primary" size="small" @click="addPosition">
              <el-icon style="margin-right:4px"><Plus /></el-icon>添加部位
            </el-button>
          </div>
        </template>
        <el-table :data="pipeItems" border>
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
              <el-button link type="danger" @click="removePipeItem($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 路基压实度 -->
      <el-card shadow="never" class="section-card" v-if="compactionType === '路基压实度'">
        <template #header>
          <div class="card-header">
            <strong>路基压实度 — 检测部位</strong>
            <el-button type="primary" size="small" @click="addRoadPosition">
              <el-icon style="margin-right:4px"><Plus /></el-icon>添加部位
            </el-button>
          </div>
        </template>
        <el-table :data="roadItems" border>
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
                <el-option label="砂" value="砂" />
                <el-option label="土" value="土" />
                <el-option label="塘渣" value="塘渣" />
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
              <el-button link type="danger" @click="removeRoadItem($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <!-- 击实委托表单 -->
    <template v-if="selectedType === 'STJ'">
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-header">
            <span class="step-badge">3</span>
            <strong>击实检测详情</strong>
          </div>
        </template>
        <el-form label-width="100px">
          <el-form-item label="材料">
            <el-select v-model="proctorItem.material" placeholder="选择材料" style="width:240px"
              filterable allow-create>
              <el-option label="土" value="土" />
              <el-option label="砂" value="砂" />
              <el-option label="石屑" value="石屑" />
              <el-option label="碎石" value="碎石" />
              <el-option label="塘渣" value="塘渣" />
            </el-select>
          </el-form-item>
          <el-form-item label="击实方式">
            <el-radio-group v-model="proctorItem.test_method">
              <el-radio value="轻型">轻型</el-radio>
              <el-radio value="重型">重型</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </el-card>
    </template>

    <!-- 弯沉委托表单 -->
    <template v-if="selectedType === 'SWC'">
      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-header">
            <span class="step-badge">3</span>
            <strong>弯沉检测部位</strong>
            <el-button type="primary" size="small" @click="addDeflectionItem">
              <el-icon style="margin-right:4px"><Plus /></el-icon>添加部位
            </el-button>
          </div>
        </template>
        <el-table :data="deflectionItems" border>
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
      </el-card>
    </template>

    <!-- 委托日期 & 提交 -->
    <el-card shadow="never" class="section-card" v-if="selectedType">
      <el-form :inline="true" label-width="80px">
        <el-form-item label="委托日期">
          <el-date-picker v-model="entrustDate" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="remark" placeholder="备注" style="width:300px" />
        </el-form-item>
      </el-form>
      <div style="margin-top:16px;display:flex;gap:12px">
        <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit">
          <el-icon style="margin-right:4px"><Check /></el-icon>
          提交委托
        </el-button>
        <el-button size="large" @click="$router.back()">取消</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createEntrust } from '../../api/entrust'
import { searchProjects, getProjectByNo } from '../../api/project'
import dayjs from 'dayjs'

const router = useRouter()
const submitting = ref(false)

const entrustTypes = [
  { code: 'SYS', label: '压实度', desc: '灌砂法检测压实度', icon: 'Histogram', colorClass: 'blue' },
  { code: 'STJ', label: '击实', desc: '击实试验检测', icon: 'Box', colorClass: 'orange' },
  { code: 'SWC', label: '弯沉', desc: '弯沉值检测', icon: 'TrendCharts', colorClass: 'green' }
]

const materialOptions = ['砂', '石屑', '碎石']

// 类型选择
const selectedType = ref('')
const compactionType = ref('管道压实度')

// 工程关联
const projectSearch = ref('')
const selectedProjectId = ref(null)
const selectedProject = ref(null)
const projectOptions = ref([])
const projectLoading = ref(false)

// 管道压实度
const pipeItems = reactive([
  { position_name: '管底', group_count: 1, material: '砂', design_requirement: 90, design_operator: '≥', design_tolerance: null, sort: 1 },
  { position_name: '胸腔', group_count: 2, material: '砂', design_requirement: 90, design_operator: '≥', design_tolerance: null, sort: 2 },
  { position_name: '管顶', group_count: 1, material: '砂', design_requirement: 90, design_operator: '≥', design_tolerance: null, sort: 3 }
])

// 路基压实度
const roadItems = reactive([
  { position_name: '车道', group_count: 1, material: '砂', design_requirement: 90, design_operator: '≥', design_tolerance: null, sort: 1 }
])

// 击实
const proctorItem = reactive({ material: '土', test_method: '轻型' })

// 弯沉
const deflectionItems = reactive([
  { position_name: '车道', design_requirement: null, _custom: false }
])

const entrustDate = ref(dayjs().format('YYYY-MM-DD'))
const remark = ref('')

function selectType(code) { selectedType.value = code }

async function searchProject() {
  if (!projectSearch.value) return
  const res = await getProjectByNo(projectSearch.value)
  if (res.data) {
    selectedProject.value = res.data
    selectedProjectId.value = res.data.id
  }
}

async function searchProjectByName(query) {
  if (!query || query.length < 1) {
    projectOptions.value = []
    return
  }
  projectLoading.value = true
  try {
    const res = await searchProjects(query)
    projectOptions.value = res.data || []
  } finally {
    projectLoading.value = false
  }
}

function onProjectSelect(id) {
  const p = projectOptions.value.find(item => item.id === id)
  if (p) selectedProject.value = p
}

function addPosition() {
  pipeItems.push({ position_name: '', group_count: 1, material: '砂', design_requirement: 90, design_operator: '≥', design_tolerance: null, sort: pipeItems.length + 1 })
}

function removePipeItem(idx) {
  pipeItems.splice(idx, 1)
}

function addRoadPosition() {
  roadItems.push({ position_name: '', group_count: 1, material: '砂', design_requirement: 90, design_operator: '≥', design_tolerance: null, sort: roadItems.length + 1 })
}

function removeRoadItem(idx) {
  roadItems.splice(idx, 1)
}

function addDeflectionItem() {
  deflectionItems.push({ position_name: '', design_requirement: null, _custom: true })
}

function removeDeflectionItem(idx) {
  if (deflectionItems.length <= 1) return
  deflectionItems.splice(idx, 1)
}

async function handleSubmit() {
  if (!selectedType.value) {
    ElMessage.warning('请选择委托项目')
    return
  }

  let items = []
  let entrustType = ''

  if (selectedType.value === 'SYS') {
    entrustType = compactionType.value
    const src = compactionType.value === '管道压实度' ? pipeItems : roadItems
    items = src.map((it, i) => ({
      position_name: it.position_name,
      group_count: it.group_count,
      material: it.material,
      design_requirement: it.design_requirement,
      design_operator: it.design_operator || '≥',
      design_tolerance: it.design_operator === '±' ? it.design_tolerance : null,
      sort: i + 1
    }))
  } else if (selectedType.value === 'STJ') {
    entrustType = '击实'
    items = [{ material: proctorItem.material, test_method: proctorItem.test_method }]
  } else if (selectedType.value === 'SWC') {
    entrustType = '弯沉'
    items = deflectionItems.map(it => ({
      position_name: it.position_name,
      design_requirement: it.design_requirement
    }))
  }

  submitting.value = true
  try {
    const res = await createEntrust({
      category_code: selectedType.value,
      entrust_type: entrustType,
      project_id: selectedProjectId.value || null,
      entrust_date: entrustDate.value,
      items,
      remark: remark.value
    })
    ElMessage.success(`委托录入成功！委托编号：${res.data.entrust_no}`)
    router.push('/entrust')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.section-card { margin-bottom: var(--spacing-md); }

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.step-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.type-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 24px;
  border: 2px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s;
  position: relative;
}

.type-item:hover {
  border-color: var(--color-primary-light);
  box-shadow: 0 4px 16px rgba(26, 95, 180, 0.1);
  transform: translateY(-2px);
}

.type-item.active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  box-shadow: 0 4px 20px rgba(26, 95, 180, 0.15);
}

.type-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.type-icon.blue { background: #ecf2fb; color: var(--color-primary); }
.type-icon.orange { background: #fef3e1; color: var(--color-warning); }
.type-icon.green { background: #e8f5ee; color: var(--color-success); }

.type-info {
  text-align: center;
}

.type-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.type-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.type-check {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--color-primary);
}

.project-info { margin-top: 12px; }
</style>
