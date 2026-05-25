<template>
  <div class="page">
    <div class="page-header">
      <h3>委托录入</h3>
      <el-button type="primary" @click="$router.push('/entrust/create')">新建委托</el-button>
    </div>

    <el-card shadow="never" class="search-card">
      <el-form :inline="true">
        <el-form-item label="委托类别">
          <el-select v-model="filterCategory" placeholder="全部" clearable style="width:140px" @change="fetchData">
            <el-option label="压实度" value="SYS" />
            <el-option label="击实" value="STJ" />
            <el-option label="弯沉" value="SWC" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="tableData" v-loading="loading" stripe border style="width:100%">
        <el-table-column prop="entrust_no" label="委托编号" width="160" />
        <el-table-column label="类别" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.category_code === 'SYS'" type="primary">压实度</el-tag>
            <el-tag v-else-if="row.category_code === 'STJ'" type="warning">击实</el-tag>
            <el-tag v-else-if="row.category_code === 'SWC'" type="success">弯沉</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="entrust_type" label="委托类型" width="120" />
        <el-table-column prop="project_name" label="工程名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="client_unit" label="委托单位" min-width="180" show-overflow-tooltip />
        <el-table-column prop="entrust_date" label="委托日期" width="120" />
        <el-table-column prop="create_time" label="创建时间" width="160" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="$router.push(`/entrust/${row.id}`)">详情</el-button>
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getEntrustList, deleteEntrust } from '../../api/entrust'

const loading = ref(false)
const filterCategory = ref('')
const tableData = ref([])
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

onMounted(() => fetchData())

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
  await ElMessageBox.confirm(`确定删除委托单「${row.entrust_no}」吗？`, '确认', { type: 'warning' })
  await deleteEntrust(row.id)
  ElMessage.success('删除成功')
  fetchData()
}
</script>

<style scoped>
.page { padding: 0; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-header h3 { margin: 0; }
.search-card { margin-bottom: 16px; }
.pagination-wrap { display:flex; justify-content: flex-end; margin-top: 16px; }
</style>
