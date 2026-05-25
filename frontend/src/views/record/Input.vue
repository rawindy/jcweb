<template>
  <div class="record-page" v-loading="loading">
    <!-- 工具栏 -->
    <div class="toolbar">
      <h3>
        原始记录 - {{ recordData.entrust?.entrust_no }}
        <el-tag type="primary">{{ recordData.entrust?.entrust_type }}</el-tag>
      </h3>
      <div class="toolbar-btns">
        <el-button type="primary" @click="handleSave" :loading="saving">保存记录</el-button>
        <el-button type="success" @click="handlePrintPdf" :loading="printing">打印记录单(PDF)</el-button>
        <el-button @click="$router.back()">返回</el-button>
      </div>
    </div>

    <div v-if="recordData.pages && recordData.pages.length > 0">
      <!-- 页签 -->
      <el-card shadow="never" class="section-card">
        <el-radio-group v-model="activePage" size="small">
          <el-radio-button v-for="p in recordData.pages" :key="p.page_no" :value="p.page_no">
            第{{ p.page_no }}页 / 共{{ p.total_pages }}页
          </el-radio-button>
        </el-radio-group>
      </el-card>

      <div v-for="p in recordData.pages" :key="p.page_no" v-show="p.page_no === activePage">
        <!-- 抬头信息 -->
        <el-card shadow="never" class="section-card">
          <template #header><span class="card-title">记录单抬头</span></template>
          <el-row :gutter="20" class="info-line">
            <el-col :span="8">
              <span class="lbl">委托编号：</span><span class="val">{{ p.header_data.entrust_no }}</span>
            </el-col>
            <el-col :span="8">
              <span class="lbl">共 </span><b>{{ p.total_pages }}</b><span class="lbl"> 页 第 </span><b>{{ p.page_no }}</b><span class="lbl"> 页</span>
            </el-col>
            <el-col :span="8">
              <span class="lbl">记录单编号：</span><span class="val">JL/{{ p.header_data.entrust_no }}</span>
            </el-col>
          </el-row>
          <el-row :gutter="20" class="info-line">
            <el-col :span="12">
              <span class="lbl">工程名称：</span><span class="val">{{ p.header_data.project_name }}</span>
            </el-col>
            <el-col :span="12">
              <span class="lbl">委托单位：</span><span class="val">{{ p.header_data.client_unit }}</span>
            </el-col>
          </el-row>
          <el-row :gutter="20" class="info-line">
            <el-col :span="12">
              <span class="lbl">见证单位：</span><span class="val">{{ p.header_data.supervision_unit }}</span>
            </el-col>
            <el-col :span="12">
              <span class="lbl">结构层次：</span>
              <el-input v-model="p.extra.structure_layer" size="small" style="width:140px" />
            </el-col>
          </el-row>
          <el-row :gutter="20" class="info-line">
            <el-col :span="12">
              <span class="lbl">设计要求：</span>
              <el-input v-model="p.extra.design_req" size="small" style="width:140px" />
            </el-col>
            <el-col :span="12">
              <span class="lbl">最大干密度：</span>
              <el-input v-model="p.extra.max_dry_density" size="small" style="width:100px" /><span> g/cm³</span>
            </el-col>
          </el-row>
        </el-card>

        <!-- 转置检测数据表 -->
        <el-card shadow="never" class="section-card">
          <template #header><span class="card-title">检测数据</span></template>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="param-col">检测参数</th>
                  <th v-for="(row, idx) in visibleRows(p)" :key="idx" :class="{ empty: row._empty }">
                    {{ row._empty ? '' : row.sample_no }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <!-- 桩号 -->
                <tr>
                  <td class="param-label">桩号</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'a'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.stake_no" class="ci" />
                  </td>
                </tr>
                <!-- 取样位置距中(m) -->
                <tr>
                  <td class="param-label">取样位置距中(m)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'b'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.position" class="ci" />
                  </td>
                </tr>
                <!-- 灌砂前砂+容器质量(g) -->
                <tr>
                  <td class="param-label">灌砂前砂+容器质量(g)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'c'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.sand_before" class="ci" @input="calcRow(row)" />
                  </td>
                </tr>
                <!-- 灌砂后砂+容器质量(g) -->
                <tr>
                  <td class="param-label">灌砂后砂+容器质量(g)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'d'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.sand_after" class="ci" @input="calcRow(row)" />
                  </td>
                </tr>
                <!-- 基板和粗糙表面间砂质量(g) -->
                <tr>
                  <td class="param-label">基板和粗糙表面间砂质量(g)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'e'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.sand_surface" class="ci" @input="calcRow(row)" />
                  </td>
                </tr>
                <!-- 试坑灌入量砂质量(g) [计算] -->
                <tr class="calc-row">
                  <td class="param-label">试坑灌入量砂质量(g)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'f'+idx" :class="{ empty: row._empty }">
                    <span v-if="!row._empty">{{ calcField(row, 'pit_sand') }}</span>
                  </td>
                </tr>
                <!-- 量砂堆积密度(g/cm³) -->
                <tr>
                  <td class="param-label">量砂堆积密度(g/cm³)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'g'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.sand_density" class="ci" @input="calcRow(row)" />
                  </td>
                </tr>
                <!-- 试坑体积(cm³) [计算] -->
                <tr class="calc-row">
                  <td class="param-label">试坑体积(cm³)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'h'+idx" :class="{ empty: row._empty }">
                    <span v-if="!row._empty">{{ calcField(row, 'pit_volume') }}</span>
                  </td>
                </tr>
                <!-- 试坑中挖出的湿料质量(g) -->
                <tr>
                  <td class="param-label">试坑中挖出的湿料质量(g)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'i'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.wet_mass" class="ci" @input="calcRow(row)" />
                  </td>
                </tr>
                <!-- 试样湿密度(g/cm³) [计算] -->
                <tr class="calc-row">
                  <td class="param-label">试样湿密度(g/cm³)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'j'+idx" :class="{ empty: row._empty }">
                    <span v-if="!row._empty">{{ calcField(row, 'wet_density') }}</span>
                  </td>
                </tr>
                <!-- 盒号 -->
                <tr>
                  <td class="param-label">盒号</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'k'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.box_no" class="ci" />
                  </td>
                </tr>
                <!-- 盒质量(g) -->
                <tr>
                  <td class="param-label">盒质量(g)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'l'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.box_mass" class="ci" @input="calcRow(row)" />
                  </td>
                </tr>
                <!-- 盒+湿料质量(g) -->
                <tr>
                  <td class="param-label">盒+湿料质量(g)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'m'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.box_wet" class="ci" @input="calcRow(row)" />
                  </td>
                </tr>
                <!-- 盒+干料质量(g) -->
                <tr>
                  <td class="param-label">盒+干料质量(g)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'n'+idx" :class="{ empty: row._empty }">
                    <input v-if="!row._empty" v-model="row.test_values.box_dry" class="ci" @input="calcRow(row)" />
                  </td>
                </tr>
                <!-- 含水率(%) [计算] -->
                <tr class="calc-row">
                  <td class="param-label">含水率(%)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'o'+idx" :class="{ empty: row._empty }">
                    <span v-if="!row._empty">{{ calcField(row, 'water_content') }}</span>
                  </td>
                </tr>
                <!-- 干密度(g/cm³) [计算] -->
                <tr class="calc-row">
                  <td class="param-label">干密度(g/cm³)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'p'+idx" :class="{ empty: row._empty }">
                    <span v-if="!row._empty">{{ calcField(row, 'dry_density') }}</span>
                  </td>
                </tr>
                <!-- 最大干密度(g/cm³) -->
                <tr class="calc-row">
                  <td class="param-label">最大干密度(g/cm³)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'q'+idx" :class="{ empty: row._empty }">
                    <span v-if="!row._empty">{{ p.extra.max_dry_density || '' }}</span>
                  </td>
                </tr>
                <!-- 压实度(%) [计算] -->
                <tr class="calc-row">
                  <td class="param-label">压实度(%)</td>
                  <td v-for="(row, idx) in visibleRows(p)" :key="'r'+idx" :class="{ empty: row._empty }">
                    <span v-if="!row._empty">{{ calcField(row, 'compaction') }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>

        <!-- 底部 -->
        <el-card shadow="never" class="section-card">
          <template #header><span class="card-title">其他信息</span></template>
          <el-form label-width="80px" size="small">
            <el-form-item label="检测结论"><el-input v-model="p.extra.conclusion" /></el-form-item>
            <el-form-item label="检测设备"><span class="static-text">灌砂筒(    )（SB143） 电子秤（SB133）电热鼓风干燥箱（    ）电子秤（SB139）</span></el-form-item>
            <el-form-item label="检测依据"><span class="static-text">□《公路路基路面现场测试规程》JTG 3450-2019 □《土工试验方法标准》GB/T 50123-2019</span></el-form-item>
            <el-form-item label=" "><span class="static-text">□《城镇道路工程施工与质量验收规范》CJJ 1-2008 □《给水排水管工程施工及验收规范》GB 50268-2008</span></el-form-item>
            <el-form-item label="备注"><el-input v-model="p.extra.remark_footer" /></el-form-item>
            <el-row :gutter="16">
              <el-col :span="6"><el-form-item label="试验人"><el-input v-model="p.extra.tester" /></el-form-item></el-col>
              <el-col :span="6"><el-form-item label="复核人"><el-input v-model="p.extra.reviewer" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="试验日期"><el-date-picker v-model="p.extra.test_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" /></el-form-item></el-col>
            </el-row>
          </el-form>
        </el-card>
      </div>
    </div>

    <el-empty v-else-if="!loading" description="该委托单暂无检测明细数据" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getRecords, updateRecordRows } from '../../api/record'
import request from '../../api/index'

const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const printing = ref(false)
const activePage = ref(1)
const recordData = reactive({ entrust: null, pages: [] })

onMounted(async () => {
  loading.value = true
  try {
    const res = await getRecords(route.params.entrustId)
    Object.assign(recordData, res.data)
    if (recordData.pages.length > 0) {
      activePage.value = recordData.pages[0].page_no
      for (const p of recordData.pages) {
        if (!p.extra) {
          p.extra = {
            structure_layer: '', design_req: '', max_dry_density: '',
            conclusion: '', remark_footer: '', tester: '', reviewer: '', test_date: ''
          }
        }
      }
    }
  } finally {
    loading.value = false
  }
})

// 过滤掉末尾的空行（保留前面的空行以维持9行结构）
function visibleRows(page) {
  // 只显示非空行
  return page.rows
}

function calcField(row, field) {
  const v = row.test_values || {}
  const toNum = (key) => parseFloat(v[key]) || 0

  switch (field) {
    case 'pit_sand': {
      const val = toNum('sand_before') - toNum('sand_after') - toNum('sand_surface')
      return val > 0 ? val.toFixed(1) : ''
    }
    case 'pit_volume': {
      const ps = toNum('sand_before') - toNum('sand_after') - toNum('sand_surface')
      const sd = toNum('sand_density')
      return ps > 0 && sd > 0 ? (ps / sd).toFixed(1) : ''
    }
    case 'wet_density': {
      const ps = toNum('sand_before') - toNum('sand_after') - toNum('sand_surface')
      const vol = toNum('sand_density') > 0 ? ps / toNum('sand_density') : 0
      const wm = toNum('wet_mass')
      return vol > 0 && wm > 0 ? (wm / vol).toFixed(3) : ''
    }
    case 'water_content': {
      const bw = toNum('box_wet')
      const bd = toNum('box_dry')
      const bm = toNum('box_mass')
      const d = bd - bm
      return d > 0 ? ((bw - bd) / d * 100).toFixed(1) : ''
    }
    case 'dry_density': {
      const wc = parseFloat(calcField(row, 'water_content')) || 0
      const wd = parseFloat(calcField(row, 'wet_density')) || 0
      return wd > 0 ? (wd / (1 + wc / 100)).toFixed(3) : ''
    }
    case 'compaction': {
      const dd = parseFloat(calcField(row, 'dry_density')) || 0
      const page = recordData.pages.find(p => p.rows.includes(row))
      const mdd = parseFloat(page?.extra?.max_dry_density) || 0
      return dd > 0 && mdd > 0 ? (dd / mdd * 100).toFixed(1) : ''
    }
    default: return ''
  }
}

function calcRow(_row) {}

async function handleSave() {
  saving.value = true
  try {
    const allRows = []
    for (const page of recordData.pages) {
      for (const row of page.rows) {
        allRows.push({
          ...row,
          page_no: page.page_no, total_pages: page.total_pages,
          template_type: page.template_type,
          header_data: page.header_data, extra: page.extra
        })
      }
    }
    await updateRecordRows(route.params.entrustId, allRows)
    ElMessage.success('保存成功')
  } finally { saving.value = false }
}

async function handlePrintPdf() {
  printing.value = true
  try {
    const entrustId = route.params.entrustId
    const response = await request.get(`/records/${entrustId}/print`, { responseType: 'blob' })
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  } catch (e) {
    ElMessage.error('PDF生成失败')
  } finally { printing.value = false }
}
</script>

<style scoped>
.record-page { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h3 { margin: 0; display: flex; align-items: center; gap: 8px; }
.toolbar-btns { display: flex; gap: 8px; }
.section-card { margin-bottom: 16px; }
.card-title { font-weight: 600; }

.info-line { margin-bottom: 8px; font-size: 14px; }
.lbl { color: #606266; }
.val { color: #303133; font-weight: 500; }

/* 转置表格 */
.table-wrapper { overflow-x: auto; }
.data-table { border-collapse: collapse; min-width: 900px; font-size: 12px; }
.data-table th, .data-table td { border: 1px solid #dcdfe6; padding: 5px 6px; text-align: center; white-space: nowrap; }
.data-table th { background: #f5f7fa; font-weight: 600; }
.data-table th.empty { background: #fafafa; color: #c0c4cc; }
.data-table td.empty { background: #fafafa; }
.param-col { width: 200px; text-align: left !important; }
.param-label { text-align: left !important; font-weight: 500; background: #f5f7fa; min-width: 180px; }
.calc-row td { background: #f0f9eb; }
.ci { width: 100%; border: 1px solid #dcdfe6; outline: none; text-align: center; font-size: 12px; padding: 3px 4px; box-sizing: border-box; border-radius: 2px; }
.ci:focus { border-color: #409eff; background: #fffde7; }
.static-text { color: #909399; font-size: 12px; }
</style>
