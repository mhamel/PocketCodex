import fs from 'fs';
import path from 'path';
import { WORKSPACES_FILE } from '../config.js';

function normPath(p: string): string {
  return path.normalize(path.resolve(p)).toLowerCase();
}

export function loadAllowedWorkspaces(): string[] {
  if (!fs.existsSync(WORKSPACES_FILE)) {
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(WORKSPACES_FILE, 'utf-8'));
    const raw = data.workspaces || [];
    return raw.filter((item: unknown) => typeof item === 'string');
  } catch {
    return [];
  }
}

export function isAllowedPath(targetPath: string): boolean {
  const allowed = loadAllowedWorkspaces();
  if (allowed.length === 0) {
    return false;
  }

  const target = normPath(targetPath);

  for (const base of allowed) {
    const baseNorm = normPath(base);
    if (target === baseNorm) {
      return true;
    }
    const baseWithSep = baseNorm.endsWith(path.sep) ? baseNorm : baseNorm + path.sep;
    if (target.startsWith(baseWithSep)) {
      return true;
    }
  }

  return false;
}
