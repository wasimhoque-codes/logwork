import { clearGitHubSession } from '../../../../src/server/auth';
import { authRoute } from '../../../../src/server/http';

export const dynamic = 'force-dynamic';
export const POST = authRoute(clearGitHubSession);
