import { route, jsonResponse, requireSyncProtocol } from '../../../src/server/http';
import { snapshot } from '../../../src/server/database';
export const dynamic='force-dynamic';
export const GET=route(async(request,db)=>{
  requireSyncProtocol(request);
  return jsonResponse(await snapshot(db));
});
