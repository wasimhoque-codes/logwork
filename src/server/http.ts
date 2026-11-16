import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isLoopback, session } from './auth';
import { HttpError, jsonResponse } from './responses';
export { HttpError, jsonResponse } from './responses';
import { Conflict, type Database } from './database';
import { SYNC_PROTOCOL } from '../persistence/records';

export function requireSyncProtocol(request: Request) {
  if (request.headers.get('X-Gym-Hawk-Sync') !== SYNC_PROTOCOL) {
    throw new HttpError(426, 'Reload Gym Hawk to update cloud sync.');
  }
}

export async function readJson(request:Request,maxBytes=1024*1024):Promise<unknown> {
  if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'Send JSON data.');
  if(Number(request.headers.get('content-length')??0)>maxBytes)throw new HttpError(413,'Upload is too large.');
  const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Missing request body.');
  const chunks:Uint8Array[]=[];let length=0;
  while(true) {const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>maxBytes){await reader.cancel();throw new HttpError(413,'Upload is too large.');}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new HttpError(400,'Invalid JSON.');}
}
export function checkOrigin(request:Request,env:CloudflareEnv) {
  const origin=request.headers.get('origin');
  if(!origin)return false;
  const expected=new URL(request.url);
  if(origin===expected.origin)return true;
  // Wrangler normalizes 127.0.0.1 to localhost before invoking Next.js.
  try {const actual=new URL(origin);return env.LOCAL_DEV_AUTH==='1'&&actual.protocol==='http:'&&expected.protocol==='http:'&&isLoopback(actual.hostname)&&isLoopback(expected.hostname)&&actual.port===expected.port;}catch{return false;}
}
export function route(handler:(request:Request,db:Database)=>Promise<Response>) {
  return async(request:Request) => {
    try {
      const {env}=getCloudflareContext();
      if(!(await session(request,env)).signedIn)throw new HttpError(401,'Sign in with GitHub to sync your records.');
      if(request.method!=='GET'&&!checkOrigin(request,env))throw new HttpError(403,'This action must originate from Gym Hawk.');
      if(!env.DB)throw new HttpError(503,'Database is not configured. Your local records are safe.');
      return await handler(request,env.DB);
    } catch(error) {
      if(error instanceof Conflict)return jsonResponse({error:error.message,conflicts:error.keys,snapshot:error.snapshot},409);
      if(error instanceof HttpError)return jsonResponse({error:error.message},error.status);
      // Domain errors are useful; SQL/runtime details must not expose private records.
      const message=error instanceof Error?error.message:'';
      if(/backup|Invalid mutation|Mutation ID|Record key|Import stage|import chunk/i.test(message))return jsonResponse({error:message},400);
      console.error('Gym Hawk data request failed',error instanceof Error?error.name:'Unknown error');
      return jsonResponse({error:'Could not sync. Your local changes are retained; retry shortly.'},500);
    }
  };
}

export function authRoute(handler: (request: Request, env: CloudflareEnv) => Response | Promise<Response>) {
  return async (request: Request) => {
    try {
      const { env } = getCloudflareContext();
      if (request.method !== 'GET' && !checkOrigin(request, env)) {
        throw new HttpError(403, 'This action must originate from Gym Hawk.');
      }
      return await handler(request, env);
    } catch (error) {
      if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
      return jsonResponse({ error: 'GitHub sign-in is unavailable. Your local records are safe.' }, 500);
    }
  };
}
