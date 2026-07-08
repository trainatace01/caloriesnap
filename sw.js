/* ============ CalorieSnap service worker ============
   Precaches the app shell + food photos so the installed app opens
   instantly and works offline. CDN libraries and the AI model weights
   are cached at runtime, so after one online scan the AI works offline too.
   Bump CACHE_VERSION whenever app files change to roll out updates.
*/

const CACHE_VERSION = "caloriesnap-v4";
const RUNTIME_CACHE = "caloriesnap-runtime-v1";

const FOOD_IMAGES = [
  "fried-rice", "sweet-sour-pork", "dumplings", "chow-mein", "spring-rolls", "kung-pao", "wonton-soup",
  "nasi-lemak", "satay", "mee-goreng", "rendang", "nasi-goreng", "laksa", "roti-john",
  "biryani", "butter-chicken", "roti-prata", "tandoori", "palak-paneer", "samosa", "dal-curry",
  "cheeseburger", "hot-dog", "fried-chicken", "mac-cheese", "bbq-ribs", "meatloaf", "pancakes", "french-fries",
  "pizza", "spaghetti-bolognese", "carbonara", "lasagna", "risotto", "tiramisu", "minestrone",
  "burrito", "tacos", "quesadilla", "nachos", "guacamole", "enchiladas", "fajitas",
  "sushi", "sashimi", "ramen", "pad-thai", "tom-yum", "bibimbap", "fish-chips", "kimchi-fried-rice",
  "caesar-salad", "greek-salad", "grilled-chicken", "fruit-bowl", "quinoa-bowl", "salmon-broccoli",
  "avocado-toast", "smoothie-bowl",
].map(id => `images/${id}.jpg`);

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "js/data.js",
  "js/classifier.js",
  "js/nutrition.js",
  "js/barcode.js",
  "js/charts.js",
  "js/app.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  ...FOOD_IMAGES,
];

// Hosts whose responses we cache at runtime (libraries + model weights).
// Model URLs carry rotating signed query strings, hence ignoreSearch below.
const RUNTIME_HOSTS = ["cdn.jsdelivr.net", "storage.googleapis.com"];
// Live-data APIs — always go to the network.
const NETWORK_ONLY_HOSTS = ["openfoodfacts.org", "api.nal.usda.gov"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION && k !== RUNTIME_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (NETWORK_ONLY_HOSTS.some(h => url.hostname.endsWith(h))) return;

  if (url.origin === self.location.origin) {
    // App shell: cache-first, backfill from network.
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(hit =>
        hit || fetch(event.request).then(resp => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_VERSION).then(c => c.put(event.request, copy));
          }
          return resp;
        })
      )
    );
    return;
  }

  if (RUNTIME_HOSTS.some(h => url.hostname.endsWith(h))) {
    // Libraries + AI model: cache-first keyed without the (signed) query string.
    const key = url.origin + url.pathname;
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(cache =>
        cache.match(key).then(hit =>
          hit || fetch(event.request).then(resp => {
            if (resp.ok) cache.put(key, resp.clone());
            return resp;
          })
        )
      )
    );
  }
});
