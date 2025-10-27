import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';

export interface JwtClaims {
  sub: string; // user id
  role?: 'user' | 'admin';
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return secret;
}

export const requireUserJwt: RequestHandler = (req, res, next) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Missing token' });
    const claims = jwt.verify(token, getJwtSecret()) as JwtClaims;
    (req as any).jwt = claims;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireAdminJwt: RequestHandler = (req, res, next) => {
  requireUserJwt(req, res, (err) => {
    if (err) return;
    const role = (req as any).jwt?.role;
    if (role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    next();
  });
};
