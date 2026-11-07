import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Conflict, type Database } from './database';

export class HttpError extends Error { constructor(public status:number,message:string) {super(message);} }
export async function authorize(request:Request,env:CloudflareEnv):Promise<string> {
  const url=new URL(request.url);
  if(env.LOCAL_DEV_AUTH==='1'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))return 'local@example.invalid';
  if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUDIENCE||!env.OWNER_EMAIL)throw new HttpError(503,'Private sign-in is not configured. Your local records are safe.');
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token)throw new HttpError(401,'Sign in to sync your records.');
  if(!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN))throw new HttpError(503,'Invalid Access configuration.');
  const issuer='https://'+env.ACCESS_TEAM_DOMAIN;
  try {
    // Request-scoped: do not retain network promises across Worker invocations.
    const keys=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));
    const {payload}=await jwtVerify(token,keys,{issuer,audience:env.ACCESS_AUDIENCE,algorithms:['RS256']});
    if(typeof payload.email!=='string'||payload.email.toLowerCase()!==env.OWNER_EMAIL.trim().toLowerCase())throw new Error('Owner mismatch');
    return payload.email.toLowerCase();
  } catch {throw new HttpError(401,'Sign in with your owner account to sync.');}
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
export function jsonResponse(value:unknown,status=200) {return Response.json(value,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Cf-Access-Jwt-Assertion'}});}
export function checkOrigin(request:Request,env:CloudflareEnv) {
  const origin=request.headers.get('origin');
  if(!origin)return false;
  const expected=new URL(request.url);
  if(origin===expected.origin)return true;
  // Wrangler normalizes 127.0.0.1 to localhost before invoking Next.js.
  try {const actual=new URL(origin);return env.LOCAL_DEV_AUTH==='1'&&actual.protocol==='http:'&&expected.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(actual.hostname)&&['localhost','127.0.0.1','[::1]'].includes(expected.hostname)&&actual.port===expected.port;}catch{return false;}
}
export function route(handler:(request:Request,db:Database,email:string)=>Promise<Response>) {
  return async(request:Request) => {
    try {
      const {env}=getCloudflareContext();
      const email=await authorize(request,env);
      if(request.method!=='GET'&&!checkOrigin(request,env))throw new HttpError(403,'This action must originate from Gym Hawk.');
      if(!env.DB)throw new HttpError(503,'Database is not configured. Your local records are safe.');
      return await handler(request,env.DB,email);
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
