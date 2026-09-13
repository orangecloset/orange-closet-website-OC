export interface Env {
  DATABASE_URL: string;
  CMS_API_SECRET: string;
  CRON_SECRET: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  VITE_CLOUDINARY_CLOUD_NAME: string;
  VITE_NEON_AUTH_URL: string;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}
