# Harbor Board

A small demo of the modern way to load JSON list data into a page **once**, then serve it from cache.

The board is a harbor notice list. The first visit fetches `/data/items.json` (the demo adds a short delay so the wait is obvious). That response is stored with the **Cache API**. Every later visit paints the `<ul>` from cache, usually in a couple of milliseconds.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43141

```bash
npm run build
npm run preview
```

## What to use

| Approach | When it is the right tool |
| --- | --- |
| **Cache API + stale-while-revalidate** (this demo) | Separate JSON file, instant repeat visits, keep the list fresh in the background |
| **Cache-first** | You truly want the network only on the first visit |
| **HTTP `Cache-Control`** | Static files on a CDN. The browser cache is free and very fast. Pair it with the Cache API if you need JS control or offline |
| **Inline JSON / render the list at build time** | Fastest of all: no runtime fetch. Use `<script type="application/json">` or generate the `<ul>` when you build |
| **IndexedDB** | Large lists you need to query or page through |
| **`localStorage`** | Avoid. Synchronous, string-only, small quota |

Do not put a static `<link rel="preload">` on the JSON file if you want cache-first behavior. Preload would hit the network on every visit. This page only preloads when the cache is empty.

## How the load path works

```ts
const cache = await caches.open("harbor-board-v1");
const cached = await cache.match("/data/items.json");

if (cached) {
  const data = await cached.json();
  if (strategy === "swr") {
    fetch("/data/items.json").then((res) => cache.put("/data/items.json", res));
  }
  return data; // paint the list now
}

const res = await fetch("/data/items.json");
cache.put("/data/items.json", res.clone());
return res.json();
```

The demo sets `Cache-Control: no-store` on the JSON in development so the **Cache API** is what you are measuring, not the HTTP disk cache. In production, send a long `max-age` (and `stale-while-revalidate`) on the JSON as well.

## Deploy

This is a static Vite app. Any static host works. For Vercel, the default build command is `npm run build` and the output directory is `dist`.
