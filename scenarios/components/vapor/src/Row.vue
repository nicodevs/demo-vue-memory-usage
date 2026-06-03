<script setup lang="ts" vapor>
defineProps<{ id: number; label: string }>()
</script>

<template>
  <tr>
    <td>{{ id }}</td>
    <td>{{ label }}</td>
  </tr>
</template>
