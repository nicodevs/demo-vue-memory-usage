<script setup lang="ts">
import { reactive } from 'vue'
import Row from './Row.vue'

const rows = reactive(
  Array.from({ length: 10000 }, (_, i) => ({ id: i + 1, label: `Row ${i + 1}` })),
)
</script>

<template>
  <table>
    <tbody>
      <Row v-for="row in rows" :key="row.id" :id="row.id" :label="row.label" />
    </tbody>
  </table>
</template>
