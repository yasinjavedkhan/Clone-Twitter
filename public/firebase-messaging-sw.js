// Firebase Cloud Messaging Service Worker
// This file MUST be named firebase-messaging-sw.js and in the /public folder

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBlBMXbCnOCR4CivWedIuYQvnJIRyJHdkU",
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
  const isCall = data.type === 'call';
  
  const notificationTitle = payload.notification?.title || (isCall ? 'Incoming Call' : 'New Notification');
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data,
    vibrate: isCall ? [500, 200, 500, 200, 500, 200, 500] : [200, 100, 200],
    requireInteraction: isCall,
    tag: isCall ? `call-${data.roomName}` : (data.type || 'general'),
    actions: isCall ? [
      { action: 'answer', title: 'Answer', icon: '/icon-192.png' },
      { action: 'decline', title: 'Decline', icon: '/icon-192.png' }
    ] : []
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Click handler — open the app when notification is clicked
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const data = event.notification.data;
  const action = event.action; // 'answer' or 'decline' or undefined

  let url = '/';
  
  if (data?.type === 'call') {
    if (action === 'decline') {
       // Ideally would call an API, but for now just click away
       return;
    }
    // Answer or main click: Join the call
    url = `/messages/${data.conversationId}?call=true&type=${data.callType}&room=${data.roomName}`;
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
