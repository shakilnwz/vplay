<script setup lang="ts">
import type { useFileHandler } from '../../hooks/useFileHandler';

const props = defineProps<{
  isOpen: boolean;
  fileHandler: ReturnType<typeof useFileHandler>;
}>();

const {
  processedVideos,
  currentVideo,
  directoryPath,
  isScanning,
  sortOrder,
  sortDirection,
  filterQuery,
  filterExtension,
  videoMetadata,
  error,
  handleFileSelect,
  handleDirectoryPicker,
  loadVideo
} = props.fileHandler;

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const extensions = ['all', 'mp4', 'webm', 'mov', 'mkv', 'avi'];

const emit = defineEmits<{
  (e: 'close'): void
}>();
</script>

<template>

  <div
    :class="[
      isOpen ? 'fixed inset-0 z-40 lg:static' : 'hidden',
      'lg:flex w-80 bg-gray-800 p-4 overflow-y-auto flex-col h-full border-r border-gray-700 isolate'
    ]"
  >
  <div 
  :class="[
  isOpen ? 'fixed inset-0 z-0 bg-black/50' : 'hidden '
    ]" 
    @click.self="emit('close')"
    >
    </div>
    <div class="relative z-10 h-full overflow-y-auto w-full">
    <h1 class="text-2xl font-bold mb-4 w-full text-center">VPlay</h1>

    <!-- Directory Picker -->
    <button
      @click="handleDirectoryPicker"
      :disabled="isScanning"
      class="w-full mb-4 p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg transition flex items-center justify-center gap-2"
    >
      <template v-if="isScanning">
        <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Scanning...
      </template>
      <template v-else>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        Open Directory
      </template>
    </button>

    <!-- Directory Path Display -->
    <div v-if="directoryPath" class="mb-4 p-3 bg-gray-700 rounded-lg">
      <div class="text-xs text-gray-400">Directory:</div>
      <div class="text-sm truncate">{{ directoryPath }}</div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
      <p class="text-sm text-red-200">{{ error }}</p>
    </div>

    <!-- Alternative File Input -->
    <label class="block mb-4">
      <span class="sr-only">Choose video files</span>
      <input
        type="file"
        multiple
        accept="video/*,.mp4,.webm,.ogv,.mov,.mkv,.avi,.m4v,.flv,.wmv"
        @change="handleFileSelect"
        class="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer"
      />
    </label>

    <!-- Search Filter -->
    <div class="mb-4">
      <input
        type="text"
        placeholder="Search videos..."
        v-model="filterQuery"
        class="w-full p-2 bg-gray-700 rounded-lg text-sm"
      />
    </div>

    <!-- Sort and Filter Controls -->
    <div class="flex gap-2 mb-4">
      <select
        v-model="sortOrder"
        class="flex-1 p-2 bg-gray-700 rounded-lg text-sm"
      >
        <option value="name">Sort by Name</option>
        <option value="size">Sort by Size</option>
        <option value="date">Sort by Date</option>
        <option value="duration">Sort by Duration</option>
      </select>
      <button
        @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
        class="p-2 bg-gray-700 rounded-lg"
      >
        {{ sortDirection === 'asc' ? '↑' : '↓' }}
      </button>
    </div>

    <!-- Extension Filter -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="ext in extensions"
        :key="ext"
        @click="filterExtension = ext"
        :class="[
          'px-3 py-1 rounded-lg text-sm',
          filterExtension === ext ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
        ]"
      >
        {{ ext.toUpperCase() }}
      </button>
    </div>

    <div class="space-y-2 flex-1 overflow-y-auto">
      <h2 class="text-lg font-semibold mb-2">
        Videos ({{ processedVideos.length }})
      </h2>
      <button
        v-for="(video, index) in processedVideos"
        :key="index"
        @click="loadVideo(video); emit('close'); "
        :class="[
          'w-full text-left p-3 rounded transition',
          currentVideo === video ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
        ]"
      >
        <div class="truncate font-medium">{{ video.name }}</div>
        <div class="text-xs text-gray-400 flex justify-between">
          <span>{{ (video.size / 1024 / 1024).toFixed(2) }} MB</span>
          <span v-if="videoMetadata.get(video.name)">
            {{ formatTime(videoMetadata.get(video.name)!.duration) }}
          </span>
        </div>
        </button>
      </div>
    </div>
  </div>
</template>
