<template>
  <div class="page-container">
    <div class="page-header">
      <h3>原始记录录入</h3>
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
          <span style="color:#909399;font-size:13px">
            共 {{ pagination.total }} 条记录，选择委托单进入原始记录录入
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
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="$router.push(`/record/${row.entrust_no}`)">
              <el-icon style="margin-right:2px"><EditPen /></el-icon>
              录入原始记录
            </el-button>
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
import { ref, reactive, onMounted } from 'vue'
import { getEntrustList } from '../../api/entrust'

const loading = ref(false)
const filterCategory = ref('')
const tableData = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

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
</script>
