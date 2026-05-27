<template>
  <el-dialog v-model="visible" title="倒推生成检测数据" :width="dialogWidth + 'px'"
    :close-on-click-modal="false" draggable :destroy-on-close="false"
    :modal="true" class="gen-dialog"
    :style="{ '--dh': dialogHeight + 'px' }">
    <el-container :style="{ height: dialogHeight + 'px', minHeight: '420px' }">
      <!-- 左栏：仪器库 -->
      <el-aside :width="leftCollapsed ? '32px' : '260px'" class="left-panel" :class="{ collapsed: leftCollapsed }">
        <div class="left-toggle" @click="leftCollapsed = !leftCollapsed">
          <el-icon :size="14">
            <DArrowRight v-if="leftCollapsed" />
            <DArrowLeft v-else />
          </el-icon>
        </div>
        <template v-if="!leftCollapsed">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <strong>仪器库 — 白搪瓷盒</strong>
            <el-button size="small" @click="addInstrument">添加</el-button>
          </div>
          <el-table :data="instruments" border size="small" :max-height="dialogHeight - 200">
          <el-table-column prop="code" label="编号" width="55" />
          <el-table-column label="质量(g)" width="90">
            <template #default="{ row }">
              <el-input v-if="row._editing" v-model="row._mass" size="small" style="width:70px"
                @blur="saveInstrument(row)" @keydown.enter="saveInstrument(row)" />
              <span v-else>{{ row.mass }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70">
            <template #default="{ row, $index }">
              <el-button link type="primary" size="small" @click="editInstrument(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="delInstrument(row, $index)">删</el-button>
            </template>
          </el-table-column>
        </el-table>
        </template>
      </el-aside>

      <!-- 右栏：生成参数 + 结果 -->
      <el-main style="padding:0;overflow-y:auto">
        <el-card shadow="never" class="param-card">
          <template #header><span class="card-title">随机参数范围</span></template>
          <!-- 通用参数 -->
          <div class="global-params">
            <div class="param-item">
              <label>湿料质量(g)</label>
              <div class="range-row">
                <el-input-number v-model="range.wetMassMin" :min="1000" :max="15000" size="small" controls-position="right" />
                <span>~</span>
                <el-input-number v-model="range.wetMassMax" :min="1000" :max="15000" size="small" controls-position="right" />
              </div>
            </div>
            <div class="param-item">
              <label>过程损失质量(g)</label>
              <div class="range-row">
                <el-input-number v-model="range.lossMin" :min="0" :max="100" size="small" controls-position="right" />
                <span>~</span>
                <el-input-number v-model="range.lossMax" :min="0" :max="100" size="small" controls-position="right" />
              </div>
            </div>
            <div class="param-item">
              <label>灌砂前砂+容器质量(g)</label>
              <el-input-number v-model="fixed.sandBefore" :min="0" :max="20000" size="small" controls-position="right" />
            </div>
            <div class="param-item">
              <label>量砂堆积密度(g/cm³)</label>
              <el-input-number v-model="fixed.sandDensity" :min="0.1" :max="3" :precision="2" :step="0.01" size="small" controls-position="right" />
            </div>
          </div>

          <!-- 智能匹配区间（可编辑） -->
          <div class="match-section" v-if="matchRules.length > 0">
            <span class="match-label">智能匹配区间（可修改）</span>
            <table class="match-table">
              <thead>
                <tr>
                  <th>部位</th>
                  <th>材料</th>
                  <th>设计要求</th>
                  <th>压实度区间</th>
                  <th>含水率区间</th>
                  <th>锥体砂质量</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in matchRules" :key="i">
                  <td>{{ r.position }}</td>
                  <td>{{ r.material }}</td>
                  <td>{{ r.designLabel }}</td>
                  <td class="editable-cell">
                    <el-input-number v-model="r.compMin" :min="50" :max="100" :precision="1" size="small" controls-position="right" style="width:82px" />
                    <span>~</span>
                    <el-input-number v-model="r.compMax" :min="50" :max="100" :precision="1" size="small" controls-position="right" style="width:82px" />
                  </td>
                  <td class="editable-cell">
                    <el-input-number v-model="r.waterMin" :min="0" :max="50" :precision="1" size="small" controls-position="right" style="width:82px" />
                    <span>~</span>
                    <el-input-number v-model="r.waterMax" :min="0" :max="50" :precision="1" size="small" controls-position="right" style="width:82px" />
                  </td>
                  <td class="editable-cell">
                    <el-input-number v-model="r.sandMin" :min="100" :max="1500" size="small" controls-position="right" style="width:82px" />
                    <span>~</span>
                    <el-input-number v-model="r.sandMax" :min="100" :max="1500" size="small" controls-position="right" style="width:82px" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-top:12px;display:flex;gap:8px">
            <el-button type="warning" size="small" @click="doRandomize">随机生成</el-button>
            <el-button size="small" @click="doRandomBoxes">随机盒号</el-button>
          </div>
        </el-card>

        <!-- 图例 -->
        <div class="legend-bar">
          <span><span class="legend-box" style="background:#fef0c7"></span> 随机值</span>
          <span><span class="legend-box" style="background:#f2f3f5"></span> 固定值</span>
          <span><span class="legend-box" style="background:#e0f2fe"></span> 倒推值</span>
        </div>

        <!-- 生成结果表格 -->
        <el-card v-if="genData.length > 0" shadow="never" class="result-card">
          <template #header>
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span class="card-title">生成数据预览（全部 {{ genData.length }} 个样品）</span>
              <el-button type="primary" size="small" @click="doFill">一键填入全部检测数据</el-button>
            </div>
          </template>
          <div class="gen-table-wrapper">
            <table class="gen-table">
              <thead>
                <tr>
                  <th class="label-col">参数</th>
                  <th v-for="(row, i) in genData" :key="i">{{ i + 1 }}</th>
                </tr>
              </thead>
              <tbody>
                <tr class="design-row">
                  <td class="label-col">材料 / 设计要求</td>
                  <td v-for="(row, ci) in genData" :key="'d'+ci">{{ row._designLabel }}</td>
                </tr>
                <tr v-for="def in genRowDefs" :key="def.key">
                  <td class="label-col">{{ def.label }}</td>
                  <td v-for="(row, ci) in genData" :key="ci"
                    :style="{ backgroundColor: cellColors[def.key] || 'transparent' }">
                    <input v-if="def.editable && def.key !== 'box_no'"
                      v-model="row[def.key]"
                      class="gen-input"
                      @input="onCellEdit(row, def.key)" />
                    <select v-else-if="def.key === 'box_no'"
                      v-model="row.box_no"
                      class="gen-select"
                      @change="onBoxNoChange(row)">
                      <option v-for="box in instrumentOptions" :key="box.code" :value="box.code">{{ box.code }}</option>
                    </select>
                    <span v-else :class="{ 'calc-val': def.key === 'compaction' }">{{ row[def.key] }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>

        <!-- 倒推公式说明 -->
        <el-card shadow="never" class="formula-card" v-if="genData.length > 0">
          <template #header><span class="card-title">倒推计算公式</span></template>
          <div class="formula-content">
            <div><b>1. 干密度</b> = 压实度 / 100 × 最大干密度</div>
            <div><b>2. 湿密度</b> = 干密度 × (1 + 含水率 / 100)</div>
            <div><b>3. 试坑体积</b> = 湿料质量 / 湿密度</div>
            <div><b>4. 试坑灌砂量</b> = 试坑体积 × 量砂堆积密度</div>
            <div><b>5. 灌砂后质量</b> = 灌砂前质量 − 试坑灌砂量 − 锥体砂质量</div>
            <div><b>6. 盒+湿料质量</b> = 盒质量 + 湿料质量 − 过程损失质量</div>
            <div>
              <b>7. 盒+干料质量</b> = (盒+湿料 + w × 盒质量) / (w + 1)<br>
              <span style="margin-left:16px;color:#909399">其中 w = 含水率 / 100，推导自：含水率 = (盒+湿料 − 盒+干料) / (盒+干料 − 盒质量) × 100</span>
            </div>
          </div>
        </el-card>
      </el-main>
    </el-container>
    <!-- 右下角缩放拖柄 -->
    <div class="resize-grip" @mousedown="onResizeStart">
      <svg width="12" height="12" viewBox="0 0 12 12"><path d="M0 12 L12 12 L12 0" fill="none" stroke="#999" stroke-width="1.5"/></svg>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getInstruments, createInstrument, updateInstrument, deleteInstrument } from '../../api/instrument'
import { bankersRound } from '../../utils/rounding'

// 模块级持久状态（跨页面导航不丢失）
const savedRange = reactive({
  compactionMin: 91.0, compactionMax: 95.5,
  waterMin: 5.0, waterMax: 15.0,
  wetMassMin: 2100, wetMassMax: 2670,
  surfaceMin: 739, surfaceMax: 778,
  lossMin: 5, lossMax: 30
})
const savedFixed = reactive({
  sandBefore: 8168,
  sandDensity: 1.41
})
const savedGenData = ref([])

const props = defineProps({
  modelValue: Boolean,
  currentPageRows: Array,
  allRows: Array,
  extra: Object,
  isPipeline: Boolean,
  entrustItems: Array
})
const emit = defineEmits(['update:modelValue', 'fill', 'fillAndSave'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

// 左栏收起
const leftCollapsed = ref(true)

// 弹窗尺寸（可拖拽调整）
const dialogWidth = ref(Math.max(window.innerWidth * 0.95, 1000))
const dialogHeight = ref(Math.max(window.innerHeight * 0.85, 500))
let resizeStart = null

function onResizeStart(e) {
  e.preventDefault()
  resizeStart = { x: e.clientX, y: e.clientY, w: dialogWidth.value, h: dialogHeight.value }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e) {
  if (!resizeStart) return
  const dx = e.clientX - resizeStart.x
  const dy = e.clientY - resizeStart.y
  dialogWidth.value = Math.max(800, Math.min(window.innerWidth - 40, resizeStart.w + dx))
  dialogHeight.value = Math.max(420, Math.min(window.innerHeight - 80, resizeStart.h + dy))
}

function onResizeEnd() {
  resizeStart = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

// ===== 仪器库 =====
const instruments = ref([])
const instrumentOptions = computed(() =>
  instruments.value.filter(i => !i._isNew).map(i => ({ code: i.code, mass: i.mass }))
)

async function loadInstruments() {
  try {
    const res = await getInstruments('白搪瓷盒')
    instruments.value = (res.data || []).map(i => ({ ...i, _editing: false, _mass: i.mass }))
  } catch {}
}

function editInstrument(row) {
  row._editing = true
  row._mass = row.mass
}

async function saveInstrument(row) {
  row._editing = false
  const newMass = parseFloat(row._mass)
  if (isNaN(newMass)) { row._mass = row.mass; return }
  try {
    if (row._isNew) {
      const res = await createInstrument({ category: '白搪瓷盒', code: row.code, mass: newMass })
      row.id = res.data.id
      row._isNew = false
    } else if (newMass !== row.mass) {
      await updateInstrument(row.id, { category: '白搪瓷盒', code: row.code, mass: newMass })
    }
    row.mass = newMass
  } catch { row._mass = row.mass }
}

async function delInstrument(row, idx) {
  try {
    await ElMessageBox.confirm(`确认删除白搪瓷盒 ${row.code}？`, '删除确认', { type: 'warning' })
  } catch { return }
  if (row.id) await deleteInstrument(row.id)
  instruments.value.splice(idx, 1)
}

function addInstrument() {
  const maxCode = instruments.value.reduce((m, i) => Math.max(m, parseInt(i.code) || 0), 0)
  instruments.value.push({
    id: null, category: '白搪瓷盒', code: String(maxCode + 1), mass: 380,
    _editing: true, _mass: 380, _isNew: true
  })
}

// 打开时加载仪器库，调整尺寸，保留已生成的 genData
watch(visible, async (v) => {
  if (v) {
    dialogWidth.value = Math.max(window.innerWidth * 0.95, 1000)
    dialogHeight.value = Math.max(window.innerHeight * 0.85, 500)
    // 刷新智能匹配规则（切换委托时更新）并重建 genData
    const newRules = buildMatchRules()
    matchRules.splice(0, matchRules.length, ...newRules)
    await loadInstruments()
    initGenData()
  }
})

// ===== 参数范围（使用模块级持久状态）=====
const range = savedRange
const fixed = savedFixed

// 从委托明细项提取智能匹配规则（可编辑）
function buildMatchRules() {
  const items = props.entrustItems || []
  const seen = new Set()
  const rules = []
  for (const item of items) {
    const key = `${item.position_name}|${item.material}|${item.design_operator}|${item.design_requirement}|${item.design_tolerance}`
    if (seen.has(key)) continue
    seen.add(key)
    const cr = getCompactionRange(item)
    const wr = getWaterRange(item)
    const ss = getSandSurfaceRange(item)
    rules.push({
      _key: key,
      position: item.position_name || '',
      material: item.material || '',
      designLabel: (() => {
        const op = item.design_operator || '≥'
        const req = item.design_requirement != null ? item.design_requirement : ''
        const tol = item.design_tolerance
        if (op === '±' && tol != null) return `${req}%±${tol}%`
        return `${op}${req}%`
      })(),
      compMin: cr.min, compMax: cr.max,
      waterMin: wr.min, waterMax: wr.max,
      sandIsFixed: typeof ss === 'number',
      sandMin: typeof ss === 'number' ? ss : (ss ? ss.min : range.surfaceMin),
      sandMax: typeof ss === 'number' ? ss : (ss ? ss.max : range.surfaceMax)
    })
  }
  return rules
}

const matchRules = reactive(buildMatchRules())

// 根据样品索引查找对应的匹配规则
function getRuleForIndex(idx) {
  const item = getEntrustItemForIndex(idx)
  if (!item) return null
  const key = `${item.position_name}|${item.material}|${item.design_operator}|${item.design_requirement}|${item.design_tolerance}`
  return matchRules.find(r => r._key === key) || null
}

const cellColors = {
  compaction:    '#fef0c7', water_content: '#fef0c7', wet_mass: '#fef0c7',
  sand_surface:  '#fef0c7', loss_mass:     '#fef0c7',
  sand_before:   '#f2f3f5', sand_density:  '#f2f3f5', max_dry_density: '#f2f3f5',
  box_no:        '#f2f3f5', box_mass:      '#f2f3f5',
  sand_after:    '#e0f2fe', pit_sand:      '#e0f2fe', pit_volume: '#e0f2fe',
  wet_density:   '#e0f2fe', box_wet:       '#e0f2fe', box_dry: '#e0f2fe', dry_density: '#e0f2fe',
}

const genRowDefs = [
  { key: 'compaction',    label: '压实度(%)',              editable: true },
  { key: 'water_content', label: '含水率(%)',              editable: true },
  { key: 'wet_mass',      label: '试坑湿料质量(g)',        editable: true },
  { key: 'sand_surface',  label: '锥体砂质量(g)',          editable: true },
  { key: 'loss_mass',     label: '过程损失质量(g)',        editable: true },
  { key: 'sand_before',   label: '灌砂前砂+容器质量(g)',   editable: true },
  { key: 'sand_density',    label: '量砂堆积密度(g/cm³)',    editable: true },
  { key: 'max_dry_density', label: '最大干密度(g/cm³)',      editable: false },
  { key: 'box_no',          label: '盒号',                   editable: true },
  { key: 'box_mass',      label: '盒质量(g)',              editable: false },
  { key: 'sand_after',    label: '灌砂后砂+容器质量(g)',   editable: false },
  { key: 'pit_sand',      label: '试坑灌入量砂质量(g)',    editable: false },
  { key: 'pit_volume',    label: '试坑体积(cm³)',          editable: false },
  { key: 'wet_density',   label: '试样湿密度(g/cm³)',      editable: false },
  { key: 'box_wet',       label: '盒+湿料质量(g)',         editable: false },
  { key: 'box_dry',       label: '盒+干料质量(g)',         editable: false },
  { key: 'dry_density',   label: '干密度(g/cm³)',          editable: false },
]

// genData 使用模块级持久状态
const genData = savedGenData

function initGenData() {
  const rows = props.allRows || props.currentPageRows || []
  const count = rows.length
  genData.value = []
  if (!count) return

  const boxes = instrumentOptions.value
  if (boxes.length === 0) {
    ElMessage.warning('仪器库中没有白搪瓷盒，请先添加')
    return
  }

  for (let i = 0; i < count; i++) {
    const box = boxes[i % boxes.length]
    const row = rows[i]
    const maxDd = getRowMaxDryDensity(row)
    const item = getEntrustItemForIndex(i)
    genData.value.push({
      compaction: '', water_content: '', wet_mass: '', sand_surface: '', loss_mass: '',
      sand_before: fixed.sandBefore, sand_density: fixed.sandDensity,
      max_dry_density: maxDd > 0 ? bankersRound(maxDd, 2) : '',
      box_no: box.code, box_mass: box.mass,
      sand_after: '', pit_sand: '', pit_volume: '', wet_density: '',
      box_wet: '', box_dry: '', dry_density: '',
      _maxDryDensity: maxDd, _designLabel: formatDesignLabel(item)
    })
  }
}

function getRowMaxDryDensity(row) {
  if (!props.extra || !row) return 2.0
  const mat = row.material || ''
  if (mat && props.extra.max_dry_densities && props.extra.max_dry_densities[mat]) {
    return parseFloat(props.extra.max_dry_densities[mat]) || 2.0
  }
  const vals = Object.values(props.extra.max_dry_densities || {}).filter(Boolean)
  return vals.length > 0 ? parseFloat(vals[0]) || 2.0 : 2.0
}

function rand(min, max, decimals) {
  const v = Math.random() * (max - min) + min
  return decimals != null ? parseFloat(v.toFixed(decimals)) : Math.round(v)
}

// 根据样品索引匹配委托明细项（按 group_count * 3 顺序映射）
function getEntrustItemForIndex(idx) {
  const items = props.entrustItems || []
  if (!items.length) return null
  let offset = 0
  for (const item of items) {
    const count = (item.group_count || 1) * 3
    if (idx < offset + count) return item
    offset += count
  }
  return items[items.length - 1]
}

// 根据设计要求计算压实度生成区间
function getCompactionRange(item) {
  if (!item) return { min: range.compactionMin, max: range.compactionMax }
  const op = item.design_operator || '≥'
  const req = parseFloat(item.design_requirement)
  const tol = parseFloat(item.design_tolerance)
  if (isNaN(req)) return { min: range.compactionMin, max: range.compactionMax }

  if (op === '±' && !isNaN(tol) && tol > 0) {
    return { min: req - tol + 0.5, max: req + tol - 0.5 }
  }
  // ≥ 或默认
  if (req >= 95) return { min: 96, max: 97.7 }
  if (req >= 90) return { min: 91, max: 95.5 }
  return { min: req + 1, max: Math.min(req + 5.5, 100) }
}

// 根据材料计算含水率生成区间
function getWaterRange(item) {
  if (!item || !item.material) return { min: range.waterMin, max: range.waterMax }
  const mat = item.material
  if (mat.includes('碎石')) return { min: 2, max: 5 }
  if (mat.includes('石屑')) return { min: 4, max: 9 }
  if (mat.includes('砂')) return { min: 6, max: 10 }
  return { min: range.waterMin, max: range.waterMax }
}

// 根据材料获取锥体砂质量：固定值返回数字，范围返回 {min,max}，否则 null
function getSandSurfaceRange(item) {
  if (!item || !item.material) return null
  const mat = item.material
  if (mat.includes('砂') || mat.includes('石屑')) return 735
  if (mat.includes('碎石')) return { min: 742, max: 780 }
  return null
}

// 格式化设计要求标签
function formatDesignLabel(item) {
  if (!item) return ''
  const mat = item.material || ''
  const op = item.design_operator || '≥'
  const req = item.design_requirement != null ? item.design_requirement : ''
  const tol = item.design_tolerance
  if (op === '±' && tol != null) return `${mat} ${req}%±${tol}%`
  return `${mat} ${op}${req}%`
}

function doRandomize() {
  if (genData.value.length === 0) return
  for (let i = 0; i < genData.value.length; i++) {
    const row = genData.value[i]
    const rule = getRuleForIndex(i)

    if (rule) {
      row.compaction = rand(rule.compMin, rule.compMax, 1)
      row.water_content = rand(rule.waterMin, rule.waterMax, 1)
      row.sand_surface = rand(rule.sandMin, rule.sandMax, 0)
    } else {
      // 回退到全局范围
      row.compaction = rand(range.compactionMin, range.compactionMax, 1)
      row.water_content = rand(range.waterMin, range.waterMax, 1)
      row.sand_surface = rand(range.surfaceMin, range.surfaceMax, 0)
    }

    row.wet_mass = rand(range.wetMassMin, range.wetMassMax, 0)
    row.loss_mass = rand(range.lossMin, range.lossMax, 0)
    row.sand_before = fixed.sandBefore
    row.sand_density = fixed.sandDensity
    recalc(row)
  }
}

// 随机盒号：不重复抽取，直到耗尽后再循环
function doRandomBoxes() {
  if (genData.value.length === 0) return
  const boxes = instrumentOptions.value
  if (boxes.length === 0) { ElMessage.warning('仪器库为空'); return }

  // 不重复洗牌
  const shuffled = [...boxes].sort(() => Math.random() - 0.5)
  for (let i = 0; i < genData.value.length; i++) {
    const box = shuffled[i % shuffled.length]
    genData.value[i].box_no = box.code
    genData.value[i].box_mass = box.mass
    recalc(genData.value[i])
  }
  ElMessage.success('已随机分配盒号')
}

function recalc(row) {
  const compaction = parseFloat(row.compaction) || 0
  const waterContent = parseFloat(row.water_content) || 0
  const wetMass = parseInt(row.wet_mass) || 0
  const sandSurface = parseInt(row.sand_surface) || 0
  const sandBefore = parseInt(row.sand_before) || 0
  const sandDensity = parseFloat(row.sand_density) || 0
  const boxMass = parseFloat(row.box_mass) || 0
  const lossMass = parseInt(row.loss_mass) || 0
  const maxDd = row._maxDryDensity || 2.0

  const dryDensity = compaction > 0 && maxDd > 0 ? compaction / 100 * maxDd : 0
  const wetDensity = dryDensity > 0 ? dryDensity * (1 + waterContent / 100) : 0
  const pitVolume = wetDensity > 0 && wetMass > 0 ? wetMass / wetDensity : 0
  const pitSand = pitVolume > 0 && sandDensity > 0 ? pitVolume * sandDensity : 0
  const sandAfter = sandBefore > 0 && pitSand > 0 ? sandBefore - pitSand - sandSurface : 0
  const boxWet = boxMass > 0 && wetMass > 0 ? boxMass + wetMass - lossMass : 0
  const w = waterContent / 100
  const boxDry = (boxWet > 0 && boxMass > 0) ? (boxWet + w * boxMass) / (w + 1) : 0

  row.dry_density = dryDensity > 0 ? bankersRound(dryDensity, 2) : ''
  row.wet_density = wetDensity > 0 ? bankersRound(wetDensity, 2) : ''
  row.pit_volume = pitVolume > 0 ? bankersRound(pitVolume, 0) : ''
  row.pit_sand = pitSand > 0 ? bankersRound(pitSand, 0) : ''
  row.sand_after = sandAfter >= 0 ? bankersRound(sandAfter, 0) : ''
  row.box_wet = boxWet > 0 ? bankersRound(boxWet, 0) : ''
  row.box_dry = boxDry > 0 ? bankersRound(boxDry, 0) : ''
}

function onCellEdit(row, key) {
  if (['compaction', 'water_content', 'wet_mass', 'sand_surface', 'loss_mass', 'sand_before', 'sand_density'].includes(key)) {
    recalc(row)
  }
}

function onBoxNoChange(row) {
  const box = instruments.value.find(i => String(i.code) === String(row.box_no))
  if (box) { row.box_mass = box.mass; recalc(row) }
}

function doFill() {
  const rows = props.allRows || props.currentPageRows || []
  const mapping = {
    compaction: 'compaction', water_content: 'water_content', wet_mass: 'wet_mass',
    sand_surface: 'sand_surface', sand_before: 'sand_before', sand_after: 'sand_after',
    sand_density: 'sand_density', box_no: 'box_no', box_mass: 'box_mass',
    box_wet: 'box_wet', box_dry: 'box_dry',
  }

  let filled = 0
  for (let i = 0; i < Math.min(genData.value.length, rows.length); i++) {
    const src = genData.value[i]
    const target = rows[i]
    if (!target.test_values) target.test_values = {}
    for (const [srcKey, destKey] of Object.entries(mapping)) {
      const val = src[srcKey]
      if (val !== '' && val != null) {
        target.test_values[destKey] = String(val)
        filled++
      }
    }
  }

  ElMessage.success(`已填入全部 ${rows.length} 个样品共 ${filled} 个值，正在自动保存...`)
  emit('fillAndSave')
  visible.value = false
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
})
</script>

<style scoped>
/* 弹窗 */
.gen-dialog :deep(.el-dialog) { max-width: 98vw; }
.gen-dialog :deep(.el-dialog__body) { overflow: hidden; }

/* 缩放拖柄 */
.resize-grip {
  position: absolute; bottom: 0; right: 0;
  width: 20px; height: 20px;
  cursor: nwse-resize;
  display: flex; align-items: flex-end; justify-content: flex-end;
  padding: 2px;
  z-index: 10;
}
.resize-grip:hover svg path { stroke: #409eff; }

/* 左栏收起 */
.left-panel {
  border-right: 1px solid #eee;
  padding-right: 8px;
  overflow-y: auto;
  transition: width 0.25s;
  position: relative;
}
.left-panel.collapsed {
  padding-right: 0;
  overflow: hidden;
}
.left-toggle {
  position: absolute; top: 50%; right: -4px; transform: translateY(-50%);
  width: 20px; height: 40px;
  background: #f5f7fa; border: 1px solid #dcdfe6; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 5;
}
.left-toggle:hover { background: #e6e8eb; }

/* 卡片统一 */
.card-title { font-size: 14px; font-weight: 600; }

/* 参数卡片 */
.param-card { margin-bottom: 12px; }

/* 通用参数 */
.global-params { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 12px; margin-bottom: 12px; }
.param-item { }
.param-item label { display: block; font-size: 13px; color: #606266; margin-bottom: 4px; }
.param-item .range-row { display: flex; gap: 4px; align-items: center; }
.param-item .range-row > span { color: #909399; font-size: 13px; }

/* 智能匹配规则表 */
.match-section { margin-top: 8px; padding-top: 12px; border-top: 1px dashed #dcdfe6; }
.match-label { font-size: 13px; color: #409eff; font-weight: 500; margin-bottom: 8px; display: block; }
.match-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
.match-table th { background: #ecf5ff; padding: 5px 6px; border: 1px solid #dcdfe6; font-weight: 600; color: #303133; white-space: nowrap; }
.match-table td { padding: 3px 6px; border: 1px solid #dcdfe6; text-align: center; color: #606266; }
.editable-cell { white-space: nowrap; }
.editable-cell > span { color: #909399; font-size: 12px; margin: 0 2px; }

/* 图例 */
.legend-bar { display: flex; gap: 16px; margin-bottom: 8px; font-size: 12px; padding: 0 4px; color: #606266; }
.legend-box { display: inline-block; width: 14px; height: 14px; border: 1px solid #dcdfe6; border-radius: 2px; vertical-align: middle; margin-right: 2px; }

/* 结果卡片 */
.result-card { margin-bottom: 12px; }

/* 数据表 */
.gen-table-wrapper { overflow-x: auto; }
.gen-table { border-collapse: collapse; font-size: 12px; width: 100%; }
.gen-table th, .gen-table td { border: 1px solid #dcdfe6; padding: 3px 5px; text-align: center; white-space: nowrap; min-width: 64px; }
.gen-table th { background: #f5f7fa; font-weight: 600; font-size: 12px; }
.label-col { width: 130px; text-align: left !important; font-weight: 500; background: #f5f7fa !important; font-size: 12px; }
.design-row td { font-size: 11px; background: #f0f4ff; font-weight: 500; color: #303133; }
.design-row td:nth-child(3n+4) { border-right: 3px solid #909399; }
.calc-val { font-weight: 700; color: #f56c6c; }

.gen-input {
  width: 100%; min-width: 50px; border: 1px solid transparent;
  outline: none; text-align: center; font-size: 12px; padding: 2px 4px;
  box-sizing: border-box; border-radius: 2px; background: transparent;
}
.gen-input:hover { border-color: #c0c4cc; }
.gen-input:focus { border-color: #409eff; background: #fff; }

.gen-select {
  width: 100%; min-width: 50px; border: 1px solid transparent;
  outline: none; text-align: center; font-size: 12px; padding: 2px;
  box-sizing: border-box; border-radius: 2px; background: transparent;
  appearance: none; cursor: pointer;
}
.gen-select:hover { border-color: #c0c4cc; }
.gen-select:focus { border-color: #409eff; background: #fff; }

/* 公式卡片 */
.formula-card { margin-top: 12px; }
.formula-content { font-size: 13px; color: #606266; line-height: 2.2; }
.formula-content b { color: #303133; }
</style>


