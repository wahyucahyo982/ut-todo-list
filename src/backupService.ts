import { addCourse, deleteCourseById, type Course, type Todo } from './courseService'

export interface BackupMetadata {
  app: string
  version: number
  backupDate: string
  totalCourses: number
}

export interface BackupPayload {
  app: string
  version: number
  backupDate: string
  totalCourses: number
  courses: Course[]
}

/**
 * Memeriksa apakah suatu mata kuliah memiliki progress 100%
 * (memiliki task dan semua task-nya sudah selesai).
 */
export function isCourseCompleted(course: Course): boolean {
  return (
    Array.isArray(course.todos) &&
    course.todos.length > 0 &&
    course.todos.every((todo) => todo.done)
  )
}

/**
 * Menghitung progress penyelesaian mata kuliah
 */
export function getCourseProgress(course: Course): {
  completed: number
  total: number
  percent: number
} {
  const total = Array.isArray(course.todos) ? course.todos.length : 0
  const completed = Array.isArray(course.todos) ? course.todos.filter((t) => t.done).length : 0
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return { completed, total, percent }
}

/**
 * Mengambil semua mata kuliah yang memiliki progress 100%.
 */
export function getCompletedCourses(courses: Course[]): Course[] {
  return courses.filter(isCourseCompleted)
}

/**
 * Menghasilkan file JSON dari data mata kuliah yang dipilih dan men-download-nya.
 * Nama file dapat diisi sesuai input user.
 */
export function exportCoursesToJson(courses: Course[], userFileName: string): string {
  let cleanName = userFileName.trim()
  if (!cleanName) {
    const today = new Date().toISOString().slice(0, 10)
    cleanName = `backup-matkul-${today}`
  }

  // Pastikan ekstensi .json
  if (!cleanName.toLowerCase().endsWith('.json')) {
    cleanName += '.json'
  }

  const payload: BackupPayload = {
    app: 'ut-todo-list',
    version: 1,
    backupDate: new Date().toISOString(),
    totalCourses: courses.length,
    courses: courses,
  }

  const jsonString = JSON.stringify(payload, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const downloadLink = document.createElement('a')
  downloadLink.href = url
  downloadLink.download = cleanName
  document.body.appendChild(downloadLink)
  downloadLink.click()
  document.body.removeChild(downloadLink)
  URL.revokeObjectURL(url)

  return cleanName
}

/**
 * Membaca dan memvalidasi isi string JSON dari file backup.
 * Mendukung format { courses: [...] } ataupun array langsung [...].
 */
export function parseAndValidateBackupFile(jsonString: string): Course[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch {
    throw new Error('Format file tidak valid. Pastikan file bertipe JSON yang valid.')
  }

  let rawList: unknown[] = []
  if (Array.isArray(parsed)) {
    rawList = parsed
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    'courses' in parsed &&
    Array.isArray((parsed as { courses: unknown[] }).courses)
  ) {
    rawList = (parsed as { courses: unknown[] }).courses
  } else {
    throw new Error(
      'Struktur data JSON tidak dikenali. Harus berupa array mata kuliah atau memiliki daftar "courses".',
    )
  }

  if (rawList.length === 0) {
    throw new Error('File JSON tidak berisi data mata kuliah.')
  }

  const validCourses: Course[] = []

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i]
    if (!item || typeof item !== 'object') continue

    const record = item as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name.trim() : ''
    if (!name) continue

    const type: 'Praktik' | 'Non Praktik' =
      record.type === 'Non Praktik' ? 'Non Praktik' : 'Praktik'

    const id = typeof record.id === 'number' ? record.id : Date.now() + i

    const todosArray = Array.isArray(record.todos) ? record.todos : []
    const cleanedTodos: Todo[] = todosArray.map((todoItem: unknown, tIdx: number) => {
      const t = (todoItem && typeof todoItem === 'object' ? todoItem : {}) as Record<
        string,
        unknown
      >
      const todo: Todo = {
        id: typeof t.id === 'number' ? t.id : Date.now() + i * 100 + tIdx,
        title: typeof t.title === 'string' && t.title.trim() ? t.title.trim() : `Task ${tIdx + 1}`,
        done: Boolean(t.done),
      }
      if (t.dueDate) todo.dueDate = String(t.dueDate)
      if (t.completedDate) todo.completedDate = String(t.completedDate)
      if (typeof t.nilai === 'number' && !isNaN(t.nilai)) todo.nilai = t.nilai
      return todo
    })

    validCourses.push({
      id,
      name,
      type,
      todos: cleanedTodos,
    })
  }

  if (validCourses.length === 0) {
    throw new Error('Tidak ditemukan data mata kuliah yang valid dalam file.')
  }

  return validCourses
}

/**
 * Menyimpan data mata kuliah yang diimpor ke Firestore.
 * Jika replaceAll bernilai true, data lama akan dihapus terlebih dahulu.
 * Jika false (merge), data yang memiliki ID sama akan diperbarui, yang baru akan ditambahkan.
 */
export async function importCoursesToDatabase(
  coursesToImport: Course[],
  existingCourses: Course[],
  replaceAll: boolean = false,
): Promise<Course[]> {
  if (replaceAll) {
    // Hapus semua data yang ada di Firestore
    for (const course of existingCourses) {
      await deleteCourseById(course.id)
    }

    // Simpan semua data yang diimpor
    for (const course of coursesToImport) {
      await addCourse(course)
    }

    return [...coursesToImport]
  } else {
    // Mode gabungkan (Merge/Update)
    const resultMap = new Map<number, Course>()

    // Masukkan data existing terlebih dahulu
    for (const c of existingCourses) {
      resultMap.set(c.id, { ...c })
    }

    // Masukkan atau timpa dengan data import
    for (const course of coursesToImport) {
      await addCourse(course)
      resultMap.set(course.id, { ...course })
    }

    return Array.from(resultMap.values())
  }
}
