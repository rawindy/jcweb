<template>
  <div class="page-container">
    <div class="page-header">
      <h3>委托录入</h3>
      <el-button type="primary" @click="$router.push('/entrust/create')">
        <el-icon style="margin-right:4px"><Plus /></el-icon>
        新建委托
      </el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-icon blue"><el-icon :size="22"><Histogram /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ statCounts.SYS }}</div>
          <div class="stat-label">压实度委托</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><el-icon :size="22"><Box /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ statCounts.STJ }}</div>
          <div class="stat-label">击实委托</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><el-icon :size="22"><TrendCharts /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ statCounts.SWC }}</div>
          <div class="stat-label">弯沉委托</div>
        </div>
      </div>
    </div>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true">
        <el-form-item label="委托类别">
          <el-select v-model="filterCategory" placeholder="全部类别" clearable style="width:150px" @change="handleFilter">
            <el-option label="压实度" value="SYS" />
            <el-option label="击实" value="STJ" />
            <el-option label="弯沉" value="SWC" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-tag v-if="!filterCategory" type="info">全部</el-tag>
          <el-tag v-else-if="filterCategory === 'SYS'" type="primary">压实度</el-tag>
          <el-tag v-else-if="filterCategory === 'STJ'" type="warning">击实</el-tag>
          <el-tag v-else-if="filterCategory === 'SWC'" type="success">弯沉</el-tag>
          <span style="color:#909399;margin-left:8px;font-size:13px">
            共 {{ pagination.total }} 条记录
          </span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="tableData" v-loading="loading" stripe style="width:100%">
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
        <el-table-column prop="client_unit" label="委托单位" min-width="160" show-overflow-tooltip />
        <el-table-column prop="total_groups" label="总组数" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.total_groups" type="primary" effect="plain">{{ row.total_groups }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column prop="entrust_date" label="委托日期" width="120" />
        <el-table-column prop="create_time" label="创建时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/entrust/${row.id}`)">详情</el-button>
            <el-button link type="primary" @click="$router.push(`/record/${row.entrust_no}`)">录入记录</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchData"
          @current-change="fetchData"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getEntrustList, deleteEntrust } from '../../api/entrust'

const loading = ref(false)
const filterCategory = ref('')
const tableData = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const statCounts = computed(() => {
  const counts = { SYS: 0, STJ: 0, SWC: 0 }
  tableData.value.forEach(r => {
    if (counts[r.category_code] !== undefined) counts[r.category_code]++
  })
  return counts
})

onMounted(() => fetchData())

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

async function handleDelete(row) {
  await ElMessageBox.confirm(
    `确定删除委托单「${row.entrust_no}」吗？此操作不可恢复。`,
    '确认删除',
    { type: 'warning', confirmButtonText: '确定删除', cancelButtonText: '取消' }
  )
  await deleteEntrust(row.id)
  ElMessage.success('删除成功')
  fetchData()
}
</script>
