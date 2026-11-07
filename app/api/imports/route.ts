import { route, readJson, jsonResponse, HttpError } from '../../../src/server/http';
import { snapshot, createStage, activateStage, stageChunk } from '../../../src/server/database';
import type { Change } from '../../../src/persistence/records';
import type { Store } from '../../../src/model';
export const dynamic='force-dynamic';
type Input={action:string;id?:string;expectedDatasetId?:string|null;expectedRevision?:number;changes?:Change[];header?:Pick<Store,'settings'|'programme'>};
export const POST=route(async(request,db,email)=>{
  const input=await readJson(request,2*1024*1024) as Input;
  if(!input||typeof input.action!=='string')throw new HttpError(400,'Invalid import request.');
  if(input.action==='create') {
    const current=await snapshot(db);
    if(input.expectedDatasetId!==current.datasetId||input.expectedRevision!==current.revision)return jsonResponse({error:'Database changed before restore.',conflicts:['dataset'],snapshot:current},409);
    return jsonResponse({id:await createStage(db,current.datasetId,current.revision)});
  }
  if(typeof input.id!=='string'||input.id.length>100)throw new HttpError(400,'Invalid import stage.');
  if(input.action==='chunk') {
    if(!input.header||!Array.isArray(input.changes)||input.changes.length>100)throw new HttpError(400,'Invalid import chunk.');
    await stageChunk(db,input.id,input.header,input.changes);return jsonResponse({saved:true});
  }
  if(input.action==='activate')return jsonResponse(await activateStage(db,input.id,email));
  throw new HttpError(400,'Invalid import action.');
});
