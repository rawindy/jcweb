<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <h3>
        委托详情 - {{ entrust.entrust_no }}
        <el-tag v-if="entrust.category_code === 'SYS'" type="primary">压实度</el-tag>
        <el-tag v-else-if="entrust.category_code === 'STJ'" type="warning">击实</el-tag>
        <el-tag v-else-if="entrust.category_code === 'SWC'" type="success">弯沉</el-tag>
        <span style="font-size:14px;color:#909399;margin-left:8px">{{ entrust.entrust_type }}</span>
      </h3>
      <el-button @click="$router.back()">返回</el-button>
    </div>

    <el-card shadow="never">
      <template #header><strong>工程信息</strong></template>
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
      <el-empty v-else description="未关联工程" />
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header><strong>检测明细</strong></template>

      <!-- 压实度 -->
      <template v-if="entrust.category_code === 'SYS'">
        <el-table :data="entrust.items" border>
          <el-table-column prop="position_name" label="检测部位" width="180" />
          <el-table-column prop="group_count" label="检测数量(组)" width="120" />
          <el-table-column prop="material" label="材料" width="120" />
          <el-table-column prop="design_requirement" label="设计要求(%)" width="120" />
        </el-table>
      </template>

      <!-- 击实 -->
      <template v-if="entrust.category_code === 'STJ'">
        <el-descriptions :column="2" border v-if="entrust.items.length">
          <el-descriptions-item label="材料">{{ entrust.items[0]?.material }}</el-descriptions-item>
          <el-descriptions-item label="击实方式">{{ entrust.items[0]?.test_method }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <!-- 弯沉 -->
      <template v-if="entrust.category_code === 'SWC'">
        <el-table :data="entrust.items" border>
          <el-table-column prop="position_name" label="检测部位" />
          <el-table-column prop="design_requirement" label="设计要求(mm)" />
        </el-table>
      </template>
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header><strong>其他信息</strong></template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="委托编号">{{ entrust.entrust_no }}</el-descriptions-item>
        <el-descriptions-item label="委托日期">{{ entrust.entrust_date }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ entrust.create_time }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ entrust.remark || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getEntrustDetail } from '../../api/entrust'

const route = useRoute()
const loading = ref(false)
const entrust = reactive({})

onMounted(async () => {
  loading.value = true
  try {
    const res = await getEntrustDetail(route.params.id)
    Object.assign(entrust, res.data)
  } finally {
    loading.value = false
  }
})
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
.section-card { margin-top: 16px; }
</style>
