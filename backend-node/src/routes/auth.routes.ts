import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import { USERS_FILE } from '../config.js';
import { LoginRequest, LoginResponse } from '../types/auth.types.js';

const router = Router();

const activeTokens: Set<string> = new Set();

function loadUsers(): Array<{ username: string; password: string }> {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    return data.users || [];
  } catch {
    return [];
  }
}

export function validateToken(token: string): boolean {
  return activeTokens.has(token);
}

export function invalidateToken(token: string): void {
  activeTokens.delete(token);
}

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as LoginRequest;
  const users = loadUsers();

  for (const user of users) {
    if (user.username === username && user.password === password) {
      const token = crypto.randomBytes(32).toString('hex');
      activeTokens.add(token);
      const response: LoginResponse = {
        success: true,
        message: 'Login successful',
        token,
      };
      return res.json(response);
    }
  }

  return res.status(401).json({ detail: 'Invalid username or password' });
});

router.post('/logout', (req: Request, res: Response) => {
  const token = (req.query.token as string) || '';
  invalidateToken(token);
  return res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/verify', (req: Request, res: Response) => {
  const token = (req.query.token as string) || '';
  if (validateToken(token)) {
    return res.json({ valid: true });
  }
  return res.status(401).json({ detail: 'Invalid or expired token' });
});

export default router;
