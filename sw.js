

const CACHE_NAME = 'molintas-water-v1.0.0';
const urlsToCache = [
    '/',
    '/app/index.html',
    '/app/styles/main.css',
    '/app/styles/components.css',
    '/app/styles/responsive.css',
    '/app/js/utils.js',
    '/app/js/store.js',
    '/app/js/components.js',
    '/app/js/app.js',
    '/app/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://unpkg.com/lucide@latest/dist/umd/lucide.js'
];


self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Failed to cache resources:', error);
            })
    );

    self.skipWaiting();
});


self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );

    self.clients.claim();
});


self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {

                return response || fetch(event.request)
                    .then((fetchResponse) => {

                        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                            return fetchResponse;
                        }


                        const responseToCache = fetchResponse.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return fetchResponse;
                    })
                    .catch(() => {

                        if (event.request.destination === 'document') {
                            return caches.match('/app/index.html');
                        }
                    });
            })
    );
});


self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});


async function doBackgroundSync() {
    try {

        const pendingData = await getPendingData();
        if (pendingData.length > 0) {
            await syncPendingData(pendingData);

            notifyClients('Data synchronized successfully');
        }
    } catch (error) {
        console.error('Background sync failed:', error);
        notifyClients('Background sync failed. Please try again.');
    }
}


async function getPendingData() {

    return [];
}


async function syncPendingData(data) {

    console.log('Syncing data:', data);
}


async function notifyClients(message) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'SYNC_STATUS',
            message: message
        });
    });
}


self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/app/icons/icon-192x192.png',
        badge: '/app/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: data.primaryKey || '1'
        },
        actions: [
            {
                action: 'explore',
                title: 'View Details',
                icon: '/app/icons/checkmark.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/app/icons/xmark.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Molintas Water Services', options)
    );
});


self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {

        event.waitUntil(
            clients.openWindow('/app/')
        );
    } else if (event.action === 'close') {

        return;
    } else {

        event.waitUntil(
            clients.openWindow('/app/')
        );
    }
});


self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});


self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
        event.waitUntil(syncContent());
    }
});


async function syncContent() {
    try {

        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        
        for (const request of requests) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response);
                }
            } catch (error) {
                console.warn('Failed to update cached resource:', request.url);
            }
        }
    } catch (error) {
        console.error('Content sync failed:', error);
    }
}