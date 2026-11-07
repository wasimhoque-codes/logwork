import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
const root='.open-next/assets';
async function walk(dir) {return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]))).flat();}
const paths=(await walk(root)).filter(p=>!p.endsWith('sw.js')&&!p.endsWith('_headers')&&!p.endsWith('.map')&&(p.includes('/_next/static/')||/\.(png|svg|woff2|webmanifest)$/.test(p)));
const fingerprint=createHash('sha256');for(const path of paths)fingerprint.update(await readFile(path));
const cache='gym-hawk-next-'+fingerprint.digest('hex').slice(0,16);
const assets=paths.map(p=>'/'+relative(root,p).split('\\').join('/'));
const worker=`const CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 for(const path of ASSETS){const r=await fetch(path,{redirect:'error'});if(!r.ok||r.headers.get('content-type')?.includes('text/html'))throw Error('Asset unavailable');await cache.put(path,r);}
 const response=await fetch('/',{redirect:'error'});
 if(response.ok&&response.headers.get('content-type')?.includes('text/html')&&(await response.clone().text()).includes('gym-hawk-shell'))await cache.put('/',response);
 await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('gym-hawk-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/cdn-cgi/'))return;
 if(e.request.mode==='navigate'){e.respondWith((async()=>{
   try{const response=await fetch(e.request);if(response.ok&&!response.redirected&&response.headers.get('content-type')?.includes('text/html')&&(await response.clone().text()).includes('gym-hawk-shell')){const cache=await caches.open(CACHE);await cache.put('/',response.clone());}return response;}
   catch{const cached=await caches.match('/');return cached||new Response('Open Gym Hawk online once before using it offline.',{status:503,headers:{'Content-Type':'text/plain'}});}
 })());return;}
 if(ASSETS.includes(url.pathname))e.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(e.request)));
});
`;
await writeFile(join(root,'sw.js'),worker);
console.log('Offline shell prepared: '+assets.length+' assets.');
