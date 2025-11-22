import { useEffect, useState } from 'react'

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications')
      return
    }

    // Get current permission status
    setPermission(Notification.permission)

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered:', reg)
          setRegistration(reg)

          // Force update check
          reg.update().then(() => {
            console.log('Service Worker update check completed')
          })

          // Listen for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            console.log('New service worker found, installing...')

            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New service worker installed, will be active on next page load')
                  // Skip waiting to activate immediately
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                }
              })
            }
          })
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err)
        })

      // Reload page when new service worker takes control
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service Worker controller changed, reloading page...')
        window.location.reload()
      })
    }
  }, [])

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
  }

  const showNotification = async (title: string, options?: NotificationOptions) => {
    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted')
      return
    }

    if (registration) {
      // Show notification through service worker
      await registration.showNotification(title, {
        ...options,
        icon: options?.icon || '/favicon.ico',
        badge: options?.badge || '/favicon.ico',
        requireInteraction: true,
      })
    } else {
      // Fallback to basic notification
      new Notification(title, options)
    }
  }

  return {
    permission,
    requestPermission,
    showNotification,
    isSupported: typeof window !== 'undefined' && 'Notification' in window,
  }
}
