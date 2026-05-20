/**
 * One-time migration script: Upload data.json to Firebase Firestore.
 *
 * Prerequisites:
 * 1. Create a Firebase project at https://console.firebase.google.com/
 * 2. Go to Project Settings > Service accounts > Generate new private key
 * 3. Save the JSON file as `serviceAccountKey.json` in the project root
 * 4. Make sure Firestore is enabled in your Firebase project
 *
 * Usage:
 *   node scripts/migrate-to-firebase.js
 */

import { readFileSync } from 'fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Load service account key
const serviceAccountPath = path.join(rootDir, 'serviceAccountKey.json')
let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
} catch {
  console.error('❌ File serviceAccountKey.json tidak ditemukan!')
  console.error('   Download dari Firebase Console > Project Settings > Service accounts')
  console.error(`   Simpan di: ${serviceAccountPath}`)
  process.exit(1)
}

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()

// Load existing data
const dataPath = path.join(rootDir, 'data.json')
let data
try {
  data = JSON.parse(readFileSync(dataPath, 'utf8'))
} catch {
  console.error('❌ File data.json tidak ditemukan!')
  process.exit(1)
}

console.log(`📦 Ditemukan ${data.length} mata kuliah di data.json`)
console.log('🚀 Memulai migrasi ke Firestore...\n')

for (const course of data) {
  const docId = String(course.id)
  try {
    await db.collection('courses').doc(docId).set(course)
    console.log(`  ✅ ${course.name} (${course.todos.length} todos)`)
  } catch (err) {
    console.error(`  ❌ Gagal upload "${course.name}":`, err.message)
  }
}

console.log('\n✨ Migrasi selesai!')
console.log('   Cek data di: https://console.firebase.google.com/ > Firestore Database')
