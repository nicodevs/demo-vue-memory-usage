<script setup lang="ts" vapor>
import { reactive } from 'vue'

const rows = reactive(
  Array.from({ length: 10000 }, (_, i) => ({ id: i + 1, label: `Row ${i + 1}` })),
)
</script>

<template>
  <table>
    <tbody>
      <tr v-for="row in rows" :key="row.id">
        <td>{{ row.id }}</td>
        <td>{{ row.label }}</td>
      </tr>
    </tbody>
  </table>
</template>
