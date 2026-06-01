<template>
  <div class="record-page" v-loading="loading">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-title">
        <h3>
          原始记录 - {{ recordData.entrust?.entrust_no }}
          <el-tag v-if="recordData.entrust?.entrust_type" type="primary" effect="dark" style="margin-left:8px">
            {{ recordData.entrust?.entrust_type }}
          </el-tag>
        </h3>
      </div>
      <div class="toolbar-btns">
        <el-button @click="$router.back()">返回</el-button>
        <el-button type="warning" @click="handleInit">
          <el-icon style="margin-right:4px"><Refresh /></el-icon>
          初始化
        </el-button>
        <el-button @click="handleCopy" :disabled="currentPageRows.length === 0">
          <el-icon style="margin-right:4px"><CopyDocument /></el-icon>
          复制表格
        </el-button>
        <el-button type="success" @click="handlePrintPdf" :disabled="printing">
          <el-icon style="margin-right:4px"><Printer /></el-icon>
          打印手写记录单预览
        </el-button>
        <el-button type="success" @click="handlePrintBlank" :disabled="printing" plain>
          <el-icon style="margin-right:4px"><Printer /></el-icon>
          打印空白记录单
        </el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          <el-icon style="margin-right:4px"><Check /></el-icon>
          保存记录
        </el-button>
      </div>
    </div>

    <div v-if="recordData.entrust">
      <!-- 抬头信息 -->
      <el-card shadow="never" class="section-card">
        <template #header><span class="card-title">记录单抬头</span></template>
        <div class="header-table">
          <!-- 第1行：基础信息 -->
          <div class="ht-row cols-3">
            <div class="ht-cell">
              <span class="ht-lbl">委托编号</span>
              <span class="ht-val">{{ recordData.entrust.entrust_no }}</span>
            </div>
            <div class="ht-cell">
              <span class="ht-lbl">记录单编号</span>
              <span class="ht-val">JL/{{ recordData.entrust.entrust_no }}</span>
            </div>
            <div class="ht-cell">
              <span class="ht-lbl">委托日期</span>
              <span class="ht-val">{{ recordData.entrust.entrust_date }}</span>
            </div>
          </div>
          <!-- 第2行：工程名称（独占一行） -->
          <div class="ht-row cols-1">
            <div class="ht-cell">
              <span class="ht-lbl">工程名称</span>
              <span class="ht-val">{{ header.project_name }}</span>
            </div>
          </div>
          <!-- 第3行：委托单位 + 见证单位 -->
          <div class="ht-row cols-2">
            <div class="ht-cell">
              <span class="ht-lbl">委托单位</span>
              <span class="ht-val">{{ header.client_unit }}</span>
            </div>
            <div class="ht-cell">
              <span class="ht-lbl">见证单位</span>
              <span class="ht-val">{{ header.supervision_unit }}</span>
            </div>
          </div>
          <!-- 第4行：结构 + 最大干密度 -->
          <div class="ht-row cols-2">
            <div class="ht-cell">
              <span class="ht-lbl">{{ isPipeline ? '结构材料' : '结构层次' }}</span>
              <el-input v-model="extra.structure_layer" size="small" style="flex:1" />
            </div>
            <div class="ht-cell">
              <span class="ht-lbl">最大干密度</span>
              <template v-if="isPipeline">
                <span v-for="mat in uniqueMaterials" :key="mat" style="margin-right:12px;white-space:nowrap">
                  {{ mat }}
                  <el-input v-model="extra.max_dry_densities[mat]" size="small" style="width:80px" placeholder="2.11" />
                  <span style="font-size:12px">g/cm³</span>
                </span>
              </template>
              <template v-else>
                <el-input v-model="maxDryDensityValue" size="small" style="width:80px" placeholder="2.11" />
                <span style="font-size:12px"> g/cm³</span>
              </template>
            </div>
          </div>
          <!-- 第5行：设计要求（独占一行） -->
          <div class="ht-row cols-1">
            <div class="ht-cell">
              <span class="ht-lbl">设计要求</span>
              <el-input v-model="extra.design_req" size="small" style="flex:1;max-width:600px" />
            </div>
          </div>
        </div>
      </el-card>

      <!-- 页码选择 -->
      <el-card shadow="never" class="section-card" v-if="pages.length > 0">
        <div class="page-tabs">
          <span class="page-tabs-label">选择页码：</span>
          <el-radio-group v-model="activePage" size="default">
            <el-radio-button v-for="p in pages" :key="p.no" :value="p.no">
              第{{ p.no }}页（{{ p.rows.length }}个样品）
            </el-radio-button>
          </el-radio-group>
          <span style="color:#909399;font-size:12px;margin-left:12px">共 {{ totalSamples }} 个样品，{{ pages.length }} 页</span>
        </div>
      </el-card>

      <!-- 当前页检测数据表 -->
      <el-card shadow="never" class="section-card" v-if="currentPageRows.length > 0">
        <template #header>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span class="card-title" @click="onTitleClick">检测数据 — 第{{ activePage }}页</span>
            <span style="font-size:11px;color:#909399">Enter↓ / Tab→ / 支持粘贴 Excel 数据</span>
          </div>
        </template>
        <div class="table-wrapper" @paste="handlePaste">
          <table class="data-table" ref="dataTable">
            <thead>
              <tr>
                <th class="param-col">检测参数</th>
                <th v-for="(row, idx) in currentPageRows" :key="idx">
                  {{ row.seq_no }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(def, ri) in inputRowDefs" :key="ri">
                <td class="param-label" :class="{ 'calc-row': def.calc, 'result-row': def.result }">{{ def.label }}</td>
                <!-- 合并单元格（管道压实度：桩号/取样位置每3列合并） -->
                <template v-if="def.span > 1 && !def.calc">
                  <td v-for="(group, gi) in sampleGroups" :key="gi"
                    :colspan="def.span"
                    :class="{ 'merged-cell': true }">
                    <input
                      :value="getGroupValue(def.key, group)"
                      @input="onGroupInput(def.key, group, $event)"
                      @dblclick="def.key === 'stake_no' ? openStakeDialog() : null"
                      @paste="handleCellPaste"
                      class="ci"
                      :data-row="ri"
                      :data-col="gi"
                      @keydown.enter.prevent="navEnter(ri, gi)"
                      @keydown.tab="navTab(ri, gi, $event)"
                    />
                  </td>
                </template>
                <!-- 普通单元格 -->
                <template v-else>
                  <td v-for="(row, ci) in currentPageRows" :key="ci"
                    :class="{ 'calc-row': def.calc, 'result-row': def.result }">
                    <input v-if="!def.calc"
                      v-model="row.test_values[def.key]"
                      @dblclick="def.key === 'stake_no' ? openStakeDialog() : null"
                      @paste="handleCellPaste"
                      class="ci"
                      :data-row="ri"
                      :data-col="ci"
                      @keydown.enter.prevent="navEnter(ri, ci)"
                      @keydown.tab="navTab(ri, ci, $event)"
                      @input="def.onInput ? def.onInput(row) : null"
                    />
                    <span v-else-if="def.key === 'max_dry_density'">{{ formatMaxDryDensity(row) }}</span>
                    <span v-else-if="def.key === 'compaction'" class="result-val">{{ calcField(row, 'compaction') }}</span>
                    <span v-else>{{ calcField(row, def.key) }}</span>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </el-card>

      <!-- 底部信息 -->
      <el-card shadow="never" class="section-card">
        <template #header><span class="card-title">其他信息</span></template>
        <el-form label-width="80px" size="small">
          <el-form-item label="检测结论">
            <div style="display:flex;align-items:center;gap:8px">
              <el-select v-model="extra.conclusion" style="width:240px" clearable placeholder="请选择">
                <el-option label="符合要求" value="符合要求" />
                <el-option label="不符合要求" value="不符合要求" />
              </el-select>
              <el-tag v-if="autoConclusion" :type="autoConclusion === '符合要求' ? 'success' : 'danger'" effect="dark">
                建议：{{ autoConclusion }}
              </el-tag>
            </div>
          </el-form-item>
          <el-form-item label="检测设备">
            <div class="equipment-line">
              <span>灌砂筒(</span>
              <el-select v-model="extra.sand_cylinder" size="small" style="width:100px">
                <el-option label="100mm" value="100mm" />
                <el-option label="150mm" value="150mm" />
                <el-option label="200mm" value="200mm" />
              </el-select>
              <span>)（SB143） 电子秤（SB133）电热鼓风干燥箱（</span>
              <el-checkbox-group v-model="extra.drying_oven" size="small" class="inline-checkbox-group">
                <el-checkbox label="SB55" />
                <el-checkbox label="SB56" />
                <el-checkbox label="SB128" />
                <el-checkbox label="SB227" />
              </el-checkbox-group>
              <span>）电子秤（SB139）</span>
            </div>
          </el-form-item>
          <el-form-item label="检测依据">
            <div class="basis-group">
              <el-checkbox-group v-model="extra.test_basis" size="small">
                <el-checkbox label="JTG 3450-2019">
                  《公路路基路面现场测试规程》JTG 3450-2019
                </el-checkbox>
                <el-checkbox label="GB/T 50123-2019">
                  《土工试验方法标准》GB/T 50123-2019
                </el-checkbox>
              </el-checkbox-group>
              <el-checkbox-group v-model="extra.test_basis" size="small">
                <el-checkbox label="CJJ 1-2008">
                  《城镇道路工程施工与质量验收规范》CJJ 1-2008
                </el-checkbox>
                <el-checkbox label="GB 50268-2008">
                  《给水排水管工程施工及验收规范》GB 50268-2008
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="extra.remark_footer" />
          </el-form-item>
          <el-row :gutter="16">
            <el-col :span="6">
              <el-form-item label="试验人"><el-input v-model="extra.tester" /></el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="复核人"><el-input v-model="extra.reviewer" /></el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="试验日期">
                <el-date-picker v-model="extra.test_date_range" type="daterange" range-separator="至"
                  start-placeholder="开始日期" end-placeholder="结束日期"
                  value-format="YYYY-MM-DD" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </el-card>
    </div>

    <el-empty v-else-if="!loading" description="该委托单暂无检测明细数据" />

    <!-- PDF 生成进度弹窗 -->
    <el-dialog v-model="printDialogVisible" :title="printMode === 'blank' ? '正在生成空白记录单 PDF' : '正在生成 PDF'" width="480px" :close-on-click-modal="false" :close-on-press-escape="false">
      <div style="text-align:center">
        <el-progress :percentage="printPercent" :status="printError ? 'exception' : printDone ? 'success' : ''" :stroke-width="16" />
        <p style="margin-top:16px;color:var(--color-text-secondary);font-size:13px">{{ printMessage }}</p>
        <p style="color:var(--color-text-placeholder);font-size:12px">步骤 {{ printStep }}/{{ printTotal }}</p>
      </div>
      <template #footer>
        <el-button v-if="printDone && !printError" type="primary" @click="handleDownloadPdf">下载 PDF</el-button>
        <el-button v-if="printError" @click="printDialogVisible = false">关闭</el-button>
        <el-button v-if="!printDone && !printError" @click="cancelPrint">取消</el-button>
      </template>
    </el-dialog>

    <!-- 倒推生成弹窗 -->
    <ReverseGenModal v-model="genModalVisible" :current-page-rows="currentPageRows"
      :all-rows="allRows" :extra="extra" :is-pipeline="isPipeline"
      :entrust-items="recordData.entrust?.items || []" @fill-and-save="onGenFillAndSave" />

    <!-- 批量设置桩号弹窗 -->
    <el-dialog v-model="stakeDialogVisible" title="批量设置桩号" width="480px" :close-on-click-modal="false">
      <el-input ref="stakeInputRef" v-model="stakeDialogValue" placeholder="输入桩号，将应用到所有样品"
        @keydown.enter="applyStakeToAll" @paste="handleStakePaste" />
      <div class="corner-char-palette">
        <span class="palette-label">上标：</span>
        <button v-for="ch in superChars" :key="ch" class="char-btn" @click="insertCornerChar(ch)" type="button">{{ ch }}</button>
        <span class="palette-divider">|</span>
        <span class="palette-label">下标：</span>
        <button v-for="ch in subChars" :key="ch" class="char-btn" @click="insertCornerChar(ch)" type="button">{{ ch }}</button>
      </div>
      <template #footer>
        <el-button @click="stakeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="applyStakeToAll">应用到所有桩号</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRecords, updateRecordRows, startPrint, getPrintStatus, downloadPrintPdf, startPrintBlank, getPrintBlankStatus, downloadPrintBlankPdf } from '../../api/record'
import { getInstruments } from '../../api/instrument'
import { bankersRound } from '../../utils/rounding'
import ReverseGenModal from './ReverseGenModal.vue'

const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const activePage = ref(1)
const dataTable = ref(null)
const recordData = reactive({ entrust: null, pages: [] })

// 倒推生成
const genModalVisible = ref(false)
const titleClickCount = ref(0)
let titleClickTimer = null

// 批量设置桩号弹窗
const stakeDialogVisible = ref(false)
const stakeDialogValue = ref('')
const stakeInputRef = ref(null)

const superChars = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁺', '⁻']
const subChars = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₊', '₋']

const SUPER_MAP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ' }
const SUB_MAP = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' }

// 将 HTML 中的 <sup>/<sub> 标签转为 Unicode 角标字符（用于粘贴 Word 内容）
function convertHtmlCorner(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return walkCornerNode(div)
}

function walkCornerNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent
  if (node.nodeType === Node.ELEMENT_NODE) {
    let result = ''
    for (const child of node.childNodes) {
      const text = walkCornerNode(child)
      if (node.tagName === 'SUP') {
        result += [...text].map(ch => SUPER_MAP[ch] || ch).join('')
      } else if (node.tagName === 'SUB') {
        result += [...text].map(ch => SUB_MAP[ch] || ch).join('')
      } else {
        result += text
      }
    }
    return result
  }
  return ''
}

// 在输入框中粘贴时插入转换后的文本
function pasteConverted(el, converted) {
  if (!el) return
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  const before = el.value.slice(0, start)
  const after = el.value.slice(end)
  el.value = before + converted + after
  setTimeout(() => {
    const pos = start + converted.length
    el.setSelectionRange(pos, pos)
    el.focus()
  }, 0)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function handleStakePaste(event) {
  const html = event.clipboardData?.getData('text/html')
  if (!html) return
  event.preventDefault()
  const converted = convertHtmlCorner(html)
  pasteConverted(event.target, converted)
}

function handleCellPaste(event) {
  const html = event.clipboardData?.getData('text/html')
  if (!html) return
  event.preventDefault()
  const converted = convertHtmlCorner(html)
  pasteConverted(event.target, converted)
}

function openStakeDialog() {
  stakeDialogValue.value = ''
  stakeDialogVisible.value = true
}

function insertCornerChar(ch) {
  const el = stakeInputRef.value?.$el?.querySelector('input') || stakeInputRef.value?.input
  if (!el) {
    stakeDialogValue.value += ch
    return
  }
  const start = el.selectionStart ?? stakeDialogValue.value.length
  const end = el.selectionEnd ?? start
  const before = stakeDialogValue.value.slice(0, start)
  const after = stakeDialogValue.value.slice(end)
  stakeDialogValue.value = before + ch + after
  // 恢复光标位置
  setTimeout(() => {
    const pos = start + ch.length
    el.setSelectionRange(pos, pos)
    el.focus()
  }, 0)
}

function applyStakeToAll() {
  const value = stakeDialogValue.value
  for (const row of allRows.value) {
    if (!row.test_values) row.test_values = {}
    row.test_values.stake_no = value
  }
  stakeDialogVisible.value = false
  ElMessage.success(`已将桩号 "${value}" 应用到所有样品`)
}

// 仪器库（盒号→盒质量映射）
const instrumentMap = ref({})  // { '1': 380, '2': 375, ... }

async function loadInstruments() {
  try {
    const res = await getInstruments('白搪瓷盒')
    const map = {}
    for (const item of (res.data || [])) {
      map[String(item.code)] = item.mass
    }
    instrumentMap.value = map
  } catch {}
}

function onTitleClick() {
  titleClickCount.value++
  clearTimeout(titleClickTimer)
  if (titleClickCount.value >= 5) {
    titleClickCount.value = 0
    genModalVisible.value = true
  } else {
    titleClickTimer = setTimeout(() => { titleClickCount.value = 0 }, 1000)
  }
}

// 打印进度
const printing = ref(false)
const printMode = ref('normal')  // 'normal' | 'blank'
const printDialogVisible = ref(false)
const printPercent = ref(0)
const printMessage = ref('')
const printStep = ref(0)
const printTotal = ref(0)
const printDone = ref(false)
const printError = ref(false)
let printTaskId = null
let printPollTimer = null
let printEntrustNo = ''

const header = reactive({
  project_name: '', client_unit: '', supervision_unit: '',
  entrust_no: '', entrust_date: ''
})
const extra = reactive({
  structure_layer: '', design_req: '', max_dry_densities: {},
  conclusion: '', remark_footer: '', tester: '', reviewer: '', test_date: '',
  sand_cylinder: '150mm',
  drying_oven: [],
  test_basis: [],
  test_date_range: null
})

// 当前委托所有不重复材料
const uniqueMaterials = computed(() => {
  const items = recordData.entrust?.items || []
  return [...new Set(items.map(i => i.material).filter(Boolean))]
})

// 路基压实度用：取第一个材料的最大干密度
const maxDryDensityValue = computed({
  get: () => {
    const mats = uniqueMaterials.value
    return mats.length > 0 ? (extra.max_dry_densities[mats[0]] || '') : ''
  },
  set: (val) => {
    const mats = uniqueMaterials.value
    if (mats.length > 0) extra.max_dry_densities[mats[0]] = val
  }
})

// 根据样品行查找对应材料
function getRowMaterial(row) {
  if (row.material) return row.material
  const items = recordData.entrust?.items || []
  const item = items.find(i => i.position_name === row.position_name)
  return item?.material || ''
}

// 获取某行的最大干密度
function getMaxDryDensity(row) {
  const mat = getRowMaterial(row)
  if (mat && extra.max_dry_densities[mat]) return parseFloat(extra.max_dry_densities[mat]) || 0
  // 回退到任意可用值
  const vals = Object.values(extra.max_dry_densities).filter(Boolean)
  return vals.length > 0 ? parseFloat(vals[0]) || 0 : 0
}

function formatMaxDryDensity(row) {
  const mdd = getMaxDryDensity(row)
  return mdd > 0 ? bankersRound(mdd, 2) : ''
}

// 盒号自动填入盒质量
function onBoxNoInput(row) {
  const v = row.test_values || {}
  const boxNo = v.box_no
  if (boxNo && instrumentMap.value[String(boxNo)] != null) {
    v.box_mass = String(instrumentMap.value[String(boxNo)])
  }
}

const allRows = ref([])

// 是否管道压实度（桩号/取样位置每3列合并）
const isPipeline = computed(() => {
  return recordData.entrust?.entrust_type === '管道压实度'
})

// 自动判定检测结论
const autoConclusion = computed(() => {
  const rows = allRows.value
  if (!rows.length) return ''
  const items = recordData.entrust?.items || []
  const reqMap = {}
  for (const item of items) {
    const op = item.design_operator || '≥'
    const req = parseFloat(item.design_requirement)
    const tol = parseFloat(item.design_tolerance)
    if (!isNaN(req)) reqMap[item.position_name] = { op, req, tol: isNaN(tol) ? 0 : tol }
  }
  let allPass = true
  let hasAnyResult = false
  for (const row of rows) {
    const compaction = parseFloat(calcField(row, 'compaction'))
    if (isNaN(compaction) || compaction <= 0) continue
    hasAnyResult = true
    const req = reqMap[row.position_name]
    if (!req) continue
    let pass
    if (req.op === '±' && req.tol > 0) {
      pass = compaction >= req.req - req.tol && compaction <= req.req + req.tol
    } else if (req.op === '≥') {
      pass = compaction >= req.req
    } else if (req.op === '≤') {
      pass = compaction <= req.req
    } else {
      pass = compaction >= req.req
    }
    if (!pass) allPass = false
  }
  if (!hasAnyResult) return ''
  return allPass ? '符合要求' : '不符合要求'
})

// 输入行定义（顺序即表格行序）
const inputRowDefs = computed(() => {
  const isPipe = isPipeline.value
  const defs = [
    { key: 'stake_no',     label: '桩号',              calc: false, span: isPipe ? 3 : 1 },
    { key: 'position',     label: isPipe ? '取样位置' : '取样位置距中(m)', calc: false, span: isPipe ? 3 : 1 },
    { key: 'sand_before',  label: '灌砂前砂+容器质量(g)',                                          calc: false, onInput: calcRow },
    { key: 'sand_after',   label: '灌砂后砂+容器质量(g)',                                          calc: false, onInput: calcRow },
    { key: 'sand_surface', label: '灌砂筒下部锥体内及基板和粗糙表面间砂的合计质量(g)',              calc: false, onInput: calcRow },
    { key: 'pit_sand',     label: '试坑灌入量砂质量(g)',                                           calc: true },
    { key: 'sand_density', label: '量砂堆积密度(g/cm³)',                                           calc: false, onInput: calcRow },
    { key: 'pit_volume',   label: '试坑体积(cm³)',                                                 calc: true },
    { key: 'wet_mass',     label: '试坑中挖出的湿料质量(g)',                                       calc: false, onInput: calcRow },
    { key: 'wet_density',  label: '试样湿密度(g/cm³)',                                             calc: true },
    { key: 'box_no',       label: '盒号',                                                          calc: false, onInput: onBoxNoInput },
    { key: 'box_mass',     label: '盒质量(g)',                                                     calc: false, onInput: calcRow },
    { key: 'box_wet',      label: '盒+湿料质量(g)',                                                calc: false, onInput: calcRow },
    { key: 'box_dry',      label: '盒+干料质量(g)',                                                calc: false, onInput: calcRow },
    { key: 'water_content',label: '含水率(%)',                                                     calc: true },
    { key: 'dry_density',  label: '干密度(g/cm³)',                                                 calc: true },
    { key: 'max_dry_density', label: '最大干密度(g/cm³)',                                          calc: true },
    { key: 'compaction',   label: '压实度(%)',                                                     calc: true, result: true },
  ]
  return defs
})

// 所有可输入行的索引
const inputRowIndices = computed(() => {
  return inputRowDefs.value.reduce((acc, def, i) => {
    if (!def.calc) acc.push(i)
    return acc
  }, [])
})

// 管道压实度用：当前页样品按每3个分组（用于合并单元格渲染）
const sampleGroups = computed(() => {
  const rows = currentPageRows.value
  const groups = []
  for (let i = 0; i < rows.length; i += 3) {
    groups.push(rows.slice(i, i + 3))
  }
  return groups
})

// 获取合并单元格的值（取组内第一个样品的值）
function getGroupValue(key, group) {
  return group[0]?.test_values?.[key] ?? ''
}

// 设置合并单元格的值（同步到组内所有样品）
function onGroupInput(key, group, event) {
  const value = event.target.value
  for (const row of group) {
    if (!row.test_values) row.test_values = {}
    row.test_values[key] = value
  }
}

const pages = computed(() => {
  const rows = allRows.value
  if (rows.length === 0) return []
  const result = []
  for (let i = 0; i < rows.length; i += 9) {
    result.push({ no: result.length + 1, rows: rows.slice(i, i + 9) })
  }
  return result
})

const totalSamples = computed(() => allRows.value.length)
const currentPageRows = computed(() => {
  const p = pages.value.find(p => p.no === activePage.value)
  return p ? p.rows : []
})

onMounted(async () => {
  loading.value = true
  loadInstruments()  // 预加载仪器库（盒号自动填入用）
  try {
    const res = await getRecords(route.params.entrustNo)
    Object.assign(recordData, res.data)

    if (recordData.entrust) {
      header.project_name = recordData.entrust.project_name || ''
      header.client_unit = recordData.entrust.client_unit || ''
      header.supervision_unit = recordData.entrust.supervision_unit || ''
      header.entrust_no = recordData.entrust.entrust_no
      header.entrust_date = recordData.entrust.entrust_date
    }

    const rows = []
    let seq = 0
    for (const p of recordData.pages) {
      for (const r of p.rows) {
        if (r._empty) continue
        seq++
        rows.push({ ...r, seq_no: seq })
      }
    }
    allRows.value = rows

    if (recordData.pages.length > 0) {
      const firstPage = recordData.pages[0]
      if (firstPage.extra) {
        // 旧格式兼容：max_dry_density 转为新格式
        if (firstPage.extra.max_dry_density && !firstPage.extra.max_dry_densities) {
          const items = recordData.entrust?.items || []
          const mats = [...new Set(items.map(i => i.material).filter(Boolean))]
          const dens = {}
          if (mats.length > 0) dens[mats[0]] = firstPage.extra.max_dry_density
          firstPage.extra.max_dry_densities = dens
          delete firstPage.extra.max_dry_density
        }
        Object.assign(extra, firstPage.extra)
      }
    }

    // 为新字段设置默认值
    if (!extra.sand_cylinder) extra.sand_cylinder = '150mm'
    if (!extra.drying_oven) extra.drying_oven = []
    if (!extra.test_basis || extra.test_basis.length === 0) {
      extra.test_basis = isPipeline.value
        ? ['JTG 3450-2019', 'GB 50268-2008']
        : ['CJJ 1-2008', 'JTG 3450-2019']
    }
    if (!extra.test_date_range && extra.test_date) {
      extra.test_date_range = extra.test_date.includes('~')
        ? extra.test_date.split('~')
        : [extra.test_date, extra.test_date]
    }

    // 确保所有材料都有密度槽位
    for (const mat of uniqueMaterials.value) {
      if (!(mat in extra.max_dry_densities)) {
        extra.max_dry_densities[mat] = ''
      }
    }

    // 为已保存的行补充材料信息
    const entrustItems = recordData.entrust?.items || []
    for (const row of rows) {
      if (!row.material && row.position_name) {
        const item = entrustItems.find(i => i.position_name === row.position_name)
        if (item) row.material = item.material
      }
    }

    if (!extra.structure_layer) autoFillHeader()

    // 管道压实度：自动填充取样位置
    if (isPipeline.value) {
      const anyPosition = rows.some(r => r.test_values?.position)
      if (!anyPosition) autoFillPosition()
    }

    if (rows.length > 0) activePage.value = 1

    // 初始加载完成后启用自动保存
    nextTick(() => { autoSaveReady = true })
  } finally {
    loading.value = false
  }
})

function autoFillHeader() {
  if (!recordData.entrust) return
  const items = recordData.entrust.items
  if (!items || items.length === 0) return

  // 结构层次/结构材料
  const materials = [...new Set(items.map(i => i.material).filter(Boolean))]
  if (materials.length > 0) {
    if (isPipeline.value) {
      if (materials.length === 1) {
        // 单一材料 → "管道回填砂"
        extra.structure_layer = `管道回填${materials[0]}`
      } else {
        // 多材料：按材料分组部位 → "管顶、胸腔石屑，管底碎石"
        const groups = {}
        for (const item of items) {
          if (!item.material || !item.position_name) continue
          if (!groups[item.material]) groups[item.material] = []
          groups[item.material].push(item.position_name)
        }
        extra.structure_layer = Object.entries(groups)
          .map(([mat, positions]) => positions.join('、') + mat)
          .join('，')
      }
    } else {
      extra.structure_layer = materials.map(m => m + '层').join('、')
    }
  }

  // 设计要求：使用 design_operator + design_requirement + design_tolerance
  const reqs = items.map(i => {
    if (!i.position_name) return ''
    const op = i.design_operator || '≥'
    const val = i.design_requirement != null ? i.design_requirement : ''
    if (op === '±' && i.design_tolerance != null) {
      return `${i.position_name}${val}%±${i.design_tolerance}%`
    }
    return `${i.position_name}${op}${val}%`
  }).filter(Boolean)
  if (reqs.length > 0) extra.design_req = reqs.join('，')
}

// 自动填充管道压实度的取样位置
function autoFillPosition() {
  if (!isPipeline.value) return
  const items = recordData.entrust?.items || []
  if (!items.length) return

  let sampleIdx = 0
  for (const item of items) {
    const posName = item.position_name
    const groupCount = item.group_count || 1
    for (let g = 0; g < groupCount; g++) {
      const pos = groupCount === 1 ? posName : posName + (g === 0 ? '左侧' : '右侧')
      for (let l = 0; l < 3; l++) {
        if (sampleIdx < allRows.value.length) {
          const row = allRows.value[sampleIdx]
          if (!row.test_values) row.test_values = {}
          if (!row.test_values.position) row.test_values.position = pos
        }
        sampleIdx++
      }
    }
  }
}

function calcField(row, field) {
  const v = row.test_values || {}
  const toNum = (key) => parseFloat(v[key]) || 0
  switch (field) {
    case 'pit_sand': {
      // 输入均为整数(g)，结果应为整数
      const val = toNum('sand_before') - toNum('sand_after') - toNum('sand_surface')
      return val > 0 ? bankersRound(val, 0) : ''
    }
    case 'pit_volume': {
      // 整数(g) / 密度(g/cm³) → 修约到1位(cm³)
      const ps = toNum('sand_before') - toNum('sand_after') - toNum('sand_surface')
      const sd = toNum('sand_density')
      return ps > 0 && sd > 0 ? bankersRound(ps / sd, 0) : ''
    }
    case 'wet_density': {
      // 湿料质量(g) / 试坑体积(修约个位,cm³) → 修约到0.01(g/cm³)
      const ps = toNum('sand_before') - toNum('sand_after') - toNum('sand_surface')
      const sd = toNum('sand_density')
      const vol = sd > 0 ? bankersRound(ps / sd, 0) : 0  // ② 坑体积修约到个位
      const wm = toNum('wet_mass')
      return vol > 0 && wm > 0 ? bankersRound(wm / vol, 2) : ''  // ③ 湿密度修约到0.01
    }
    case 'water_content': {
      const bw = toNum('box_wet'); const bd = toNum('box_dry'); const bm = toNum('box_mass')
      const d = bd - bm
      return d > 0 ? bankersRound((bw - bd) / d * 100, 1) : ''  // ⑤ 含水率修约到0.1
    }
    case 'dry_density': {
      // 使用修约后的中间值计算
      const wc = parseFloat(calcField(row, 'water_content')) || 0
      const wd = parseFloat(calcField(row, 'wet_density')) || 0
      return wd > 0 ? bankersRound(wd / (1 + wc / 100), 2) : ''
    }
    case 'compaction': {
      const dd = parseFloat(calcField(row, 'dry_density')) || 0
      const mdd = getMaxDryDensity(row)
      return dd > 0 && mdd > 0 ? bankersRound(dd / mdd * 100, 1) : ''
    }
    default: return ''
  }
}

function calcRow(_row) {}

// ===== 键盘导航 =====

function findInput(ri, ci) {
  if (!dataTable.value) return null
  return dataTable.value.querySelector(`input[data-row="${ri}"][data-col="${ci}"]`)
}

function focusInput(ri, ci) {
  const el = findInput(ri, ci)
  if (el) { el.focus(); el.select(); }
}

// Enter：同列下一输入行
function navEnter(ri, ci) {
  const indices = inputRowIndices.value
  const pos = indices.indexOf(ri)
  if (pos >= 0 && pos < indices.length - 1) {
    const nextRi = indices[pos + 1]
    const nextDef = inputRowDefs.value[nextRi]
    let nextCi = ci
    if (nextDef.span > 1) {
      nextCi = Math.min(ci, sampleGroups.value.length - 1)
    }
    focusInput(nextRi, nextCi)
  }
}

// Tab：同行下一列
function navTab(ri, ci, event) {
  const def = inputRowDefs.value[ri]
  const maxCol = def.span > 1
    ? sampleGroups.value.length - 1
    : currentPageRows.value.length - 1
  if (ci < maxCol) {
    event.preventDefault()
    focusInput(ri, ci + 1)
  }
}

// ===== 粘贴 Excel 数据 =====

function handlePaste(event) {
  const text = event.clipboardData?.getData('text/plain')
  if (!text) return

  const lines = text.trim().split(/\r?\n/)
  if (!lines.length) return

  const sep = lines[0].includes('\t') ? '\t' : ','

  const pasteData = lines.map(line => {
    const cells = []
    let inQuote = false, current = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === sep && !inQuote) { cells.push(current.trim()); current = ''; continue }
      current += ch
    }
    cells.push(current.trim())
    return cells
  })

  if (!pasteData.length || !pasteData[0]?.length) return
  event.preventDefault()

  const numSamples = currentPageRows.value.length
  const numInputs = inputRowIndices.value.length

  let data = pasteData

  // 去掉表头行（首列为空，或含"编号/样品/参数/序号"等）
  if (data.length > 1) {
    const first = data[0]
    const headerKeywords = /^(编号|样品|序号|参数|检测|No\.?|#)$/i
    if (first[0] === '' || headerKeywords.test(first[0]?.trim())) {
      data = data.slice(1)
    }
  }

  // 去掉首列标签（首列值与 inputRowDefs 标签匹配）
  if (data.length > 0 && data[0].length > 1) {
    const firstCol = data.map(r => String(r[0] || ''))
    const matchCount = firstCol.filter(v =>
      inputRowDefs.value.some(d => d.label === v)
    ).length
    if (matchCount >= 2 || (firstCol[0] === '' && matchCount >= 1)) {
      data = data.map(r => r.slice(1))
    }
  }

  if (!data.length || !data[0]?.length) return

  const dRows = data.length
  const dCols = data[0].length

  // 判断是否需要转置：目标方向是 行=参数 × 列=样品
  // 直接映射能放下 → 直接用；否则如果能转置放下 → 转置
  const directFits = dRows <= numInputs && dCols <= numSamples
  const transposedFits = dRows <= numSamples && dCols <= numInputs

  if (!directFits && transposedFits) {
    const transposed = []
    for (let c = 0; c < dCols; c++) {
      const row = []
      for (let r = 0; r < dRows; r++) row.push(data[r]?.[c] || '')
      transposed.push(row)
    }
    data = transposed
  }

  // 填入 test_values：每行对应一个输入参数，每列对应一个样品
  const maxR = Math.min(data.length, numInputs)
  const maxC = Math.min(data[0]?.length || 0, numSamples)

  for (let r = 0; r < maxR; r++) {
    const def = inputRowDefs.value[inputRowIndices.value[r]]
    const vals = data[r]
    if (def.span > 1) {
      // 合并行：每个值对应一组样品
      const groups = sampleGroups.value
      const maxG = Math.min(vals.length, groups.length)
      for (let g = 0; g < maxG; g++) {
        const val = vals[g]
        if (val !== undefined && val !== '') {
          for (const row of groups[g]) {
            if (!row.test_values) row.test_values = {}
            row.test_values[def.key] = val
          }
        }
      }
    } else {
      for (let c = 0; c < maxC; c++) {
        const val = vals[c]
        if (val !== undefined && val !== '') {
          currentPageRows.value[c]?.test_values && (currentPageRows.value[c].test_values[def.key] = val)
        }
      }
    }
  }

  ElMessage.success(`已粘贴 ${maxR}×${maxC} 数据`)
}

// ===== 初始化 =====

async function handleInit() {
  try {
    await ElMessageBox.confirm(
      '确认要初始化吗？将清除所有检测数据并重新生成抬头信息。',
      '初始化确认',
      { confirmButtonText: '确认初始化', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  // 清除所有检测数据
  for (const row of allRows.value) {
    if (row.test_values) row.test_values = {}
  }

  // 重置 extra
  extra.structure_layer = ''
  extra.design_req = ''
  extra.max_dry_densities = {}
  extra.conclusion = ''
  extra.remark_footer = ''
  extra.tester = ''
  extra.reviewer = ''
  extra.test_date = ''
  extra.sand_cylinder = '150mm'
  extra.drying_oven = []
  extra.test_basis = isPipeline.value
    ? ['JTG 3450-2019', 'GB 50268-2008']
    : ['CJJ 1-2008', 'JTG 3450-2019']
  extra.test_date_range = null

  // 重新生成抬头
  autoFillHeader()

  // 初始化材料密度槽位
  for (const mat of uniqueMaterials.value) {
    extra.max_dry_densities[mat] = ''
  }

  // 管道压实度：自动填充取样位置
  autoFillPosition()

  // 重置结论选择标记，允许自动判定
  userPickedConclusion = false

  ElMessage.success('已初始化，抬头信息已重新生成')
}

async function onGenFillAndSave() {
  // 倒推数据已填入所有行，立即保存
  try {
    await updateRecordRows(route.params.entrustNo, buildSavePayload())
    ElMessage.success('数据已自动保存')
  } catch (e) {
    ElMessage.warning('自动保存失败，请手动点击保存按钮')
  }
}

async function handleCopy() {
  const rows = currentPageRows.value
  if (rows.length === 0) return

  // 生成 TSV：第一行为表头（编号），后续每行为参数
  const lines = []

  // 表头
  const headers = ['检测参数']
  for (const row of rows) {
    headers.push(String(row.seq_no))
  }
  lines.push(headers.join('\t'))

  // 数据行
  for (const def of inputRowDefs.value) {
    const cells = [def.label]
    if (def.span > 1 && !def.calc) {
      // 合并行：每组输出一个值
      for (const group of sampleGroups.value) {
        cells.push(getGroupValue(def.key, group))
      }
    } else {
      for (const row of rows) {
        if (def.calc) {
          if (def.key === 'max_dry_density') {
            cells.push(formatMaxDryDensity(row))
          } else {
            cells.push(calcField(row, def.key))
          }
        } else {
          cells.push((row.test_values && row.test_values[def.key]) || '')
        }
      }
    }
    lines.push(cells.join('\t'))
  }

  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    ElMessage.success('表格已复制到剪贴板，可直接粘贴到 Excel')
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = lines.join('\n')
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('已复制')
  }
}

function buildSavePayload() {
  const totalPages = pages.value.length || 1
  const result = []
  for (const page of pages.value) {
    for (const row of page.rows) {
      result.push({
        ...row,
        page_no: page.no,
        total_pages: totalPages,
        template_type: recordData.pages[0]?.template_type || 'roadbed_sand',
        header_data: {
          entrust_no: header.entrust_no,
          project_name: header.project_name,
          client_unit: header.client_unit,
          supervision_unit: header.supervision_unit,
          entrust_type: recordData.entrust?.entrust_type,
          entrust_date: header.entrust_date
        },
        extra: {
          ...extra,
          test_date: extra.test_date_range && extra.test_date_range.length === 2
            ? extra.test_date_range.join('~') : (extra.test_date || '')
        }
      })
    }
  }
  return result
}

async function handleSave() {
  saving.value = true
  try {
    await updateRecordRows(route.params.entrustNo, buildSavePayload())
    ElMessage.success('保存成功')
  } finally { saving.value = false }
}

// ===== 自动保存 =====

let saveTimer = null
let savePending = false
let autoSaveReady = false  // 初始加载完成后才启用

async function autoSave() {
  if (!autoSaveReady || savePending) return
  savePending = true
  try {
    await updateRecordRows(route.params.entrustNo, buildSavePayload())
  } catch {
    // 自动保存失败时静默处理
  } finally {
    savePending = false
  }
}

function debouncedSave() {
  if (!autoSaveReady) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(autoSave, 1500)
}

// 监听检测数据变更，触发自动保存
watch(allRows, () => { debouncedSave() }, { deep: true })

// 监听其他信息变更，触发自动保存
watch(extra, () => { debouncedSave() }, { deep: true })

// 根据检测数据自动判定检测结论
let userPickedConclusion = false
watch(autoConclusion, (val) => {
  if (!val) return
  // 仅在用户未手动选择过结论，或结论为空时自动填入
  if (!userPickedConclusion) {
    extra.conclusion = val
  }
})

// 用户手动选择结论后标记，不再被自动判定覆盖
watch(() => extra.conclusion, (newVal) => {
  if (newVal && newVal !== autoConclusion.value) {
    userPickedConclusion = true
  }
})

async function handlePrintPdf() {
  printing.value = true
  printMode.value = 'normal'
  printDone.value = false
  printError.value = false
  printPercent.value = 0
  printStep.value = 0
  printTotal.value = 0
  printMessage.value = '正在保存数据...'
  printDialogVisible.value = true
  printEntrustNo = recordData.entrust?.entrust_no || ''

  try {
    // Step 1: 保存数据
    await updateRecordRows(route.params.entrustNo, buildSavePayload())
    printPercent.value = 10
    printMessage.value = '数据已保存，正在启动 PDF 生成...'
    await delay(300)

    // Step 2: 启动打印任务
    const res = await startPrint(route.params.entrustNo)
    printTaskId = res.data.taskId

    // Step 3: 轮询进度
    printPollTimer = setInterval(async () => {
      try {
        const statusRes = await getPrintStatus(route.params.entrustNo, printTaskId)
        const job = statusRes.data
        printStep.value = job.step
        printTotal.value = job.totalSteps
        printMessage.value = job.message

        if (job.totalSteps > 0) {
          printPercent.value = 10 + Math.round((job.step / job.totalSteps) * 85)
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
    printPercent.value = 100
    printMessage.value = '保存或启动失败: ' + (e.message || '未知错误')
    stopPoll()
  }
}

async function handlePrintBlank() {
  printing.value = true
  printMode.value = 'blank'
  printDone.value = false
  printError.value = false
  printPercent.value = 0
  printStep.value = 0
  printTotal.value = 0
  printMessage.value = '正在启动空白记录单生成...'
  printDialogVisible.value = true
  printEntrustNo = recordData.entrust?.entrust_no || ''

  try {
    // 启动空白打印任务
    const res = await startPrintBlank(route.params.entrustNo)
    printTaskId = res.data.taskId

    // 轮询进度
    printPollTimer = setInterval(async () => {
      try {
        const statusRes = await getPrintBlankStatus(route.params.entrustNo, printTaskId)
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
    printPercent.value = 100
    printMessage.value = '启动失败: ' + (e.message || '未知错误')
    stopPoll()
  }
}

async function handleDownloadPdf() {
  if (!printTaskId) return
  try {
    const downloadFn = printMode.value === 'blank' ? downloadPrintBlankPdf : downloadPrintPdf
    const blob = await downloadFn(route.params.entrustNo, printTaskId)
    const url = window.URL.createObjectURL(
      new Blob([blob], { type: 'application/pdf' })
    )
    window.open(url, '_blank')
    setTimeout(() => window.URL.revokeObjectURL(url), 2000)
  } catch {
    ElMessage.error('下载失败')
  }
  printDialogVisible.value = false
  printing.value = false
  printTaskId = null
}

function cancelPrint() {
  stopPoll()
  printDialogVisible.value = false
  printing.value = false
  printTaskId = null
  ElMessage.info('已取消 PDF 生成')
}

function stopPoll() {
  if (printPollTimer) {
    clearInterval(printPollTimer)
    printPollTimer = null
  }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

onBeforeUnmount(() => {
  stopPoll()
})
</script>

<style scoped>
.record-page { padding: 0; }

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: #fff;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
}

.toolbar-title h3 { margin: 0; display: flex; align-items: center; }
.toolbar-btns { display: flex; gap: 8px; }

.section-card { margin-bottom: var(--spacing-md); }
.card-title { font-weight: 600; font-size: 14px; }

/* 抬头信息 — 表格网格 */
.header-table {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
}
.ht-row {
  display: grid;
  border-bottom: 1px solid var(--color-border-light, #ebeef5);
}
.ht-row:last-child { border-bottom: none; }
.ht-row.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.ht-row.cols-2 { grid-template-columns: 1fr 1fr; }
.ht-row.cols-1 { grid-template-columns: 1fr; }
.ht-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-right: 1px solid var(--color-border-light, #ebeef5);
  min-height: 36px;
  font-size: 14px;
}
.ht-cell:last-child { border-right: none; }
.ht-lbl {
  color: var(--color-text-secondary, #909399);
  white-space: nowrap;
  font-weight: 500;
  min-width: fit-content;
}
.ht-lbl::after { content: '：'; }
.ht-val {
  color: var(--color-text-primary);
  font-weight: 500;
  word-break: break-all;
}

/* 页签 */
.page-tabs { display: flex; align-items: center; gap: 12px; }
.page-tabs-label { font-size: 13px; color: var(--color-text-secondary); }

/* 数据表 */
.table-wrapper { overflow-x: auto; }
.data-table {
  border-collapse: collapse;
  font-size: 12px;
}

.data-table th,
.data-table td {
  border: 1px solid var(--color-border);
  padding: 4px 6px;
  text-align: center;
  white-space: nowrap;
}

.data-table th {
  background: #f8f9fb;
  font-weight: 600;
  color: var(--color-text-primary);
}

.param-col { width: 200px; text-align: left !important; }

.param-label {
  text-align: left !important;
  font-weight: 500;
  background: #f8f9fb;
  min-width: 200px;
  color: var(--color-text-regular);
}

/* 计算行 */
.calc-row td { background: #f0f9eb; }

/* 压实度结果行 */
.result-row td { background: #fef0f0; }

.result-val { font-weight: 700; color: var(--color-danger); font-size: 13px; }

/* 输入框 */
.ci {
  width: 100%;
  min-width: 70px;
  border: 1px solid var(--color-border);
  outline: none;
  text-align: center;
  font-size: 12px;
  padding: 4px 6px;
  box-sizing: border-box;
  border-radius: 3px;
  transition: border-color 0.15s, background 0.15s;
}

.ci:focus {
  border-color: var(--color-primary);
  background: #fffde7;
  box-shadow: 0 0 0 2px rgba(26, 95, 180, 0.1);
}

/* 合并单元格 */
.merged-cell { padding: 4px 6px; }
.merged-cell .ci { min-width: 220px; }

.static-text { color: var(--color-text-secondary); font-size: 12px; }

/* 检测设备行 */
.equipment-line {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.inline-checkbox-group {
  display: inline-flex;
  gap: 4px;
}

.inline-checkbox-group :deep(.el-checkbox) {
  margin-right: 0;
}

/* 检测依据 */
.basis-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 桩号角标面板 */
.corner-char-palette {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.palette-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-right: 2px;
}

.palette-divider {
  color: var(--color-border);
  margin: 0 4px;
  font-size: 11px;
}

.char-btn {
  width: 26px;
  height: 26px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.15s;
}

.char-btn:hover {
  border-color: var(--color-primary);
  background: #e8f0fe;
  color: var(--color-primary);
}
</style>
