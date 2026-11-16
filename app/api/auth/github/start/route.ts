import { startGitHub } from '../../../../../src/server/auth';
import { authRoute } from '../../../../../src/server/http';

export const dynamic = 'force-dynamic';
export const GET = authRoute(startGitHub);
