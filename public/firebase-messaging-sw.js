// Firebase Cloud Messaging Service Worker
// This file MUST be named firebase-messaging-sw.js and in the /public folder

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBsyrXL6a8_vAh1UKbxRVy7skEjqBI4OZA",
  authDomain: "twitter-clone-app-16eb3.firebaseapp.com",
  projectId: "twitter-clone-app-16eb3",
  storageBucket: "twitter-clone-app-16eb3.firebasestorage.app",
  messagingSenderId: "249903575848",
  appId: "1:249903575848:web:9d1f7443118293a6cf161d"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log('[SW] Firebase Messaging Initialized (v29)');
}

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', payload);

  const data = payload.data || {};
  
  // Handle call notifications specifically
  if (data.type === 'call') {
    const title = `📞 Incoming ${data.callType || 'Video'} Call`;
    const options = {
      body: `${data.fromUserName || 'Someone'} is calling you...`,
      icon: data.fromUserAvatar || '/icon-192.png',
      badge: '/icon-192.png',
      data: data,
      vibrate: [200, 100, 200, 100, 200, 100, 500],
      requireInteraction: true,
      renotify: true,
      tag: 'incoming-call',
      actions: [
        { action: 'accept', title: '✅ Accept' },
        { action: 'decline', title: '❌ Decline' }
      ]
    };
    return self.registration.showNotification(title, options);
  }

  // Standard notification handling
  const notificationTitle = payload.notification?.title || 'JD — New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: data.type || 'general',
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click handler — open the app when notification is clicked
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked. Action:', event.action);
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  // Handle specific actions for calls
  if (data?.type === 'call') {
    if (event.action === 'decline') {
      // In a real app, we might want to ping an API to decline the call here
      return;
    }
    // For 'accept' or clicking the notification itself, open the chat
    url = `/messages/${data.conversationId}?action=joining&room=${data.roomName}`;
  } else if (data?.type === 'message') {
    url = `/messages/${data.conversationId}`;
  } else if (data?.type === 'follow') {
    url = `/profile/${data.followerId || data.fromUserId}`;
  } else if (data?.type === 'post') {
    url = `/`; 
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
