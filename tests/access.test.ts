import { afterEach, it, expect, vi } from 'vitest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { authorize, readJson, checkOrigin } from '../src/server/http';

afterEach(()=>vi.unstubAllGlobals());
const env={ACCESS_TEAM_DOMAIN:'gym-hawk-test.cloudflareaccess.com',ACCESS_AUDIENCE:'gym-hawk-test',OWNER_EMAIL:'owner@example.com'} as CloudflareEnv;
const request=(token?:string)=>new Request('https://logwork.wasimhoque16.workers.dev/api/bootstrap',{headers:token?{'Cf-Access-Jwt-Assertion':token}:{}});
it('fails closed when authentication is missing or not configured',async()=>{
  await expect(authorize(request(),{} as CloudflareEnv)).rejects.toMatchObject({status:503});
  await expect(authorize(request(),env)).rejects.toMatchObject({status:401});
  await expect(authorize(request('forged-token'),env)).rejects.toMatchObject({status:401});
});
it('never accepts local authentication on the production hostname',async()=>{
  await expect(authorize(request(),{LOCAL_DEV_AUTH:'1'} as CloudflareEnv)).rejects.toMatchObject({status:503});
  expect(await authorize(new Request('http://localhost/api/bootstrap'),{LOCAL_DEV_AUTH:'1'} as CloudflareEnv)).toBe('local@example.invalid');
});
it('checks the JWT signature, issuer, audience, expiry and exact owner email',async()=>{
  const {privateKey,publicKey}=await generateKeyPair('RS256'), jwk=await exportJWK(publicKey);
  jwk.kid='test-key';jwk.alg='RS256';jwk.use='sig';
  vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({keys:[jwk]}),{headers:{'content-type':'application/json'}}));
  const token=async(email='owner@example.com',audience=env.ACCESS_AUDIENCE!,issuer='https://'+env.ACCESS_TEAM_DOMAIN,expiry='5m')=>new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiry).sign(privateKey);
  expect(await authorize(request(await token()),env)).toBe('owner@example.com');
  for(const invalid of [await token('someone@example.com'),await token('owner@example.com','wrong'),await token('owner@example.com',env.ACCESS_AUDIENCE!,'https://wrong.cloudflareaccess.com'),await token('owner@example.com',env.ACCESS_AUDIENCE!,undefined,'-1s')])await expect(authorize(request(invalid),env)).rejects.toMatchObject({status:401});
});
it('bounds request bodies before parsing or writing them',async()=>{
  await expect(readJson(new Request('https://example.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({data:'x'.repeat(100)})}),20)).rejects.toMatchObject({status:413});
});
it('enforces same-origin writes and supports Wrangler loopback normalization only locally',()=>{
  const request=new Request('http://localhost:4174/api/mutations',{headers:{origin:'http://127.0.0.1:4174'}});
  expect(checkOrigin(request,{LOCAL_DEV_AUTH:'1'} as CloudflareEnv)).toBe(true);
  expect(checkOrigin(request,env)).toBe(false);
  expect(checkOrigin(new Request('https://logwork.wasimhoque16.workers.dev/api/mutations',{headers:{origin:'https://attacker.example'}}),env)).toBe(false);
});
