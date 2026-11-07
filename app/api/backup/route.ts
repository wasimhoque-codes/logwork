import { route, jsonResponse, HttpError } from '../../../src/server/http';
import { snapshot } from '../../../src/server/database';
export const dynamic='force-dynamic';
export const GET=route(async(_request,db)=>{
  const current=await snapshot(db);if(!current.store)throw new HttpError(404,'No saved database records yet.');
  const response=jsonResponse(current.store);
  response.headers.set('Content-Disposition','attachment; filename="gym-hawk-backup.json"');
  return response;
});
