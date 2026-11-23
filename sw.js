// Fish Room installable app shell. No fish records, passwords or API responses are cached.
const CACHE_NAME='fishroom-shell-2026-11-23-v1';
const BASE='/My-fish-room/';
const SHELL=[BASE+'manifest.webmanifest',BASE+'fishroom-icon.svg'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fishroom-shell-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
 // Never intercept shop pages or endpoints, and never persist the logged-in app HTML.
 if(url.pathname.startsWith(BASE+'trade/')||url.pathname.startsWith(BASE+'trade-check/'))return;
 if(url.pathname===BASE||url.pathname===BASE+'index.html')return;
 if(!SHELL.includes(url.pathname))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(c=>c.put(request,copy)));}
  return response;
 }).catch(()=>caches.match(request)));
});