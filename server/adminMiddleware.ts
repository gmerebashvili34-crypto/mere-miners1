import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = (req as any).user?.claims?.sub;
  
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await storage.getUser(userId);
  
  if (!user || !user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}
