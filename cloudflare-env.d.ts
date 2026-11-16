interface CloudflareEnv {
  DB: import('./src/server/database').Database;
  APP_ORIGIN?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_OWNER_ID?: string;
  SESSION_SECRET?: string;
  LOCAL_DEV_AUTH?: string;
}
