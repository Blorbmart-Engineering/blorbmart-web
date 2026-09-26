/* ═══════════════════════════════════════════════════════════════════════
   Runtime configuration.

   Firebase web config is not a secret (it ships in every client bundle by
   design — Firestore rules are the real boundary). It still lives in env so
   staging/prod can differ without a code change, and so nobody is tempted to
   paste a *server* key next to it.
   ═══════════════════════════════════════════════════════════════════════ */

const env = import.meta.env

function required(key: string, value: string | undefined, fallback: string): string {
  if (value && value.length) return value
  if (import.meta.env.PROD) {
    // Loud in prod builds, but never crash a customer's checkout over it.
    console.error(`[config] Missing ${key}. Falling back to the bundled default.`)
  }
  return fallback
}

/** Matches DefaultFirebaseOptions.web in the app's firebase_options.dart. */
export const FIREBASE_CONFIG = {
  apiKey: required('VITE_FIREBASE_API_KEY', env.VITE_FIREBASE_API_KEY, 'AIzaSyAGGDTIx4YY8_7cwuPBDkJV-plZpr-IhWs'),
  authDomain: required('VITE_FIREBASE_AUTH_DOMAIN', env.VITE_FIREBASE_AUTH_DOMAIN, 'blorbmart-b29b7.firebaseapp.com'),
  projectId: required('VITE_FIREBASE_PROJECT_ID', env.VITE_FIREBASE_PROJECT_ID, 'blorbmart-b29b7'),
  storageBucket: required('VITE_FIREBASE_STORAGE_BUCKET', env.VITE_FIREBASE_STORAGE_BUCKET, 'blorbmart-b29b7.firebasestorage.app'),
  messagingSenderId: required('VITE_FIREBASE_SENDER_ID', env.VITE_FIREBASE_SENDER_ID, '840596799490'),
  appId: required('VITE_FIREBASE_APP_ID', env.VITE_FIREBASE_APP_ID, '1:840596799490:web:b4b2e30afc4efedbe6671b'),
  measurementId: 'G-69KR0F5PCS',
}

/**
 * The API host.
 *
 * This is `BLORB_API` in the Flutter app's api_client.dart, and the two must
 * name the same host. They did not: the web build shipped pointed at
 * `blorbmart.onrender.com`, which answers 404 to every path including
 * /health, so every wallet read, bill purchase and checkout call from the
 * web app failed while the identical call from the phone succeeded. The live
 * deployment is, and has only ever been, blorbmart-tr1i.
 */
export const API_BASE_URL = required(
  'VITE_API_BASE_URL',
  env.VITE_API_BASE_URL,
  'https://blorbmart-tr1i.onrender.com',
)

/** Only these hosts may receive a Firebase ID token. */
export const TRUSTED_API_ORIGINS = [new URL(API_BASE_URL).origin]

/**
 * Web push certificate (public key).
 *
 * The public half of the VAPID pair; it ships inside the client bundle by
 * design — it identifies the sender to the push service and is not a secret.
 * The private half stays in the Firebase console. Issued per project, so it
 * is the same key the rider app uses.
 */
export const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY ??
  'BGVY6js1W1Fo9V9ZYLn3JRJSFQPZZQfkbq8s7qaNepfaCdqUrMQX6HBTLco-Ok-YOPe_blzFJo0yZly4BhY_K8U'

/**
 * Mapbox public token (pk.…) for the live rider map on the tracking screen.
 *
 * Public by design, like the Firebase config — restrict it to the shop's
 * URLs in the Mapbox dashboard instead of hiding it. Without one the map is
 * simply not drawn and the ETA card carries the screen as before.
 */
export const MAPBOX_TOKEN =
  env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiYmxvcmJtYXJ0IiwiYSI6ImNtdWlkeG4zcDByMjcyeXF5MTEyNzIwamwifQ.8q2zSysrgCJXr3vsObBFvQ'

/** Image hosts we are willing to render. Anything else gets the placeholder. */
export const ALLOWED_IMAGE_HOSTS = [
  'res.cloudinary.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'lh3.googleusercontent.com',
  'images.unsplash.com',
]

export const IS_DEV = import.meta.env.DEV

/** Matches `version` in the app's pubspec.yaml, for device-token records. */
export const APP_VERSION = '1.0.6+8'
