<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AlertBox from './components/AlertBox.vue'
import {
  fetchAllCourses,
  addCourse as addCourseToDb,
  updateCourse as updateCourseInDb,
  deleteCourseById,
} from './courseService'
import type { Course, Todo } from './courseService'

// Types are now imported from courseService.ts

const courses = ref<Course[]>([])
const name = ref('')
const type = ref<'Praktik' | 'Non Praktik'>('Praktik')
const loading = ref(false)
const editingId = ref<number | null>(null)
const editDraft = ref<{ name: string; type: 'Praktik' | 'Non Praktik' }>({
  name: '',
  type: 'Praktik',
})
const isModalOpen = ref(false)
const expandedCourseIds = ref<Set<number>>(new Set())

// State for add/edit todo modal
const isTodoModalOpen = ref(false)
const currentCourse = ref<Course | null>(null)
const todoTitle = ref('')
const editingTodoId = ref<number | null>(null)
const todoDueDate = ref('')
const todoNilai = ref('')
const todoCompletedDate = ref('')
const todoIsCompleted = ref(false)
const isDeleteModalOpen = ref(false)
const deleteTarget = ref<{
  type: 'course' | 'todo'
  courseId?: number
  todoId?: number
  course?: Course
} | null>(null)

// Theme state
const isDarkTheme = ref(true)

// Notification state
const isNotificationOpen = ref(false)
const isPinnedOpen = ref(false)
const isMenuOpen = ref(false)

// Alert state
const alertMessage = ref('')
const alertType = ref<'success' | 'error' | 'warning' | 'info'>('info')
const alertTitle = ref('')
const showAlert = ref(false)

function showCustomAlert(
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info',
  title?: string,
) {
  alertMessage.value = message
  alertType.value = type
  alertTitle.value = title || ''
  showAlert.value = true
}

// Firebase Firestore is now used directly via courseService (no apiBase needed)

function makeId() {
  return Date.now() + Math.floor(Math.random() * 10000)
}

function generateTodosFor(typeValue: string): Todo[] {
  const items: Todo[] = []
  if (typeValue === 'Praktik') {
    for (let i = 1; i <= 3; i++) items.push({ id: makeId(), title: `Tugas ${i}`, done: false })
  } else {
    // Tugas dulu, baru Diskusi
    for (let i = 1; i <= 3; i++) items.push({ id: makeId(), title: `Tugas ${i}`, done: false })
    for (let i = 1; i <= 8; i++) items.push({ id: makeId(), title: `Diskusi ${i}`, done: false })
  }
  return items
}

async function fetchCourses() {
  loading.value = true
  try {
    courses.value = await fetchAllCourses()
  } catch (e) {
    console.error(e)
    courses.value = []
    showCustomAlert('Gagal memuat data dari Firebase', 'error', 'Error')
  } finally {
    loading.value = false
  }
}

async function addCourse() {
  if (!name.value.trim()) return
  const newCourse: Course = {
    id: makeId(),
    name: name.value.trim(),
    type: type.value,
    todos: generateTodosFor(type.value),
  }

  try {
    await addCourseToDb(newCourse)
    courses.value.push(newCourse)
    name.value = ''
  } catch (e) {
    console.error(e)
    showCustomAlert('Gagal menyimpan data', 'error', 'Error')
  }
}

async function updateCourse(course: Course) {
  try {
    await updateCourseInDb(course)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Update error', e)
    showCustomAlert('Gagal update: ' + msg, 'error', 'Error')
  }
}

async function deleteCourse(id: number) {
  const course = courses.value.find((c) => c.id === id)
  deleteTarget.value = { type: 'course', courseId: id, course }
  isDeleteModalOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return

  if (deleteTarget.value.type === 'course' && deleteTarget.value.courseId) {
    // Check if course has completed tasks
    if (deleteTarget.value.course && hasCompletedTasks(deleteTarget.value.course)) {
      showCustomAlert(
        'Mata kuliah tidak bisa dihapus karena memiliki task yang sudah diproses',
        'warning',
        'Peringatan',
      )
      closeDeleteModal()
      return
    }

    try {
      await deleteCourseById(deleteTarget.value.courseId)
      courses.value = courses.value.filter((c) => c.id !== deleteTarget.value!.courseId)
    } catch (e) {
      console.error(e)
      showCustomAlert('Gagal menghapus', 'error', 'Error')
    }
  } else if (
    deleteTarget.value.type === 'todo' &&
    deleteTarget.value.course &&
    deleteTarget.value.todoId
  ) {
    deleteTarget.value.course.todos = deleteTarget.value.course.todos.filter(
      (t) => t.id !== deleteTarget.value!.todoId,
    )
    await updateCourse(deleteTarget.value.course)
  }

  closeDeleteModal()
}

function closeDeleteModal() {
  isDeleteModalOpen.value = false
  deleteTarget.value = null
}

function toggleTodo(course: Course) {
  // v-model already updated the todo.done. Persist the changed course.
  course.todos.forEach((todo) => {
    if (todo.done) {
      if (!todo.completedDate) {
        // Use timezone-safe local date string: YYYY-MM-DD
        const now = new Date()
        todo.completedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      }
    } else {
      // Clear completion date if task is unchecked
      todo.completedDate = undefined
    }
  })
  updateCourse(course)
}

function addCustomTodo(course: Course) {
  currentCourse.value = course
  todoTitle.value = ''
  todoDueDate.value = ''
  editingTodoId.value = null
  isTodoModalOpen.value = true
}

function openEditTodoModal(course: Course, todo: Todo) {
  currentCourse.value = course
  todoTitle.value = todo.title
  todoDueDate.value = todo.dueDate ? formatDisplayOnlyDate(todo.dueDate) : ''
  todoNilai.value = todo.nilai ? String(todo.nilai) : ''
  editingTodoId.value = todo.id
  todoIsCompleted.value = todo.done
  todoCompletedDate.value = todo.completedDate ? formatDisplayOnlyDate(todo.completedDate) : ''
  isTodoModalOpen.value = true
}

function saveTodo() {
  if (!todoTitle.value.trim() || !currentCourse.value) return

  const parsedDate = todoDueDate.value ? parseAnyDateInput(todoDueDate.value) : ''

  if (todoDueDate.value && !parsedDate) {
    showCustomAlert('Format tanggal tidak valid. Gunakan format dd/mm/yyyy atau dd mmm yyyy (contoh: 22 Mei 2026)', 'warning', 'Peringatan')
    return
  }

  // Validate completed date if provided
  let completedDateValue: string | undefined = undefined
  if (todoCompletedDate.value && todoCompletedDate.value.trim()) {
    const parsed = parseAnyDateInput(todoCompletedDate.value)
    if (parsed) {
      const parts = parsed.split('/')
      completedDateValue = `${parts[2]}-${parts[1]}-${parts[0]}`
    } else {
      showCustomAlert('Format tanggal selesai tidak valid. Gunakan format dd/mm/yyyy atau dd mmm yyyy (contoh: 22 Mei 2026)', 'warning', 'Peringatan')
      return
    }
  }

  // Validate nilai if provided
  let nilaiNum: number | undefined
  if (todoNilai.value) {
    nilaiNum = parseFloat(todoNilai.value)
    if (isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
      showCustomAlert('Nilai harus angka antara 0-100', 'warning', 'Peringatan')
      return
    }
  }
  // If nilai is empty, set to undefined to allow clearing

  if (editingTodoId.value) {
    // Edit existing todo
    const todo = currentCourse.value.todos.find((t) => t.id === editingTodoId.value)
    if (todo) {
      todo.title = todoTitle.value.trim()
      todo.dueDate = parsedDate || undefined
      // Always update nilai (including clearing it if empty)
      todo.nilai = nilaiNum
      
      // If completedDateValue is provided, automatically set done = true
      if (completedDateValue) {
        todo.done = true
        todo.completedDate = completedDateValue
      } else {
        // If completed date is empty:
        // if it was done, we keep it done but set completedDate to undefined (legacy fallback)
        // if it was not done, it remains not done
        if (todo.done) {
          todo.completedDate = undefined
        }
      }
      
      updateCourse(currentCourse.value)
    }
  } else {
    // Add new todo
    currentCourse.value.todos.push({
      id: makeId(),
      title: todoTitle.value.trim(),
      done: false,
      dueDate: parsedDate || undefined,
      nilai: nilaiNum,
    })
    updateCourse(currentCourse.value)
  }

  closeTodoModal()
}

function deleteTodo(course: Course, todoId: number) {
  deleteTarget.value = { type: 'todo', course, todoId }
  isDeleteModalOpen.value = true
}

function closeTodoModal() {
  isTodoModalOpen.value = false
  currentCourse.value = null
  todoTitle.value = ''
  todoDueDate.value = ''
  todoNilai.value = ''
  editingTodoId.value = null
  todoIsCompleted.value = false
  todoCompletedDate.value = ''
}

function startEdit(course: Course) {
  // open modal for editing
  editingId.value = course.id
  editDraft.value = { name: course.name, type: course.type }
  isModalOpen.value = true
}

async function saveEdit(course?: Course) {
  const newName = editDraft.value.name.trim()
  if (!newName) {
    showCustomAlert('Nama mata kuliah tidak boleh kosong', 'warning', 'Peringatan')
    return
  }

  // find course by editingId if no course passed
  let target: Course | undefined = course
  if (!target) {
    target = courses.value.find((c) => c.id === editingId.value!)
  }
  if (!target) {
    showCustomAlert('Mata kuliah tidak ditemukan', 'error', 'Error')
    return
  }

  target.name = newName
  target.type = editDraft.value.type
  await updateCourse(target)
  editingId.value = null
  isModalOpen.value = false
}

function cancelEdit() {
  editingId.value = null
  isModalOpen.value = false
}

function toggleExpand(courseId: number) {
  if (expandedCourseIds.value.has(courseId)) {
    expandedCourseIds.value.delete(courseId)
  } else {
    expandedCourseIds.value.add(courseId)
  }
}

function isExpanded(courseId: number) {
  return expandedCourseIds.value.has(courseId)
}

function toggleTheme() {
  isDarkTheme.value = !isDarkTheme.value
  document.documentElement.setAttribute('data-theme', isDarkTheme.value ? 'dark' : 'light')
}

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  const parts = dateStr.trim().split('-')
  if (parts.length === 3) {
    const p0 = parts[0]
    const p1 = parts[1]
    const p2 = parts[2]
    if (p0 !== undefined && p1 !== undefined && p2 !== undefined) {
      const year = parseInt(p0, 10)
      const month = parseInt(p1, 10) - 1 // 0-based
      const day = parseInt(p2, 10)
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day)
      }
    }
  }
  return parseDatabaseDate(dateStr)
}

function getCompletionStatus(todo: Todo): string | null {
  if (!todo.done || !todo.dueDate) return null

  // Legacy task fallback: assume On Time if task is completed but has no completion record
  if (!todo.completedDate) {
    return 'On Time'
  }

  const dueDate = parseDatabaseDate(todo.dueDate)
  const completedDate = parseLocalDate(todo.completedDate)

  // Reset time to compare dates only
  dueDate.setHours(0, 0, 0, 0)
  completedDate.setHours(0, 0, 0, 0)

  if (completedDate <= dueDate) {
    return 'On Time'
  } else {
    return 'Over Due'
  }
}

function parseDatabaseDate(dateStr: string): Date {
  if (!dateStr) return new Date()
  
  // Try dd/mm/yyyy first
  const parts = dateStr.trim().split('/')
  if (parts.length === 3) {
    const p0 = parts[0]
    const p1 = parts[1]
    const p2 = parts[2]
    if (p0 !== undefined && p1 !== undefined && p2 !== undefined) {
      const day = parseInt(p0, 10)
      const month = parseInt(p1, 10) - 1 // 0-based
      const year = parseInt(p2, 10)
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day)
      }
    }
  }
  
  // Fallback to native parsing (e.g. YYYY-MM-DD)
  const d = new Date(dateStr)
  if (!isNaN(d.getTime())) {
    return d
  }
  return new Date() // fallback
}

function formatDisplayOnlyDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = parseDatabaseDate(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const day = date.getDate()
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ]
  const monthName = monthNames[date.getMonth()]
  const year = date.getFullYear()
  return `${day} ${monthName} ${year}`
}

function formatCardDate(dateStr: string): string {
  if (!dateStr) return ''
  const date = parseDatabaseDate(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function parseAnyDateInput(input: string): string {
  if (!input) return ''
  const cleaned = input.trim().toLowerCase()

  // 1. Check if format is already dd/mm/yyyy or dd/mm/yy
  const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/
  const dmyMatch = cleaned.match(dmyRegex)
  if (dmyMatch) {
    const m1 = dmyMatch[1]
    const m2 = dmyMatch[2]
    const m3 = dmyMatch[3]
    if (m1 !== undefined && m2 !== undefined && m3 !== undefined) {
      const day = parseInt(m1, 10)
      const month = parseInt(m2, 10)
      let year = parseInt(m3, 10)
      if (year < 100) {
        year += 2000 // handle 2-digit years
      }
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000) {
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
      }
    }
  }

  // 2. Check if format is YYYY-MM-DD (e.g. from standard date picker)
  const ymdRegex = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/
  const ymdMatch = cleaned.match(ymdRegex)
  if (ymdMatch) {
    const m1 = ymdMatch[1]
    const m2 = ymdMatch[2]
    const m3 = ymdMatch[3]
    if (m1 !== undefined && m2 !== undefined && m3 !== undefined) {
      const year = parseInt(m1, 10)
      const month = parseInt(m2, 10)
      const day = parseInt(m3, 10)
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000) {
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
      }
    }
  }

  // 3. Check for textual formats like "22 Mei 2026" or "Jum, 22 Mei 2026" or "22 May 2026"
  // Remove leading day names (e.g., "senin,", "sen,", "mon,", "friday,", "jum,", "sab,", etc.)
  const cleanText = cleaned.replace(/^[a-z]{3,10}(?:,\s*|\s+)/, '')

  // Split by whitespace
  const words = cleanText.split(/\s+/)
  if (words.length >= 3) {
    const w0 = words[0]
    const w1 = words[1]
    const w2 = words[2]
    if (w0 !== undefined && w1 !== undefined && w2 !== undefined) {
      const day = parseInt(w0, 10)
      const monthName = w1
      const year = parseInt(w2, 10)

      if (!isNaN(day) && !isNaN(year) && day >= 1 && day <= 31 && year >= 1000) {
        const monthIndex = getMonthIndexFromName(monthName)
        if (monthIndex !== -1) {
          return `${String(day).padStart(2, '0')}/${String(monthIndex).padStart(2, '0')}/${year}`
        }
      }
    }
  }

  return ''
}

function getMonthIndexFromName(name: string): number {
  const months: Record<string, number> = {
    januari: 1, jan: 1,
    februari: 2, feb: 2,
    maret: 3, mar: 3,
    april: 4, apr: 4,
    mei: 5, may: 5,
    juni: 6, jun: 6,
    juli: 7, jul: 7,
    agustus: 8, agt: 8, agu: 8, aug: 8,
    september: 9, sep: 9,
    oktober: 10, okt: 10, oct: 10,
    november: 11, nov: 11,
    desember: 12, des: 12, dec: 12
  }
  return months[name] || -1
}

function onDatePickerChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target && target.value) {
    const parts = target.value.split('-')
    if (parts.length === 3) {
      const p0 = parts[0]
      const p1 = parts[1]
      const p2 = parts[2]
      if (p0 !== undefined && p1 !== undefined && p2 !== undefined) {
        const year = parseInt(p0, 10)
        const month = parseInt(p1, 10) - 1
        const day = parseInt(p2, 10)
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ]
          todoDueDate.value = `${day} ${monthNames[month]} ${year}`
        }
      }
    }
  }
}

function onCompletedDatePickerChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target && target.value) {
    const parts = target.value.split('-')
    if (parts.length === 3) {
      const p0 = parts[0]
      const p1 = parts[1]
      const p2 = parts[2]
      if (p0 !== undefined && p1 !== undefined && p2 !== undefined) {
        const year = parseInt(p0, 10)
        const month = parseInt(p1, 10) - 1
        const day = parseInt(p2, 10)
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ]
          todoCompletedDate.value = `${day} ${monthNames[month]} ${year}`
        }
      }
    }
  }
}

function getDatePickerValue(input: string): string {
  if (!input) return ''
  const dbFormat = parseAnyDateInput(input)
  if (!dbFormat) return ''
  const parts = dbFormat.split('/')
  if (parts.length === 3) {
    const p0 = parts[0]
    const p1 = parts[1]
    const p2 = parts[2]
    if (p0 !== undefined && p1 !== undefined && p2 !== undefined) {
      return `${p2}-${p1}-${p0}` // YYYY-MM-DD
    }
  }
  return ''
}

function getUpcomingTasks() {
  const upcoming: Array<{ course: Course; todo: Todo }> = []

  courses.value.forEach((course) => {
    course.todos.forEach((todo) => {
      // Show only tasks with due date, not done, and <= 7 days
      if (todo.dueDate && !todo.done && isApproachingDeadline(todo.dueDate)) {
        upcoming.push({ course, todo })
      }
    })
  })

  // Sort by due date (earliest first)
  upcoming.sort(
    (a, b) => parseDatabaseDate(a.todo.dueDate || '').getTime() - parseDatabaseDate(b.todo.dueDate || '').getTime(),
  )
  return upcoming
}

function getPinnedTasks() {
  const pinned: Array<{ course: Course; todo: Todo }> = []

  courses.value.forEach((course) => {
    course.todos.forEach((todo) => {
      // Show tasks with due date, not done, and > 7 days
      if (todo.dueDate && !todo.done && !isApproachingDeadline(todo.dueDate)) {
        pinned.push({ course, todo })
      }
    })
  })

  // Sort by due date (earliest first)
  pinned.sort(
    (a, b) => parseDatabaseDate(a.todo.dueDate || '').getTime() - parseDatabaseDate(b.todo.dueDate || '').getTime(),
  )
  return pinned
}

function toggleNotification() {
  isNotificationOpen.value = !isNotificationOpen.value
}

function getDaysUntilDue(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = parseDatabaseDate(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffTime = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

function isApproachingDeadline(dueDate: string): boolean {
  const daysLeft = getDaysUntilDue(dueDate)
  return daysLeft >= 0 && daysLeft <= 7
}

function hasCompletedTasks(course: Course): boolean {
  return course.todos.some((todo) => todo.done)
}

onMounted(() => {
  fetchCourses()
  // Set initial theme
  document.documentElement.setAttribute('data-theme', isDarkTheme.value ? 'dark' : 'light')

  // Handle ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      isModalOpen.value = false
      isTodoModalOpen.value = false
      isDeleteModalOpen.value = false
      isNotificationOpen.value = false
      isPinnedOpen.value = false
      isMenuOpen.value = false
    }
  })

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.dropdown-menu-container')) {
      isMenuOpen.value = false
    }
  })
})
</script>

<template>
  <div class="site">
    <header class="topbar">
      <div class="brand">
        <svg class="logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
          <path
            fill="currentColor"
            d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6zm6 2v8l6-4-6-4z"
          />
        </svg>
        <div>
          <h1>UT Todo</h1>
        </div>
      </div>
      <div class="header-actions">
        <button
          class="theme-toggle notification-btn"
          @click="toggleNotification"
          :title="`${getUpcomingTasks().length} task mendekati deadline`"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <!-- Bell icon -->
            <path
              d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span v-if="getUpcomingTasks().length > 0" class="notification-badge">{{
            getUpcomingTasks().length
          }}</span>
        </button>
        <div class="dropdown-menu-container">
          <button
            class="theme-toggle menu-btn"
            @click.stop="isMenuOpen = !isMenuOpen"
            title="Menu"
            :class="{ active: isMenuOpen }"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <!-- Three vertical dots icon -->
              <path d="M12 5h.01M12 12h.01M12 19h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <span v-if="getPinnedTasks().length > 0" class="menu-alert-dot"></span>
          </button>
          
          <div v-if="isMenuOpen" class="menu-dropdown-list">
            <!-- Bookmark Item -->
            <button class="menu-item" @click="isPinnedOpen = !isPinnedOpen; isMenuOpen = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
                <!-- Bookmark icon -->
                <path d="M5 2c-1.1 0-2 .9-2 2v18l9-5 9 5V4c0-1.1-.9-2-2-2H5z" />
              </svg>
              <span>Bookmark Task</span>
              <span v-if="getPinnedTasks().length > 0" class="menu-badge">{{ getPinnedTasks().length }}</span>
            </button>

            <!-- Dark Mode Toggle Item -->
            <button class="menu-item" @click="toggleTheme(); isMenuOpen = false">
              <svg v-if="isDarkTheme" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <!-- Sun icon -->
                <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none">
                <!-- Moon icon -->
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{{ isDarkTheme ? 'Mode Terang' : 'Mode Gelap' }}</span>
            </button>

            <!-- Refresh Data Item -->
            <button class="menu-item" @click="fetchCourses(); isMenuOpen = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <!-- Refresh icon -->
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>Refresh Data</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="main">
      <aside class="panel add-panel">
        <h3>Tambah Mata Kuliah</h3>
        <div class="field">
          <label>Nama Mata Kuliah</label>
          <input v-model="name" placeholder="Contoh: Pemrograman Web" />
        </div>
        <div class="field">
          <label>Jenis</label>
          <div class="segmented">
            <label :class="{ active: type === 'Praktik' }">
              <input type="radio" value="Praktik" v-model="type" /> Praktik
            </label>
            <label :class="{ active: type === 'Non Praktik' }">
              <input type="radio" value="Non Praktik" v-model="type" /> Non Praktik
            </label>
          </div>
        </div>
        <div class="field actions">
          <button class="btn btn-secondary" @click="name = ''">Reset</button>
          <button class="btn btn-success" @click="addCourse">Simpan</button>
        </div>
      </aside>

      <section class="panel list-panel">
        <div class="list-header">
          <h3>Daftar Mata Kuliah</h3>
          <div class="muted">{{ courses.length }} mata kuliah</div>
        </div>

        <div v-if="loading" class="empty">Memuat...</div>
        <div v-if="!loading && courses.length === 0" class="empty">Belum ada mata kuliah.</div>

        <div class="cards">
          <article v-for="course in courses" :key="course.id" class="card">
            <header class="card-head" @click="toggleExpand(course.id)" style="cursor: pointer">
              <div>
                <h4 class="course-name">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    style="
                      display: inline-block;
                      vertical-align: middle;
                      margin-right: 0.25rem;
                      transition: transform 200ms;
                    "
                    :style="{ transform: isExpanded(course.id) ? 'rotate(90deg)' : 'rotate(0deg)' }"
                  >
                    <path
                      fill="currentColor"
                      d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
                    />
                  </svg>
                  {{ course.name }}
                </h4>
                <div class="meta">
                  <span class="badge" :class="course.type === 'Praktik' ? 'primary' : 'accent'">{{
                    course.type
                  }}</span>
                  <small class="muted"
                    >{{ course.todos.filter((t) => t.done).length }}/{{
                      course.todos.length
                    }}
                    selesai</small
                  >
                </div>
              </div>
              <div class="card-actions" @click.stop>
                <button class="icon icon-add" title="Tambah todo" @click="addCustomTodo(course)">
                  <!-- plus -->
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                </button>
                <button
                  class="icon icon-edit"
                  title="Edit mata kuliah"
                  @click.prevent="startEdit(course)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                    />
                  </svg>
                </button>
                <button
                  class="icon icon-delete"
                  title="Hapus mata kuliah"
                  @click="deleteCourse(course.id)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                    />
                  </svg>
                </button>
              </div>
            </header>

            <div class="progress" @click="toggleExpand(course.id)" style="cursor: pointer">
              <div
                class="bar"
                :style="{
                  width:
                    (course.todos.filter((t) => t.done).length / (course.todos.length || 1)) * 100 +
                    '%',
                }"
              ></div>
            </div>

            <ul v-if="isExpanded(course.id)" class="todo-list">
              <li v-for="todo in course.todos" :key="todo.id" :class="{ done: todo.done }">
                <div class="todo-item" @click="openEditTodoModal(course, todo)" style="cursor: pointer">
                  <input
                    type="checkbox"
                    v-model="todo.done"
                    @change="toggleTodo(course)"
                    @click.stop
                    :disabled="!!todo.nilai"
                  />
                  <div class="todo-content">
                    <div class="todo-title-row">
                      <span class="title">{{ todo.title }}</span>
                      <span
                        v-if="todo.done && todo.dueDate"
                        class="completion-badge"
                        :class="getCompletionStatus(todo) === 'On Time' ? 'on-time' : 'over-due'"
                      >
                        {{ getCompletionStatus(todo) }}
                      </span>
                    </div>
                    <span v-if="todo.nilai" class="nilai-badge">Nilai: {{ todo.nilai }}</span>
                    <div class="todo-meta">
                      <small v-if="todo.dueDate" class="due-date">
                        Due: {{ formatCardDate(todo.dueDate) }}
                      </small>
                    </div>
                  </div>
                </div>
                <div class="todo-actions">
                  <button
                    class="icon-small icon-edit"
                    title="Edit task"
                    @click="openEditTodoModal(course, todo)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                      />
                    </svg>
                  </button>
                  <button
                    class="icon-small icon-delete"
                    title="Hapus task"
                    @click="deleteTodo(course, todo.id)"
                    :disabled="!!todo.nilai"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                      />
                    </svg>
                  </button>
                </div>
              </li>
            </ul>
          </article>
        </div>
      </section>
    </main>

    <!-- Edit Modal -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="cancelEdit">
      <div class="modal">
        <h3>Edit Mata Kuliah</h3>
        <div class="field">
          <label>Nama Mata Kuliah</label>
          <input v-model="editDraft.name" placeholder="Nama mata kuliah" />
        </div>
        <div class="field">
          <label>Jenis</label>
          <select v-model="editDraft.type">
            <option value="Praktik">Praktik</option>
            <option value="Non Praktik">Non Praktik</option>
          </select>
        </div>
        <div class="actions" style="justify-content: flex-end; margin-top: 0.5rem">
          <button class="btn btn-danger" @click="cancelEdit">Batal</button>
          <button class="btn btn-success" @click="saveEdit()">Simpan</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Todo Modal -->
    <div v-if="isTodoModalOpen" class="modal-overlay" @click.self="closeTodoModal">
      <div class="modal">
        <h3>{{ editingTodoId ? 'Edit Task' : 'Tambah Task' }}</h3>
        <div class="field">
          <label>Nama Task</label>
          <input
            v-model="todoTitle"
            placeholder="Contoh: Tugas 1, Diskusi 2"
            @keyup.enter="saveTodo"
          />
        </div>
        <div class="field">
          <label>Deadline (Due Date)</label>
          <div class="date-picker-input-group">
            <input
              type="text"
              v-model="todoDueDate"
              placeholder="Contoh: 22 Mei 2026 atau 22/05/2026"
              class="date-text-input"
              @keyup.enter="saveTodo"
            />
            <div class="date-picker-trigger" title="Pilih Tanggal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <input
                type="date"
                class="native-date-picker"
                :value="getDatePickerValue(todoDueDate)"
                @input="onDatePickerChange"
              />
            </div>
          </div>
        </div>
        <div v-if="editingTodoId" class="field">
          <label>Tanggal Selesai (Completion Date)</label>
          <div class="date-picker-input-group">
            <input
              type="text"
              v-model="todoCompletedDate"
              placeholder="Mengisi ini otomatis menyelesaikan task (contoh: 22 Mei 2026)"
              class="date-text-input"
              @keyup.enter="saveTodo"
            />
            <div class="date-picker-trigger" title="Pilih Tanggal Selesai">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <input
                type="date"
                class="native-date-picker"
                :value="getDatePickerValue(todoCompletedDate)"
                @input="onCompletedDatePickerChange"
              />
            </div>
          </div>
          <small class="muted" style="display: block; margin-top: 0.25rem;">*Mengisi tanggal selesai akan menandai task sebagai selesai.</small>
        </div>
        <div class="field">
          <label>Nilai (0-100)</label>
          <input
            type="number"
            v-model="todoNilai"
            placeholder="Masukkan nilai"
            min="0"
            max="100"
            @keyup.enter="saveTodo"
          />
        </div>
        <div class="actions" style="justify-content: flex-end; margin-top: 0.5rem">
          <button class="btn btn-danger" @click="closeTodoModal">Batal</button>
          <button class="btn btn-success" @click="saveTodo">Simpan</button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="isDeleteModalOpen" class="modal-overlay" @click.self="closeDeleteModal">
      <div class="modal modal-confirm">
        <div class="confirm-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2" />
            <path d="M12 8v4M12 16h.01" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <h3 style="text-align: center; margin-bottom: 0.5rem">Konfirmasi Hapus</h3>
        <p style="text-align: center; color: var(--muted); margin-bottom: 1.5rem">
          {{
            deleteTarget?.type === 'course'
              ? 'Apakah Anda yakin ingin menghapus mata kuliah ini?'
              : 'Apakah Anda yakin ingin menghapus task ini?'
          }}
        </p>
        <div class="actions" style="justify-content: center; gap: 1rem">
          <button class="btn btn-secondary" @click="closeDeleteModal">Batal</button>
          <button class="btn btn-danger" @click="confirmDelete">Hapus</button>
        </div>
      </div>
    </div>

    <!-- Notification Panel -->
    <div
      v-if="isNotificationOpen"
      class="notification-overlay"
      @click.self="isNotificationOpen = false"
    >
      <div class="notification-panel">
        <div class="notification-header">
          <h3>Task yang Harus Dikerjakan</h3>
          <button class="close-btn" @click="isNotificationOpen = false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <div v-if="getUpcomingTasks().length === 0" class="notification-empty">
          Tidak ada task yang harus dikerjakan
        </div>
        <div v-else class="notification-list">
          <div
            v-for="(item, idx) in getUpcomingTasks()"
            :key="idx"
            class="notification-item"
            :class="{ 'approaching-deadline': isApproachingDeadline(item.todo.dueDate || '') }"
            @click="(toggleExpand(item.course.id), (isNotificationOpen = false))"
            style="cursor: pointer"
          >
            <div class="item-header">
              <div class="item-title-section">
                <h4 class="course-name">{{ item.course.name }}</h4>
              </div>
              <span class="days-left"
                >{{
                  Math.ceil(
                    (parseDatabaseDate(item.todo.dueDate || '').getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                }}
                hari</span
              >
            </div>
            <p class="task-title">{{ item.todo.title }}</p>
            <small class="due-date">
              Deadline: {{ formatCardDate(item.todo.dueDate || '') }}
            </small>
          </div>
        </div>
      </div>
    </div>

    <!-- Pinned Panel -->
    <div v-if="isPinnedOpen" class="pinned-overlay" @click.self="isPinnedOpen = false">
      <div class="pinned-panel">
        <div class="pinned-header">
          <h3>Task Dalam Pengerjaan</h3>
          <button class="close-btn" @click="isPinnedOpen = false">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <div v-if="getPinnedTasks().length === 0" class="pinned-empty">
          Tidak ada task dalam pengerjaan
        </div>
        <div v-else class="pinned-list">
          <div
            v-for="(item, idx) in getPinnedTasks()"
            :key="idx"
            class="pinned-item"
            @click="(toggleExpand(item.course.id), (isPinnedOpen = false))"
            style="cursor: pointer"
          >
            <div class="item-header">
              <h4 class="course-name">{{ item.course.name }}</h4>
              <span class="days-left"
                >{{
                  Math.ceil(
                    (parseDatabaseDate(item.todo.dueDate || '').getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                }}
                hari</span
              >
            </div>
            <p class="task-title">{{ item.todo.title }}</p>
            <small class="due-date">
              Deadline: {{ formatCardDate(item.todo.dueDate || '') }}
            </small>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom Alert Component -->
    <AlertBox
      v-model="showAlert"
      :type="alertType"
      :title="alertTitle"
      :message="alertMessage"
      :duration="5000"
      :closeable="true"
    />
  </div>
</template>

<style>
/* Global styles - not scoped */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  background: #242424;
  margin: 0;
  padding: 0;
}

body {
  background: #242424;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}

#app {
  background: #242424;
  margin: 0;
  padding: 0;
  min-height: 100vh;
}

/* Dark Theme (Default) */
:root,
[data-theme='dark'] {
  --bg: #242424;
  --card: #2f2f2f;
  --muted: #888;
  --accent: #747bff;
  --primary: #42b883;
  --danger: #f87171;
  --surface: #2f2f2f;
  --border: #3a3a3a;
  --text: rgba(255, 255, 255, 0.87);
  --text-secondary: rgba(255, 255, 255, 0.95);
  --bg-gradient-start: #242424;
  --bg-gradient-end: #1a1a1a;
  --modal-bg: rgba(0, 0, 0, 0.8);
  --input-bg: #1a1a1a;
  --icon-bg: #1a1a1a;
  --hover-bg: rgba(255, 255, 255, 0.05);
}

/* Light Theme */
[data-theme='light'] {
  --bg: #f5f5f5;
  --card: #ffffff;
  --muted: #666;
  --accent: #5b62d3;
  --primary: #42b883;
  --danger: #dc2626;
  --surface: #ffffff;
  --border: #d1d5db;
  --text: rgba(0, 0, 0, 0.87);
  --text-secondary: rgba(0, 0, 0, 0.95);
  --bg-gradient-start: #f5f5f5;
  --bg-gradient-end: #e5e5e5;
  --modal-bg: rgba(0, 0, 0, 0.5);
  --input-bg: #f9fafb;
  --icon-bg: #f9fafb;
  --hover-bg: rgba(0, 0, 0, 0.05);
}
</style>

<style scoped>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}
body {
  background: var(--bg);
  overflow-x: hidden;
}
.site {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 60%);
  color: var(--text);

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: var(--modal-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 60;
    backdrop-filter: blur(4px);
  }
  .modal {
    width: 100%;
    max-width: 520px;
    background: var(--card);
    border: 1px solid var(--border);
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  .modal h3 {
    margin: 0 0 0.5rem 0;
    color: var(--primary);
  }
  .modal-confirm {
    max-width: 420px;
    text-align: center;
  }
  .confirm-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
  }
  .confirm-icon svg {
    animation: scaleIn 300ms ease;
  }
  @keyframes scaleIn {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  padding: 1rem;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.logo {
  width: 44px;
  height: 44px;
  color: var(--primary);
}
.brand h1 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--primary);
}
.muted {
  color: var(--muted);
  font-size: 0.9rem;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
  cursor: pointer;
  transition: all 150ms ease;
  padding: 0;
}
.theme-toggle:hover {
  background: var(--hover-bg);
  border-color: var(--primary);
}
.theme-toggle svg {
  width: 20px;
  height: 20px;
}
.notification-btn {
  position: relative;
}
.notification-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: linear-gradient(90deg, #ef4444, #dc2626);
  color: #ffffff;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  border: 2px solid var(--card);
}
.dropdown-menu-container {
  position: relative;
  display: inline-block;
}
.menu-btn {
  position: relative;
}
.menu-btn.active {
  background: var(--hover-bg);
  border-color: var(--primary);
}
.menu-alert-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  background: #3b82f6;
  border-radius: 50%;
  border: 2px solid var(--card);
}
.menu-dropdown-list {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  width: 200px;
  padding: 0.5rem;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  animation: menuFadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes menuFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border: none;
  background: transparent;
  color: var(--text);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 150ms ease;
  text-align: left;
}
.menu-item:hover {
  background: var(--hover-bg);
  color: var(--primary);
}
.menu-item svg {
  color: var(--muted);
  transition: color 150ms ease;
}
.menu-item:hover svg {
  color: var(--primary);
}
.menu-badge {
  margin-left: auto;
  background: #3b82f6;
  color: #ffffff;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
}
.main {
  display: flex;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.panel {
  background: var(--card);
  padding: 1.2rem;
  border-radius: 12px;
  border: 2px solid var(--border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.add-panel {
  width: 320px;
  flex-shrink: 0;
}
.list-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.field {
  margin-bottom: 0.75rem;
}
.field label {
  display: block;
  margin-bottom: 0.35rem;
  color: var(--muted);
  font-size: 0.85rem;
}
.field input[type='text'],
.field input,
select {
  width: 100%;
  padding: 0.55rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
}
.date-picker-input-group {
  position: relative;
  display: flex;
  align-items: center;
}
.date-picker-input-group .date-text-input {
  width: 100% !important;
  padding-right: 2.5rem !important;
}
.date-picker-trigger {
  position: absolute;
  right: 0.45rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  transition: all 150ms ease;
}
.date-picker-trigger:hover {
  background: var(--hover-bg);
  color: var(--primary);
}
.native-date-picker {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
}
/* Inline edit controls inside course card */
.edit-input {
  width: 100%;
  padding: 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
  font-weight: 600;
}
.edit-select {
  min-width: 150px;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
}
.card-edit-controls {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.45rem;
  align-items: center;
}
.segmented {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  background: var(--input-bg);
  border: 1px solid var(--border);
  gap: 2px;
}
.segmented label {
  flex: 1;
  padding: 0.55rem;
  text-align: center;
  cursor: pointer;
  color: var(--muted);
  font-weight: 600;
  transition: all 200ms ease;
  border-radius: 6px;
}
.segmented label input {
  display: none;
}
.segmented label.active {
  color: #1a1a1a;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
/* Praktik = Kuning */
.segmented label.active:has(input[value='Praktik']) {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}
/* Non Praktik = Biru */
.segmented label.active:has(input[value='Non Praktik']) {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
}
.actions {
  display: flex;
  gap: 0.5rem;
}
.add-panel .actions .btn {
  flex: 1;
}
.btn {
  padding: 0.55rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--primary);
  cursor: pointer;
  font-weight: 600;
}
.btn.primary {
  background: linear-gradient(90deg, #42b883, #35a372);
  color: #ffffff;
  font-weight: 700;
  border: none;
  box-shadow: 0 10px 30px rgba(66, 184, 131, 0.3);
  padding: 0.65rem 1rem;
  font-size: 1rem;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
}

.btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px rgba(66, 184, 131, 0.4);
}

.btn.primary:focus {
  outline: 3px solid rgba(66, 184, 131, 0.3);
}

/* Make save button in add panel full width and clearly visible */
.add-panel .btn.primary {
  width: 100%;
  display: block;
}

/* Make edit/save in card more prominent */
.card-edit-controls .btn.primary {
  min-width: 90px;
  padding: 0.55rem 0.9rem;
}

/* Disabled state */
.btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.btn.ghost {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
}

/* Button Success - Hijau */
.btn-success {
  background: linear-gradient(90deg, #10b981, #059669);
  color: #ffffff;
  font-weight: 700;
  border: none;
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
}

.btn-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(16, 185, 129, 0.4);
}

/* Button Danger - Merah */
.btn-danger {
  background: linear-gradient(90deg, #ef4444, #dc2626);
  color: #ffffff;
  font-weight: 700;
  border: none;
  box-shadow: 0 8px 24px rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(239, 68, 68, 0.4);
}

/* Button Secondary - Abu-abu */
.btn-secondary {
  background: linear-gradient(90deg, #6b7280, #4b5563);
  color: #ffffff;
  font-weight: 700;
  border: none;
  box-shadow: 0 8px 24px rgba(107, 114, 128, 0.3);
}

.btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(107, 114, 128, 0.4);
}

/* Button Info - Biru */
.btn-info {
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  color: #ffffff;
  font-weight: 700;
  border: none;
  box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
}

.btn-info:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(59, 130, 246, 0.4);
}

.btn-info.ghost {
  background: transparent;
  border: 1px solid #3b82f6;
  color: #3b82f6;
  box-shadow: none;
}

.btn-info.ghost:hover {
  background: rgba(59, 130, 246, 0.1);
  transform: none;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}
.add-panel .btn.primary {
  width: 100%;
}
.card {
  background: var(--card);
  padding: 1.2rem;
  border-radius: 12px;
  border: 2px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: all 200ms ease;
}
.card:hover {
  border-color: rgba(66, 184, 131, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  transform: translateY(-2px);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.course-name {
  margin: 0 0 0.3rem 0;
  color: var(--text-secondary);
  font-size: 1.05rem;
  font-weight: 600;
}
.meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.badge {
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.badge.primary {
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
  color: #1a1a1a;
  font-weight: 700;
}
.badge.accent {
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  color: #ffffff;
  font-weight: 700;
}
.card-actions {
  display: flex;
  gap: 0.5rem;
}
.icon {
  background: var(--icon-bg);
  border: 1px solid var(--border);
  padding: 0.4rem;
  border-radius: 8px;
  cursor: pointer;
  color: var(--muted);
  transition: all 150ms ease;
}
.icon:hover {
  background: var(--hover-bg);
}
/* Icon Add - Biru */
.icon-add {
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}
.icon-add:hover {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.5);
  color: #60a5fa;
}
/* Icon Edit - Hijau */
.icon-edit {
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}
.icon-edit:hover {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.5);
  color: #34d399;
}
/* Icon Delete - Merah */
.icon-delete {
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}
.icon-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}
.icon.danger {
  border-color: rgba(248, 113, 113, 0.3);
  color: var(--danger);
}
.progress {
  height: 10px;
  background: var(--input-bg);
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}
.progress .bar {
  height: 100%;
  background: linear-gradient(90deg, #42b883, #35a372);
  width: 0;
  transition: width 300ms ease;
  box-shadow: 0 0 10px rgba(66, 184, 131, 0.5);
}
.todo-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.todo-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  transition: all 150ms ease;
  border: 1px solid transparent;
}
.todo-list li:hover {
  background: var(--hover-bg);
  border-color: rgba(66, 184, 131, 0.2);
}
.todo-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}
.todo-content {
  display: flex;
  flex-direction: column;
  gap: 0;
  flex: 1;
}
.todo-item .title {
  font-weight: 500;
}
.todo-meta {
  display: block;
  font-size: 0.75rem;
  margin-top: 0.3rem;
}
.todo-item .due-date {
  color: var(--muted);
  font-style: italic;
  display: block;
}
.nilai-badge {
  background-color: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid rgba(59, 130, 246, 0.4);
  font-weight: 600;
  font-size: 0.8rem;
  display: inline-block;
  margin-top: 0.3rem;
  margin-bottom: 0.3rem;
}
.todo-item input {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  cursor: pointer;
}
.todo-item input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.todo-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: space-between;
  margin-bottom: 0.3rem;
}
.completion-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}
.completion-badge.on-time {
  background-color: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.4);
}
.completion-badge.over-due {
  background-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.4);
}
.todo-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 150ms ease;
}
.todo-list li:hover .todo-actions {
  opacity: 1;
}
.icon-small {
  background: var(--icon-bg);
  border: 1px solid var(--border);
  padding: 0.3rem;
  border-radius: 6px;
  cursor: pointer;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}
.icon-small:hover {
  background: var(--hover-bg);
  color: var(--text);
}
/* Icon-small Edit - Hijau */
.icon-small.icon-edit {
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}
.icon-small.icon-edit:hover {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.5);
  color: #34d399;
}
/* Icon-small Delete - Merah */
.icon-small.icon-delete {
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}
.icon-small.icon-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}
.icon-small.icon-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.icon-small.danger:hover {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}
.todo-list li.done .title {
  opacity: 0.6;
  text-decoration: line-through;
}
.empty {
  padding: 1.2rem;
  color: var(--muted);
}

@media (max-width: 900px) {
  .main {
    flex-direction: column;
  }
  .add-panel {
    width: 100%;
  }
}

.notification-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-bg);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 1rem;
  z-index: 50;
  backdrop-filter: blur(4px);
}

.notification-panel {
  width: 100%;
  max-width: 420px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  margin-top: 60px;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.notification-header h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 150ms ease;
}

.close-btn:hover {
  background: var(--hover-bg);
}

.notification-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--muted);
}

.notification-list {
  overflow-y: auto;
  flex: 1;
}

.notification-item {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  transition: all 150ms ease;
  cursor: pointer;
}

.notification-item:hover {
  background: var(--hover-bg);
  border-left: 3px solid var(--primary);
  padding-left: calc(1rem - 3px);
}

.notification-item.approaching-deadline {
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #ef4444;
  padding-left: calc(1rem - 3px);
}

.notification-item.approaching-deadline:hover {
  background: rgba(239, 68, 68, 0.15);
  border-left-color: #f87171;
}

.item-title-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.notification-item:last-child {
  border-bottom: none;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.notification-item .course-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--primary);
  margin: 0;
}

.days-left {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
  color: #1a1a1a;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.urgent-badge {
  background: linear-gradient(90deg, #ef4444, #dc2626);
  color: #ffffff;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  display: inline-block;
}

.task-title {
  margin: 0.5rem 0;
  color: var(--text);
  font-weight: 500;
  word-break: break-word;
}

.notification-item .due-date {
  color: var(--muted);
  font-style: italic;
  font-size: 0.8rem;
}

.pinned-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-bg);
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 1rem;
  z-index: 50;
  backdrop-filter: blur(4px);
}

.pinned-panel {
  width: 100%;
  max-width: 420px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  margin-top: 60px;
  margin-right: 50px;
}

.pinned-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.pinned-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #3b82f6;
}

.pinned-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--muted);
}

.pinned-list {
  overflow-y: auto;
  flex: 1;
}

.pinned-item {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  transition: all 150ms ease;
  cursor: pointer;
}

.pinned-item:hover {
  background: var(--hover-bg);
  border-left: 3px solid #3b82f6;
  padding-left: calc(1rem - 3px);
}

.pinned-item:last-child {
  border-bottom: none;
}

.pinned-item .course-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #3b82f6;
  margin: 0;
}

.pinned-item .task-title {
  margin: 0.5rem 0;
  color: var(--text);
  font-weight: 500;
  word-break: break-word;
}

.pinned-item .due-date {
  color: var(--muted);
  font-style: italic;
  font-size: 0.8rem;
}

/* =========================================
   Mobile Responsiveness & Friendly UI
   ========================================= */
@media (max-width: 768px) {
  /* Stack layout vertically on small screens */
  .main {
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Make add panel take full width and appear on top */
  .add-panel {
    width: 100%;
    order: -1;
  }

  /* Sleek horizontal row layout for mobile topbar */
  .topbar {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    width: 100%;
  }

  .brand {
    gap: 0.5rem;
  }

  .brand h1 {
    font-size: 1.2rem;
  }

  .logo {
    width: 36px;
    height: 36px;
  }

  /* Keep header actions next to each other on the right */
  .header-actions {
    width: auto;
    justify-content: flex-end;
  }

  /* Increase padding for touch targets */
  .btn, .icon, .theme-toggle {
    min-height: 44px; /* Apple Human Interface Guidelines minimum touch target */
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .btn.primary {
    padding: 0.85rem 1.25rem;
  }

  /* Adjust modals and overlays to center correctly on mobile */
  .pinned-overlay, .notification-overlay, .modal-container {
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .pinned-panel, .notification-panel, .modal-content {
    width: 100%;
    max-width: none;
    margin: 0;
    max-height: 85vh;
  }
  
  /* Slightly larger fonts for readability on mobile */
  h1 {
    font-size: 1.75rem;
  }
  
  h3 {
    font-size: 1.3rem;
  }
}
</style>
