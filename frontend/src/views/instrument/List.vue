<template>
  <div class="page-container">
    <div class="page-header">
      <h3>仪器库</h3>
      <el-button type="primary" @click="addBox">添加白搪瓷盒</el-button>
    </div>

    <el-card shadow="never">
      <template #header><strong>白搪瓷盒</strong></template>
      <el-table :data="boxes" border stripe size="small">
        <el-table-column prop="code" label="编号" width="80" />
        <el-table-column label="质量(g)" width="120">
          <template #default="{ row }">
            <el-input-number v-if="row._editing" v-model="row._mass" :min="1" :max="9999"
              size="small" controls-position="right" style="width:100px"
              @blur="saveBox(row)" @keydown.enter="saveBox(row)" />
            <span v-else>{{ row.mass }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row, $index }">
            <el-button link type="primary" size="small" @click="editBox(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="delBox(row, $index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getInstruments, createInstrument, updateInstrument, deleteInstrument } from '../../api/instrument'

const boxes = ref([])

onMounted(async () => {
  try {
    const res = await getInstruments('白搪瓷盒')
    boxes.value = (res.data || []).map(i => ({ ...i, _editing: false, _mass: i.mass }))
  } catch {}
})

function editBox(row) {
  row._editing = true
  row._mass = row.mass
}

async function saveBox(row) {
  row._editing = false
  const newMass = parseFloat(row._mass)
  if (isNaN(newMass) || newMass === row.mass) { row._mass = row.mass; return }
  try {
    if (row._isNew) {
      const res = await createInstrument({ category: '白搪瓷盒', code: row.code, mass: newMass })
      row.id = res.data.id
      row._isNew = false
    } else {
      await updateInstrument(row.id, { category: '白搪瓷盒', code: row.code, mass: newMass })
    }
    row.mass = newMass
    ElMessage.success('已保存')
  } catch { row._mass = row.mass }
}

async function delBox(row, idx) {
  try {
    await ElMessageBox.confirm(`确认删除白搪瓷盒 ${row.code}？`, '删除确认', { type: 'warning' })
  } catch { return }
  if (row.id) await deleteInstrument(row.id)
  boxes.value.splice(idx, 1)
  ElMessage.success('已删除')
}

function addBox() {
  const maxCode = boxes.value.reduce((m, i) => Math.max(m, parseInt(i.code) || 0), 0)
  boxes.value.push({
    id: null, category: '白搪瓷盒', code: String(maxCode + 1), mass: 380,
    _editing: true, _mass: 380, _isNew: true
  })
}
</script>
