<script setup lang="ts">
import { computed, inject } from 'vue'

const toggleMobileNav = inject<() => void>('toggleMobileNav')
const isMobileNavOpen = inject<{ value: boolean }>('isMobileNavOpen')
const isOpen = computed(() => Boolean(isMobileNavOpen?.value))

const handleClick = () => {
  toggleMobileNav?.()
}
</script>

<template>
  <button
    class="mobile-menu-toggle"
    type="button"
    :data-open="isOpen"
    :aria-label="isOpen ? 'Cerrar menú' : 'Abrir menú'"
    :aria-expanded="isOpen"
    @click="handleClick"
  >
    <span></span>
  </button>
</template>
