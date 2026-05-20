<script setup lang="ts">
import { ref, watch } from 'vue'

export interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info'
  title?: string
  message: string
  duration?: number // ms, 0 = no auto-close
  closeable?: boolean
  modelValue?: boolean // For v-model support
}

const props = withDefaults(defineProps<AlertProps>(), {
  type: 'info',
  duration: 5000,
  closeable: true,
  modelValue: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const isVisible = ref(props.modelValue)
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null

const close = () => {
  isVisible.value = false
  emit('update:modelValue', false)
}

// Watch for prop changes
watch(
  () => props.modelValue,
  (newVal) => {
    isVisible.value = newVal
    if (newVal && props.duration > 0) {
      if (autoCloseTimer) clearTimeout(autoCloseTimer)
      autoCloseTimer = setTimeout(() => {
        close()
      }, props.duration)
    }
  },
)

// Auto-close when component mounts with duration
watch(
  () => isVisible.value,
  (newVal) => {
    if (newVal && props.duration > 0) {
      if (autoCloseTimer) clearTimeout(autoCloseTimer)
      autoCloseTimer = setTimeout(() => {
        close()
      }, props.duration)
    }
  },
)

const getIcon = () => {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }
  return icons[props.type || 'info']
}

const getBgClass = () => {
  const classes = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info',
  }
  return classes[props.type || 'info']
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isVisible" class="alert-container">
      <div :class="['alert', getBgClass()]">
        <div class="alert-content">
          <div class="alert-icon">{{ getIcon() }}</div>
          <div class="alert-text">
            <div v-if="title" class="alert-title">{{ title }}</div>
            <div class="alert-message">{{ message }}</div>
          </div>
        </div>
        <button v-if="closeable" class="alert-close" @click="close" title="Tutup">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.alert-container {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: 500px;
  width: calc(100% - 2rem);
  animation: slideDown 300ms ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.2rem;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.alert-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.alert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

.alert-text {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.alert-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.alert-message {
  font-size: 0.85rem;
  opacity: 0.9;
}

.alert-close {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem;
  border-radius: 6px;
  transition: all 150ms ease;
  flex-shrink: 0;
}

.alert-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* Success Alert - Hijau */
.alert-success {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9));
  color: #ffffff;
}

.alert-success .alert-icon {
  background: rgba(255, 255, 255, 0.2);
}

/* Error Alert - Merah */
.alert-error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9));
  color: #ffffff;
}

.alert-error .alert-icon {
  background: rgba(255, 255, 255, 0.2);
}

/* Warning Alert - Orange */
.alert-warning {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9));
  color: #ffffff;
}

.alert-warning .alert-icon {
  background: rgba(255, 255, 255, 0.2);
}

/* Info Alert - Biru */
.alert-info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9));
  color: #ffffff;
}

.alert-info .alert-icon {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 600px) {
  .alert-container {
    width: calc(100% - 1rem);
    top: 0.5rem;
  }

  .alert {
    flex-direction: column;
    text-align: center;
    gap: 0.75rem;
  }

  .alert-content {
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .alert-close {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }
}
</style>
