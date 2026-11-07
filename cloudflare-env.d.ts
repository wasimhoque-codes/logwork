interface CloudflareEnv {
  DB: import('./src/server/database').Database;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUDIENCE?: string;
  OWNER_EMAIL?: string;
  LOCAL_DEV_AUTH?: string;
}
