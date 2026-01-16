import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { loadAllowedWorkspaces, isAllowedPath } from '../utils/workspaces.js';

const router = Router();

interface WorkspaceNode {
  path: string;
  name: string;
  has_children: boolean;
}

function safeName(p: string): string {
  const name = path.basename(p);
  return name || p;
}

function hasChildDirs(dirPath: string): boolean {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

router.get('/', (_req: Request, res: Response) => {
  const roots = loadAllowedWorkspaces();
  const items: WorkspaceNode[] = [];

  for (const root of roots) {
    try {
      const stat = fs.statSync(root);
      if (!stat.isDirectory()) continue;

      items.push({
        path: root,
        name: safeName(root),
        has_children: hasChildDirs(root),
      });
    } catch {
      continue;
    }
  }

  items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return res.json({ items });
});

router.get('/children', (req: Request, res: Response) => {
  const dirPath = req.query.path as string;

  if (!dirPath) {
    return res.status(400).json({ detail: 'path query parameter is required' });
  }

  if (!isAllowedPath(dirPath)) {
    return res.status(400).json({ detail: 'path is not in the allowed workspaces' });
  }

  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ detail: 'path does not exist or is not a directory' });
    }
  } catch {
    return res.status(400).json({ detail: 'path does not exist or is not a directory' });
  }

  const items: WorkspaceNode[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const childPath = path.join(dirPath, entry.name);
      if (!isAllowedPath(childPath)) continue;

      items.push({
        path: childPath,
        name: entry.name,
        has_children: hasChildDirs(childPath),
      });
    }
  } catch (e) {
    return res.status(500).json({ detail: `Failed to list children: ${e}` });
  }

  items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return res.json({ items });
});

export default router;
