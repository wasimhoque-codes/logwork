import { route, jsonResponse } from '../../../src/server/http';
import { snapshot } from '../../../src/server/database';
export const dynamic='force-dynamic';
export const GET=route(async(_request,db)=>jsonResponse(await snapshot(db)));
