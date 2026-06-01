<template>
  <div class="page-container">
    <div class="page-header">
      <h3>报告打印</h3>
    </div>

    <!-- 委托选择 -->
    <el-card shadow="never" class="search-card">
      <el-form :inline="true">
        <el-form-item label="检测类别">
          <el-select v-model="filterCategory" placeholder="全部类别" clearable style="width:150px" @change="handleFilter">
            <el-option label="压实度" value="SYS" />
            <el-option label="击实" value="STJ" />
            <el-option label="弯沉" value="SWC" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <span style="color:#909399;font-size:13px">
            共 {{ pagination.total }} 条记录，点击行选择委托单
          </span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe @row-click="handleSelect" highlight-current-row
        :row-class-name="tableRowClass">
        <el-table-column prop="entrust_no" label="委托编号" width="170" />
        <el-table-column label="类别" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.category_code === 'SYS'" type="primary" effect="dark">压实度</el-tag>
            <el-tag v-else-if="row.category_code === 'STJ'" type="warning" effect="dark">击实</el-tag>
            <el-tag v-else-if="row.category_code === 'SWC'" type="success" effect="dark">弯沉</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="entrust_type" label="委托类型" width="130" />
        <el-table-column prop="project_name" label="工程名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="entrust_date" label="委托日期" width="120" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="handleSelect(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]" :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchData" @current-change="fetchData"
        />
      </div>
    </el-card>

    <!-- 非管道压实度提示 -->
    <template v-if="selected && !isPipe">
      <el-card shadow="never" class="form-card">
        <el-empty description="当前仅支持管道压实度报告，其他类别暂未开放" />
      </el-card>
    </template>

    <!-- ===== 三段式报告表单（仅管道压实度） ===== -->
    <template v-if="selected && isPipe">
      <!-- 第一段：封面页 -->
      <el-card shadow="never" class="report-card cover-card">
        <div class="card-title-bar">封面 — 检测报告封面页</div>

        <div class="cover-sheet">
          <div class="cover-title">检 测 报 告</div>

          <div class="cover-fields">
            <div class="cover-field">
              <span class="cover-label">报告编号：</span>
              <span class="cover-value">{{ form.report_no || '—' }}</span>
            </div>
            <div class="cover-field">
              <span class="cover-label">工程名称：</span>
              <el-input v-model="form.project_name" class="cover-input" />
            </div>
            <div class="cover-field">
              <span class="cover-label">委托单位：</span>
              <el-input v-model="form.client_unit" class="cover-input" />
            </div>
            <div class="cover-field">
              <span class="cover-label">检测项目：</span>
              <span class="cover-value">{{ form.test_item || '—' }}</span>
            </div>
            <div class="cover-field">
              <span class="cover-label">报告日期：</span>
              <el-date-picker v-model="form.report_date" type="date" value-format="YYYY-MM-DD"
                placeholder="选择报告日期" class="cover-input" />
            </div>
          </div>

          <div class="cover-footer">
            <div class="cover-company">余姚市姚州建设工程检测有限公司</div>
            <div class="cover-address">地址：浙江省余姚市胜山路28号&emsp;邮政编码:315400&emsp;电话：0574-62824724</div>
          </div>
        </div>
      </el-card>

      <!-- 第二段：信息页 -->
      <el-card shadow="never" class="report-card info-card">
        <div class="card-title-bar">
          信息页 — 检测报告信息页
          <span class="page-badge">报告编号：{{ form.report_no }}&emsp;共 {{ totalReportPages }} 页 第 1 页</span>
        </div>

        <!-- 信息表格（模仿模板 4 列布局） -->
        <div class="info-table">
          <!-- Row 1: 工程名称 | 检测类别 -->
          <div class="info-row">
            <div class="info-label">工程名称</div>
            <div class="info-value"><el-input v-model="form.project_name" /></div>
            <div class="info-label">检测类别</div>
            <div class="info-value"><el-input v-model="form.entrust_type" /></div>
          </div>
          <!-- Row 2: 委托单位 | 建设单位 -->
          <div class="info-row">
            <div class="info-label">委托单位</div>
            <div class="info-value"><el-input v-model="form.client_unit" /></div>
            <div class="info-label">建设单位</div>
            <div class="info-value"><el-input v-model="form.build_unit" /></div>
          </div>
          <!-- Row 3: 施工单位 | 见证单位 -->
          <div class="info-row">
            <div class="info-label">施工单位</div>
            <div class="info-value"><el-input v-model="form.construction_unit" /></div>
            <div class="info-label">见证单位</div>
            <div class="info-value"><el-input v-model="form.supervision_unit" /></div>
          </div>
          <!-- Row 4: 检测项目 | 见证人 -->
          <div class="info-row">
            <div class="info-label">检测项目</div>
            <div class="info-value"><span class="static-text">{{ form.test_item }}</span></div>
            <div class="info-label">见证人</div>
            <div class="info-value"><el-input v-model="form.witness_person" /></div>
          </div>
          <!-- Row 5: 样本数量 | 取样日期 -->
          <div class="info-row">
            <div class="info-label">样本数量</div>
            <div class="info-value"><span class="static-text">{{ form.total_samples }}点</span></div>
            <div class="info-label">取样日期</div>
            <div class="info-value">
              <el-date-picker v-model="samplingDateRange" type="daterange" range-separator="~"
                start-placeholder="开始" end-placeholder="结束" value-format="YYYY-MM-DD" style="width:100%" />
            </div>
          </div>
          <!-- Row 6: 检测日期 | 报告日期 -->
          <div class="info-row">
            <div class="info-label">检测日期</div>
            <div class="info-value"><el-input v-model="form.test_date" placeholder="如 2026-03-23—2026-03-27" /></div>
            <div class="info-label">报告日期</div>
            <div class="info-value">
              <el-date-picker v-model="form.report_date" type="date" value-format="YYYY-MM-DD"
                placeholder="选择日期" style="width:100%" />
            </div>
          </div>
          <!-- Row 7: 路段桩号 (跨列) -->
          <div class="info-row">
            <div class="info-label">路段桩号</div>
            <div class="info-value colspan-3"><el-input v-model="form.section_pile" /></div>
          </div>
          <!-- Row 8: 结构部位 (跨列) -->
          <div class="info-row">
            <div class="info-label">结构部位</div>
            <div class="info-value colspan-3"><el-input v-model="form.structure_part" /></div>
          </div>
          <!-- Row 9: 检测依据 (跨列) -->
          <div class="info-row">
            <div class="info-label">检测依据</div>
            <div class="info-value colspan-3">
              <el-checkbox-group v-model="form.test_basis">
                <el-checkbox label="JTG 3450-2019">《公路路基路面现场测试规程》（JTG 3450—2019）</el-checkbox>
                <el-checkbox label="GB/T 50123-2019">《土工试验方法标准》（GB/T 50123—2019）</el-checkbox>
                <el-checkbox label="CJJ 1-2008">《城镇道路工程施工与质量验收规范》（CJJ 1—2008）</el-checkbox>
                <el-checkbox label="GB 50268-2008">《给水排水管工程施工及验收规范》（GB 50268—2008）</el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
          <!-- Row 10: 检测设备 (跨列) -->
          <div class="info-row">
            <div class="info-label">检测设备</div>
            <div class="info-value colspan-3">
              <div class="equipment-line">
                <span>灌砂筒(</span>
                <el-select v-model="form.test_equipment.sand_cylinder" size="small" style="width:100px">
                  <el-option label="100mm" value="100mm" />
                  <el-option label="150mm" value="150mm" />
                  <el-option label="200mm" value="200mm" />
                </el-select>
                <span>)（SB143） 电子秤（SB133）电热鼓风干燥箱（</span>
                <el-checkbox-group v-model="form.test_equipment.drying_oven" size="small" class="inline-checks">
                  <el-checkbox label="SB55" />
                  <el-checkbox label="SB56" />
                  <el-checkbox label="SB128" />
                  <el-checkbox label="SB227" />
                </el-checkbox-group>
                <span>）电子秤（SB139）</span>
              </div>
            </div>
          </div>
          <!-- Row 11: 检测结论 (跨列) -->
          <div class="info-row">
            <div class="info-label">检测结论</div>
            <div class="info-value colspan-3">
              <el-input v-model="form.conclusion" type="textarea" :rows="2" />
            </div>
          </div>
          <!-- Row 12: 检测说明 (跨列，固定文字) -->
          <div class="info-row notice-row">
            <div class="info-label notice-label">检测说明</div>
            <div class="info-value colspan-3 notice-content">
              <p>本报告无检测单位盖章无效；</p>
              <p>本报告涂改无效；</p>
              <p>本报告无批准人、审核、检测人签字无效；</p>
              <p>本报告未经检测单位批准不得复制；</p>
              <p>如对检测结果有异议，请在收到检测报告之日起15天内向本单位书面提出。</p>
            </div>
          </div>
          <!-- Row 13: 备注 (跨列) -->
          <div class="info-row">
            <div class="info-label">备&emsp;注</div>
            <div class="info-value colspan-3">
              <span class="remark-prefix">最大干密度：</span>
              <el-input v-model="form.max_dry_density" placeholder="如 砂：1.75 g/cm³" />
            </div>
          </div>
        </div>

        <!-- 签字区 -->
        <div class="signature-area">
          <span>检测单位（盖章）：</span>
          <span class="sig-space">批准：</span>
          <span class="sig-space">审核：</span>
          <span class="sig-space">检测：</span>
        </div>
      </el-card>

      <!-- 第三段：数据预览 -->
      <el-card shadow="never" class="report-card data-card">
        <div class="card-title-bar">
          数据详情 — 检测报告管道详情数据页
          <span class="page-badge">报告编号：{{ form.report_no }}&emsp;共 {{ totalReportPages }} 页 第 2 页起</span>
        </div>

        <el-table :data="dataRows" border stripe size="small" class="data-preview-table"
          :span-method="spanMethod">
          <el-table-column label="试样编号" width="65" align="center">
            <template #default="{ $index }">{{ $index + 1 }}</template>
          </el-table-column>
          <el-table-column label="取样桩号" width="110" align="center">
            <template #default="{ row }">
              <el-input v-model="row.stake_no" size="small" class="table-edit-input" />
            </template>
          </el-table-column>
          <el-table-column label="取样位置（部位）" width="110" align="center">
            <template #default="{ row }">
              <el-input v-model="row.position_name" size="small" class="table-edit-input" />
            </template>
          </el-table-column>
          <el-table-column label="侧位" width="70" align="center">
            <template #default="{ row }">
              <el-input v-model="row.position_side" size="small" class="table-edit-input" />
            </template>
          </el-table-column>
          <el-table-column label="设计要求(%)" width="105" align="center">
            <template #default="{ row }">
              <span class="readonly-cell">{{ row.design_requirement || designReqStr }}</span>
            </template>
          </el-table-column>
          <el-table-column label="干密度(g/cm³)" width="105" align="center">
            <template #default="{ row }">
              <span :class="{ 'empty-cell': !row.dry_density }">{{ row.dry_density || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="压实度(%)" width="85" align="center">
            <template #default="{ row }">
              <span class="compaction-val" v-if="row.compaction">{{ row.compaction }}</span>
              <span class="empty-cell" v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="单项判定" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.judgment" :type="row.judgment === '符合设计要求' ? 'success' : 'danger'" size="small">
                {{ row.judgment }}
              </el-tag>
              <span class="empty-cell" v-else>—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 操作按钮 -->
      <div class="form-actions">
        <el-button type="warning" @click="handleInit">
          <el-icon style="margin-right:4px"><Refresh /></el-icon>
          初始化
        </el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          <el-icon style="margin-right:4px"><Check /></el-icon>
          保存数据
        </el-button>
        <el-button type="success" size="large" @click="handlePrint" :disabled="printing" :loading="printing">
          确认无误，生成报告
        </el-button>
        <el-button size="large" @click="handleClear">取消</el-button>
      </div>
    </template>

    <!-- 进度对话框 -->
    <el-dialog v-model="printDialogVisible" title="正在生成检测报告 PDF" width="480px"
      :close-on-click-modal="false" :close-on-press-escape="false">
      <el-progress :percentage="printPercent"
        :status="printError ? 'exception' : printDone ? 'success' : ''" />
      <p style="margin-top:12px;color:#606266">{{ printMessage }}</p>
      <p style="color:#909399;font-size:12px">步骤 {{ printStep }}/{{ printTotal }}</p>
      <template #footer>
        <el-button v-if="printDone && !printError" type="primary" @click="handleDownload">下载 PDF</el-button>
        <el-button v-if="printError" @click="printDialogVisible = false">关闭</el-button>
        <el-button v-if="!printDone && !printError" @click="cancelPrint">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { getEntrustList } from '../../api/entrust'
import { getReportData, saveReportData, startReportPrint, getReportPrintStatus, downloadReportPrint } from '../../api/report'

const loading = ref(false)
const filterCategory = ref('')
const tableData = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selected = ref(false)
const selectedEntrustId = ref(null)
const selectedEntrustNo = ref('')

const isPipe = computed(() => {
  const row = tableData.value.find(r => r.id === selectedEntrustId.value)
  return row?.entrust_type === '管道压实度'
})

const form = reactive({
  report_no: '', project_name: '', client_unit: '', test_item: '', report_date: '',
  entrust_type: '', build_unit: '', construction_unit: '', supervision_unit: '',
  witness_person: '', total_samples: 0, sampling_date: '', test_date: '',
  section_pile: '', structure_part: '',
  test_basis: [], test_equipment: { sand_cylinder: '150mm', drying_oven: [] },
  max_dry_density: '', conclusion: '',
})

const dataRows = ref([])
const dataRowsPerPage = 18
const samplingDateRange = ref(null)

const totalReportPages = computed(() => {
  const dataPages = Math.max(1, Math.ceil(dataRows.value.length / dataRowsPerPage))
  return 1 + dataPages // info + data（封面不编页码）
})

const designReqStr = computed(() => {
  if (!dataRows.value.length) return '—'
  return dataRows.value[0]?.design_requirement || '—'
})

// 每3行合并：取样桩号(1)、取样位置(2)
function spanMethod({ rowIndex, columnIndex }) {
  if (columnIndex === 1 || columnIndex === 2) {
    const groupStart = Math.floor(rowIndex / 3) * 3
    const posInGroup = rowIndex - groupStart
    if (posInGroup === 0) {
      return { rowspan: 3, colspan: 1 }
    }
    return { rowspan: 0, colspan: 0 }
  }
  return { rowspan: 1, colspan: 1 }
}

function defaultConclusion() {
  const dataPages = Math.ceil(dataRows.value.length / dataRowsPerPage)
  const dataStartPage = 2 // 数据页从第2页开始（第1页是信息页）
  const dataEndPage = dataStartPage + dataPages - 1
  const pageRef = dataPages <= 1 ? `第${dataStartPage}页` : `第${dataStartPage}-${dataEndPage}页`
  return `依据《公路路基路面现场测试规程》（JTG 3450—2019）进行检测，所检测项目结果符合《给水排水管工程施工及验收规范》GB 50268-2008的标准和设计要求。详见报告${pageRef}。`
}

function samplingDateStr() {
  const range = samplingDateRange.value
  if (!range || !range.length) return ''
  return range.filter(Boolean).join(' ~ ')
}

// 保存状态
const saving = ref(false)
let originalForm = null

// 打印状态
const printing = ref(false)
const printDialogVisible = ref(false)
const printPercent = ref(0)
const printMessage = ref('')
const printStep = ref(0)
const printTotal = ref(0)
const printDone = ref(false)
const printError = ref(false)
let printTaskId = null
let printPollTimer = null

function tableRowClass({ row }) {
  return row.id === selectedEntrustId.value ? 'current-row' : ''
}

onMounted(() => fetchData())
onBeforeUnmount(() => { if (printPollTimer) clearInterval(printPollTimer); if (autoSaveTimer) clearTimeout(autoSaveTimer) })

// 自动保存
let autoSaveTimer = null
let autoSaveReady = false
watch(dataRows, () => { if (autoSaveReady) debouncedAutoSave() }, { deep: true })
watch(form, () => { if (autoSaveReady) debouncedAutoSave() }, { deep: true })

function debouncedAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => handleSave(), 2000)
}

function handleFilter() {
  pagination.page = 1
  fetchData()
}

async function fetchData() {
  loading.value = true
  try {
    const params = { page: pagination.page, pageSize: pagination.pageSize }
    if (filterCategory.value) params.category_code = filterCategory.value
    const res = await getEntrustList(params)
    tableData.value = res.data.list
    pagination.total = res.data.total
  } finally {
    loading.value = false
  }
}

async function handleSelect(row) {
  autoSaveReady = false
  selectedEntrustId.value = row.id
  selectedEntrustNo.value = row.entrust_no

  if (row.entrust_type !== '管道压实度') {
    selected.value = true
    return
  }

  try {
    const res = await getReportData(row.id)
    const d = res.data

    form.report_no = d.cover.report_no
    form.project_name = d.cover.project_name
    form.client_unit = d.cover.client_unit
    form.test_item = d.cover.test_item
    form.report_date = d.cover.report_date || ''

    form.entrust_type = d.info.entrust_type
    form.build_unit = d.info.build_unit
    form.construction_unit = d.info.construction_unit
    form.supervision_unit = d.info.supervision_unit
    form.witness_person = d.info.witness_person
    form.total_samples = d.info.total_samples
    if (d.info.sampling_date && d.info.sampling_date.includes('~')) {
      samplingDateRange.value = d.info.sampling_date.split('~').map(s => s.trim())
    } else if (d.info.sampling_date) {
      samplingDateRange.value = [d.info.sampling_date, d.info.sampling_date]
    } else {
      samplingDateRange.value = null
    }
    form.test_date = d.info.test_date
    form.section_pile = d.info.section_pile
    form.structure_part = d.info.structure_part
    form.test_basis = d.info.test_basis || []
    form.test_equipment = d.info.test_equipment || { sand_cylinder: '150mm', drying_oven: [] }
    form.max_dry_density = d.info.max_dry_density
    form.conclusion = d.info.conclusion || defaultConclusion()

    dataRows.value = d.data_rows || []

    selected.value = true
    // 延迟启用自动保存，避免加载时触发
    setTimeout(() => { autoSaveReady = true }, 1000)
  } catch {
    selected.value = true
  }
}

function handleClear() {
  autoSaveReady = false
  selected.value = false
  selectedEntrustId.value = null
  selectedEntrustNo.value = ''
  dataRows.value = []
  samplingDateRange.value = null
}

async function handleSave() {
  saving.value = true
  try {
    const payload = {
      project_name: form.project_name,
      client_unit: form.client_unit,
      report_date: form.report_date,
      entrust_type: form.entrust_type,
      build_unit: form.build_unit,
      construction_unit: form.construction_unit,
      supervision_unit: form.supervision_unit,
      witness_person: form.witness_person,
      sampling_date: samplingDateStr(),
      test_date: form.test_date,
      section_pile: form.section_pile,
      structure_part: form.structure_part,
      test_basis: form.test_basis,
      test_equipment: form.test_equipment,
      max_dry_density: form.max_dry_density,
      conclusion: form.conclusion,
      data_rows: dataRows.value.map(r => ({
        id: r.id,
        stake_no: r.stake_no,
        position_name: r.position_name,
        position_side: r.position_side,
      })),
    }
    await saveReportData(selectedEntrustId.value, payload)
    originalForm = JSON.parse(JSON.stringify(payload))
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function handleInit() {
  try {
    await ElMessageBox.confirm(
      '确认要初始化吗？将恢复到原始数据。',
      '初始化确认',
      { confirmButtonText: '确认初始化', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  // 重新加载数据
  if (!selectedEntrustId.value) return
  try {
    const res = await getReportData(selectedEntrustId.value)
    const d = res.data
    form.report_no = d.cover.report_no
    form.project_name = d.cover.project_name
    form.client_unit = d.cover.client_unit
    form.test_item = d.cover.test_item
    form.report_date = d.cover.report_date || ''
    form.entrust_type = d.info.entrust_type
    form.build_unit = d.info.build_unit
    form.construction_unit = d.info.construction_unit
    form.supervision_unit = d.info.supervision_unit
    form.witness_person = d.info.witness_person
    form.total_samples = d.info.total_samples
    if (d.info.sampling_date && d.info.sampling_date.includes('~')) {
      samplingDateRange.value = d.info.sampling_date.split('~').map(s => s.trim())
    } else if (d.info.sampling_date) {
      samplingDateRange.value = [d.info.sampling_date, d.info.sampling_date]
    } else {
      samplingDateRange.value = null
    }
    form.test_date = d.info.test_date
    form.section_pile = d.info.section_pile
    form.structure_part = d.info.structure_part
    form.test_basis = d.info.test_basis || []
    form.test_equipment = d.info.test_equipment || { sand_cylinder: '150mm', drying_oven: [] }
    form.max_dry_density = d.info.max_dry_density
    form.conclusion = d.info.conclusion || defaultConclusion()
    dataRows.value = d.data_rows || []
    autoSaveReady = false
    setTimeout(() => { autoSaveReady = true }, 1000)
    ElMessage.success('已初始化')
  } catch {
    ElMessage.error('初始化失败')
  }
}

async function handlePrint() {
  printing.value = true
  printDone.value = false
  printError.value = false
  printPercent.value = 0
  printMessage.value = '正在启动报告生成...'
  printDialogVisible.value = true

  const headerData = {
    project_name: form.project_name,
    client_unit: form.client_unit,
    test_item: form.test_item,
    report_date: form.report_date,
    entrust_type: form.entrust_type,
    build_unit: form.build_unit,
    construction_unit: form.construction_unit,
    supervision_unit: form.supervision_unit,
    witness_person: form.witness_person,
    sampling_date: samplingDateStr(),
    test_date: form.test_date,
    section_pile: form.section_pile,
    structure_part: form.structure_part,
    test_basis: form.test_basis,
    test_equipment: form.test_equipment,
    max_dry_density: form.max_dry_density,
    conclusion: form.conclusion,
  }

  try {
    const res = await startReportPrint(selectedEntrustId.value, headerData)
    printTaskId = res.data.taskId

    printPollTimer = setInterval(async () => {
      try {
        const statusRes = await getReportPrintStatus(selectedEntrustId.value, printTaskId)
        const job = statusRes.data
        printStep.value = job.step
        printTotal.value = job.totalSteps
        printMessage.value = job.message
        if (job.totalSteps > 0) {
          printPercent.value = Math.round((job.step / job.totalSteps) * 100)
        }
        if (job.done) {
          clearInterval(printPollTimer)
          printPollTimer = null
          if (job.error) {
            printError.value = true
            printPercent.value = 100
            printMessage.value = '生成失败: ' + job.message
          } else {
            printDone.value = true
            printPercent.value = 100
            printMessage.value = 'PDF 生成完成，点击下方按钮下载'
          }
        }
      } catch {
        // 继续轮询
      }
    }, 600)
  } catch (e) {
    printError.value = true
    printMessage.value = '启动失败: ' + (e.message || '未知错误')
  }
}

async function handleDownload() {
  try {
    const blob = await downloadReportPrint(selectedEntrustId.value, printTaskId)
    const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    window.open(url, '_blank')
    setTimeout(() => window.URL.revokeObjectURL(url), 2000)
    printDialogVisible.value = false
    printing.value = false
    printTaskId = null
  } catch {
    ElMessage.error('下载失败')
  }
}

function cancelPrint() {
  if (printPollTimer) {
    clearInterval(printPollTimer)
    printPollTimer = null
  }
  printDialogVisible.value = false
  printing.value = false
  printTaskId = null
}
</script>

<style scoped>
.page-container { max-width: 1200px; margin: 0 auto; }
.page-header { margin-bottom: 16px; }
.page-header h3 { margin: 0; font-size: 18px; font-weight: 600; }

.search-card { margin-bottom: 12px; }
.table-card { margin-bottom: 16px; }

/* ===== 三段式报告卡片 ===== */
.report-card {
  margin-bottom: 16px;
  border: 1px solid #d0d5dd;
}

.card-title-bar {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  padding-bottom: 12px;
  border-bottom: 2px solid #409eff;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-badge {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}

/* ===== 封面页 ===== */
.cover-sheet {
  max-width: 680px;
  margin: 0 auto;
  padding: 40px 60px 24px;
  border: 1px solid #333;
  background: #fff;
}

.cover-title {
  text-align: center;
  font-size: 36px;
  font-weight: 700;
  font-family: '黑体', 'SimHei', sans-serif;
  letter-spacing: 20px;
  margin-bottom: 48px;
  color: #000;
}

.cover-fields {
  display: flex;
  flex-direction: column;
  gap: 28px;
  margin-bottom: 60px;
}

.cover-field {
  display: flex;
  align-items: center;
  gap: 0;
  font-size: 15px;
  font-weight: 700;
  font-family: 'Times New Roman', '宋体', serif;
}

.cover-label {
  white-space: nowrap;
  color: #000;
}

.cover-value {
  color: #000;
  flex: 1;
}

.cover-input {
  flex: 1;
}
.cover-input :deep(.el-input__wrapper) {
  box-shadow: none !important;
  border: none !important;
  border-bottom: 1px solid #000 !important;
  border-radius: 0 !important;
  background: transparent !important;
  padding: 0 4px;
  font-size: 15px;
  font-weight: 700;
  font-family: 'Times New Roman', '宋体', serif;
}

.cover-footer {
  text-align: center;
  color: #000;
  font-size: 14px;
  line-height: 2;
}
.cover-company {
  font-size: 15px;
  font-weight: 500;
}
.cover-address {
  font-size: 12px;
  color: #333;
}

/* ===== 信息页表格 ===== */
.info-table {
  border: 1px solid #333;
  margin-bottom: 16px;
}

.info-row {
  display: grid;
  grid-template-columns: 110px 1fr 110px 1fr;
  border-bottom: 1px solid #333;
  min-height: 42px;
}
.info-row:last-child { border-bottom: none; }

.info-label {
  background: #f5f7fa;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-right: 1px solid #ddd;
}

.info-value {
  padding: 4px 8px;
  display: flex;
  align-items: center;
  border-right: 1px solid #ddd;
}
.info-value:last-child { border-right: none; }

.info-value.colspan-3 {
  grid-column: 2 / -1;
}

.info-value :deep(.el-input__wrapper) {
  box-shadow: none !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  padding: 2px 4px;
}

.static-text {
  padding: 2px 4px;
  color: #303133;
  font-size: 14px;
}

.equipment-line {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
  font-size: 13px;
}
.inline-checks {
  display: inline-flex;
  gap: 0;
}

.notice-label {
  align-items: flex-start !important;
  padding-top: 8px;
}
.notice-content p {
  margin: 2px 0;
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}
.notice-content {
  flex-direction: column;
  align-items: flex-start !important;
}

.remark-prefix {
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-right: 4px;
}

.signature-area {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 8px 0;
  font-size: 13px;
  color: #303133;
}
.sig-space {
  margin-left: 32px;
}

/* ===== 数据预览 ===== */
.data-preview-table {
  width: 100%;
}

.table-edit-input :deep(.el-input__wrapper) {
  box-shadow: none !important;
  border: none !important;
  border-bottom: 1px solid #dcdfe6 !important;
  border-radius: 0 !important;
  background: transparent !important;
  padding: 0 2px;
}
.table-edit-input :deep(.el-input__inner) {
  text-align: center;
  font-size: 12px;
}

.readonly-cell {
  font-size: 13px;
  color: #303133;
}

.compaction-val {
  font-weight: 700;
  color: #409eff;
  font-size: 13px;
}

.empty-cell {
  color: #c0c4cc;
  font-size: 13px;
}

/* ===== 操作按钮 ===== */
.form-actions {
  text-align: center;
  margin-top: 24px;
  padding: 24px 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

:deep(.el-table .current-row) { background-color: #ecf5ff; }
</style>
