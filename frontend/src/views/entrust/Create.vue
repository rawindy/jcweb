<template>
  <div class="page">
    <div class="page-header">
      <h3>新建委托</h3>
    </div>

    <!-- 步骤 1: 选择委托类型 -->
    <el-card shadow="never" class="type-card">
      <template #header><strong>选择委托项目</strong></template>
      <div class="type-options">
        <div
          v-for="t in entrustTypes"
          :key="t.code"
          class="type-item"
          :class="{ active: selectedType === t.code }"
          @click="selectType(t.code)"
        >
          <el-icon :size="28"><component :is="t.icon" /></el-icon>
          <span>{{ t.label }}</span>
          <span class="type-code">{{ t.code }}</span>
        </div>
      </div>
    </el-card>

    <!-- 步骤 2: 关联工程 -->
    <el-card shadow="never" class="section-card" v-if="selectedType">
      <template #header><strong>关联工程</strong></template>
      <el-form :inline="true">
        <el-form-item label="工程编号">
          <el-input v-model="projectSearch" placeholder="输入工程编号" style="width:160px"
            @change="searchProject" />
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
        <template #header><strong>压实度类型</strong></template>
        <el-radio-group v-model="compactionType">
          <el-radio-button value="管道压实度">管道压实度</el-radio-button>
          <el-radio-button value="路基压实度">路基压实度</el-radio-button>
        </el-radio-group>
      </el-card>

      <!-- 管道压实度 -->
      <el-card shadow="never" class="section-card" v-if="compactionType === '管道压实度'">
        <template #header>
          <strong>管道压实度检测部位</strong>
          <el-button type="primary" size="small" style="margin-left:12px" @click="addPosition">添加部位</el-button>
        </template>
        <el-table :data="pipeItems" border>
          <el-table-column prop="position_name" label="检测部位" width="180">
            <template #default="{ row, $index }">
              <el-input v-if="row._custom" v-model="row.position_name" placeholder="输入部位名称" size="small" />
              <span v-else>{{ row.position_name }}</span>
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
                <el-option
                  v-for="m in materialOptions"
                  :key="m"
                  :label="m"
                  :value="m"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="设计要求(%)" width="140">
            <template #default="{ row }">
              <el-input-number v-model="row.design_requirement" :min="0" :max="100" :precision="1" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ $index }">
              <el-button link type="danger" @click="removePipeItem($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 路基压实度 -->
      <el-card shadow="never" class="section-card" v-if="compactionType === '路基压实度'">
        <template #header>
          <strong>路基压实度检测部位</strong>
          <el-button type="primary" size="small" style="margin-left:12px" @click="addRoadPosition">添加部位</el-button>
        </template>
        <el-table :data="roadItems" border>
          <el-table-column prop="position_name" label="检测部位" width="180">
            <template #default="{ row, $index }">
              <el-input v-if="row._customPos" v-model="row.position_name" placeholder="输入部位名称" size="small" />
              <span v-else>{{ row.position_name }}</span>
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
          <el-table-column label="设计要求(%)" width="140">
            <template #default="{ row }">
              <el-input-number v-model="row.design_requirement" :min="0" :max="100" :precision="1" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
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
        <template #header><strong>击实检测详情</strong></template>
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
          <strong>弯沉检测部位</strong>
          <el-button type="primary" size="small" style="margin-left:12px" @click="addDeflectionItem">添加部位</el-button>
        </template>
        <el-table :data="deflectionItems" border>
          <el-table-column label="检测部位" width="220">
            <template #default="{ row, $index }">
              <el-input v-if="row._custom" v-model="row.position_name" placeholder="输入部位名称" size="small" />
              <span v-else>{{ row.position_name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="设计要求(mm)" width="180">
            <template #default="{ row }">
              <el-input-number v-model="row.design_requirement" :min="0" :precision="1" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
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
      <div style="margin-top:12px">
        <el-button type="primary" size="large" :loading="submitting" @click="handleSubmit">
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
  { code: 'SYS', label: '压实度', icon: 'Histogram' },
  { code: 'STJ', label: '击实', icon: 'Box' },
  { code: 'SWC', label: '弯沉', icon: 'TrendCharts' }
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
  { position_name: '管底', group_count: 1, material: '砂', design_requirement: 90, sort: 1 },
  { position_name: '胸腔', group_count: 2, material: '砂', design_requirement: 90, sort: 2 },
  { position_name: '管顶', group_count: 1, material: '砂', design_requirement: 90, sort: 3 }
])

// 路基压实度
const roadItems = reactive([
  { position_name: '车道', group_count: 1, material: '砂', design_requirement: 90, sort: 1, _customPos: false }
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
  pipeItems.push({ position_name: '', group_count: 1, material: '砂', design_requirement: 90, sort: pipeItems.length + 1, _custom: true })
}

function removePipeItem(idx) {
  if (pipeItems.length <= 3) return
  pipeItems.splice(idx, 1)
}

function addRoadPosition() {
  roadItems.push({ position_name: '', group_count: 1, material: '砂', design_requirement: 90, sort: roadItems.length + 1, _customPos: true })
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
.page { padding: 0; }
.page-header { margin-bottom: 16px; }
.page-header h3 { margin: 0; }
.type-card { margin-bottom: 16px; }
.type-options { display: flex; gap: 24px; }
.type-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 32px;
  border: 2px solid #dcdfe6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.type-item:hover { border-color: #409eff; }
.type-item.active { border-color: #409eff; background: #ecf5ff; }
.type-code { font-size: 12px; color: #909399; }
.section-card { margin-bottom: 16px; }
.project-info { margin-top: 12px; }
</style>
