<script setup lang="ts">
defineProps<{
  isVisible: boolean;
}>();

const emit = defineEmits<{
  (e: 'interact'): void;
  (e: 'seek', delta: number): void;
}>();

const SEEK_DELTA = 15;
const DOUBLE_TAP_MS = 300;
let lastTapTime = 0;
let lastTapSide: 'left' | 'right' | null = null;

const handleInteract = () => {
  emit('interact');
};

const handleSeek = (delta: number) => {
  emit('seek', delta);
};

const handleDblClick = (delta: number) => {
  handleSeek(delta);
};

const handleTouchStart = (_e: TouchEvent, side: 'left' | 'right') => {
  emit('interact');
  const now = Date.now();
  if (now - lastTapTime < DOUBLE_TAP_MS && lastTapSide === side) {
    handleSeek(side === 'left' ? -SEEK_DELTA : SEEK_DELTA);
    lastTapTime = now - DOUBLE_TAP_MS;
    lastTapSide = null;
  } else {
    lastTapTime = now;
    lastTapSide = side;
  }
};
</script>

<template>
  <div
    class="fixed inset-x-0 bottom-0 z-30 flex flex-col justify-end pointer-events-none"
    style="height: 30%"
  >
    <!-- Left 15%: double-tap to seek -15s -->
    <div
      class="absolute inset-y-0 left-0 z-40 pointer-events-auto"
      style="width: 15%"
      @mouseenter="handleInteract"
      @touchstart="handleTouchStart($event, 'left')"
      @mousemove="handleInteract"
      @dblclick="handleDblClick(-SEEK_DELTA)"
    />
    <!-- Right 15%: double-tap to seek +15s -->
    <div
      class="absolute inset-y-0 right-0 z-40 pointer-events-auto"
      style="width: 15%"
      @mouseenter="handleInteract"
      @touchstart="handleTouchStart($event, 'right')"
      @mousemove="handleInteract"
      @dblclick="handleDblClick(SEEK_DELTA)"
    />

    <div
      class="z-50 transition-opacity duration-500"
      :class="[
        isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      ]"
      @mouseenter="handleInteract"
      @touchstart="handleInteract"
      @mousemove="handleInteract"
    >
      <slot />
    </div>
  </div>
</template>
