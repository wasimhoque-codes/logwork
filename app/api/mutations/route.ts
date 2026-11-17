import { route, readJson, jsonResponse, requireSyncProtocol } from '../../../src/server/http';
import { mutate } from '../../../src/server/database';
import type { Mutation } from '../../../src/persistence/records';
export const dynamic='force-dynamic';
export const POST=route(async(request,db)=>{
  requireSyncProtocol(request);
  return jsonResponse(await mutate(db,await readJson(request) as Mutation));
});
