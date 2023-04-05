self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open('my-app-cache').then(function (cache) {
            return cache.addAll([
                '/',
                '/stylesheets/main.css',
                // '/stylesheets/main.js',
                '/images/malpani-logo-2020.webp'
            ]);
        })
    );
});

self.addEventListener('fetch', function (event) {
    event.respondWith(
        caches.match(event.request).then(function (response) {
            return response || fetch(event.request);
        })
    );
});