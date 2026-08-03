import { supabase } from '../supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// True only where web push can actually work (SW + PushManager + Notification).
export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// Is this device currently subscribed AND permission granted?
export async function getPushEnabled() {
  if (!pushSupported()) return false
  if (Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

// Request permission, subscribe, and persist the subscription. Returns true on success.
export async function subscribeToPush() {
  if (!pushSupported()) throw new Error('Notifications aren’t supported on this device/browser.')
  if (!VAPID_PUBLIC_KEY) throw new Error('Push is not configured yet.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const json = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      { onConflict: 'endpoint' }
    )
  if (error) throw error
  return true
}

// Unsubscribe this device and remove its stored row.
export async function unsubscribeFromPush() {
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    /* best effort */
  }
}

// Fire-and-forget notification to the rest of the household. Never throws.
export function notifyHousehold(type, payload = {}) {
  supabase.functions
    .invoke('notify-household', { body: { type, ...payload } })
    .catch(() => {})
}
