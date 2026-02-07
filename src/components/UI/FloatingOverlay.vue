<script setup lang="ts">
defineProps<{
  isVisible: boolean;
}>();

const emit = defineEmits<{
  (e: 'interact'): void;
}>();

const handleInteract = () => {
  emit('interact');
};
</script>

<template>
  <div
    class="fixed inset-x-0 bottom-0 z-30 flex flex-col justify-end pointer-events-none"
    style="height: 30%"
  >
    <!-- Interactive Hotspot -->
    <div
      class="absolute inset-0 z-40 pointer-events-auto"
      @mouseenter="handleInteract"
      @touchstart="handleInteract"
      @mousemove="handleInteract"
    />

    <div
      class="z-50 transition-opacity duration-500 pointer-events-auto"
      :class="[isVisible ? 'opacity-100' : 'opacity-0']"
      @mouseenter="handleInteract"
      @touchstart="handleInteract"
      @mousemove="handleInteract"
    >
      <slot />
    </div>
  </div>
</template>
