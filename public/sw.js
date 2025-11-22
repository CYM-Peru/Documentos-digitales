// Service Worker for Push Notifications - Mobile Optimized
const SW_VERSION = 'v2.3.0'

console.log(`Service Worker ${SW_VERSION} loading...`)

self.addEventListener('install', (event) => {
  console.log(`Service Worker ${SW_VERSION} installing...`)
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('SKIP_WAITING message received')
    self.skipWaiting()
  }
})

self.addEventListener('notificationclick', (event) => {
  console.log('📱 Notification clicked!', event.notification.tag)
  console.log('📱 User Agent:', navigator.userAgent)

  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'
  console.log('📍 Target path:', urlToOpen)

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      console.log('📊 Found', windowClients.length, 'window clients')

      // Priority 1: Try to focus existing window
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i]
        console.log('🔍 Checking client:', client.url)

        // Focus any window from our app
        if (client.url.indexOf(self.registration.scope) >= 0) {
          console.log('✅ Focusing existing window')
          return client.focus().then(focusedClient => {
            // Send message to navigate
            console.log('📤 Sending navigation message to client')
            focusedClient.postMessage({
              type: 'NAVIGATE',
              url: urlToOpen
            })
            return focusedClient
          })
        }
      }

      // Priority 2: Open new window with full URL
      console.log('🆕 Opening new window')
      const fullUrl = new URL(urlToOpen, self.location.origin).href
      console.log('🔗 Full URL:', fullUrl)

      return clients.openWindow(fullUrl).then(newClient => {
        console.log('✅ New window opened:', newClient ? 'success' : 'failed')
        return newClient
      }).catch(error => {
        console.error('❌ Error opening window:', error)
        // Last resort: try with just origin
        return clients.openWindow(self.location.origin)
      })
    })
  )
})

self.addEventListener('push', (event) => {
  console.log('📬 Push received')

  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Notificación'
  const options = {
    body: data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.tag || 'notification',
    requireInteraction: true,
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200], // Vibration pattern for mobile
    actions: [
      {
        action: 'open',
        title: 'Abrir'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclose', (event) => {
  console.log('🔕 Notification closed:', event.notification.tag)
})

console.log(`Service Worker ${SW_VERSION} loaded`)
