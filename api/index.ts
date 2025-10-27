import express, { type Request, type Response } from 'express';
import { registerRoutes } from '../server/routes';

let appPromise: Promise<express.Express> | null = null;

async function buildApp(): Promise<express.Express> {
  const app = express();

  // Match parsers used in server/index.ts so rawBody is available where needed (e.g., webhooks)
  app.use(express.json({
    verify: (req: any, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: false }));

  // Register all API routes onto this app (does not start a listener here)
  await registerRoutes(app);

  return app;
}

async function getApp(): Promise<express.Express> {
  if (!appPromise) appPromise = buildApp();
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  const app = await getApp();
  return (app as any)(req, res);
}
