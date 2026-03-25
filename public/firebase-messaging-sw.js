// Firebase Cloud Messaging Service Worker
// This file MUST be named firebase-messaging-sw.js and in the /public folder

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDOOlKD6kaX92b805M73jz9Ceodagffqj0",
  authDomain: "twitter-clone-app-16eb3.firebaseapp.com",
  projectId: "twitter-clone-app-16eb3",
  storageBucket: "twitter-clone-app-16eb3.firebasestorage.app",
  messagingSenderId: "249903575848",
  appId: "1:249903575848:web:9d1f7443118293a6cf161d"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'JD — New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: payload.data?.type || 'general',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click handler — open the app when notification is clicked
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  if (data?.type === 'message') {
    url = `/messages/${data.conversationId}`;
  } else if (data?.type === 'follow') {
    url = `/profile/${data.followerId || data.fromUserId}`;
  } else if (data?.type === 'post') {
    url = `/`; // Or a specific tweet page if available, e.g., `/tweet/${data.tweetId}`
  } else if (data?.type === 'like' || data?.type === 'retweet' || data?.type === 'comment') {
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
