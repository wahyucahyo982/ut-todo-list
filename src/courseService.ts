import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from './firebase'

export type Todo = {
  id: number
  title: string
  done: boolean
  dueDate?: string
  completedDate?: string
  nilai?: number
}

export type Course = {
  id: number
  name: string
  type: 'Praktik' | 'Non Praktik'
  todos: Todo[]
}

const COLLECTION_NAME = 'courses'

/**
 * Fetch all courses from Firestore.
 */
export async function fetchAllCourses(): Promise<Course[]> {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME))
  const courses: Course[] = []
  snapshot.forEach((docSnap) => {
    courses.push(docSnap.data() as Course)
  })
  return courses
}

/**
 * Helper to recursively remove all undefined properties from an object or array.
 * Firestore does not support 'undefined' field values.
 */
function cleanObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanObject(value);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Add a new course to Firestore.
 * Uses the course.id (number) converted to string as the document ID
 * so we can look it up easily later.
 */
export async function addCourse(course: Course): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, String(course.id))
  await setDoc(docRef, cleanObject(course))
}

/**
 * Update an existing course in Firestore.
 * We use setDoc with merge to ensure the full document is replaced,
 * which is simpler and safer for our nested todos array.
 */
export async function updateCourse(course: Course): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, String(course.id))
  // Use setDoc (not updateDoc) to fully replace the document,
  // ensuring the todos array is always written in its entirety.
  await setDoc(docRef, cleanObject(course))
}

/**
 * Delete a course from Firestore by its numeric ID.
 */
export async function deleteCourseById(id: number): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, String(id))
  await deleteDoc(docRef)
}
