import { session } from '../../../../src/server/auth';
import { authRoute, jsonResponse } from '../../../../src/server/http';

export const dynamic = 'force-dynamic';
export const GET = authRoute(async (request, env) => jsonResponse(await session(request, env)));
