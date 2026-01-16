import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BASE_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(BASE_DIR, 'data');
export const STATIC_DIR = path.join(BASE_DIR, 'static');

export const PORT = parseInt(process.env.PORT || '9998', 10);
export const VITE_DEV_PORT = parseInt(process.env.VITE_DEV_PORT || '0', 10);

export const CODEX_COMMAND = process.env.CODEX_COMMAND || 'codex';
export const CODEX_ARGS = process.env.CODEX_ARGS ? process.env.CODEX_ARGS.split(' ') : [];
export const TERMINAL_COLS = parseInt(process.env.TERMINAL_COLS || '80', 10);
export const TERMINAL_ROWS = parseInt(process.env.TERMINAL_ROWS || '24', 10);

export const OUTPUT_QUEUE_MAXSIZE = parseInt(process.env.OUTPUT_QUEUE_MAXSIZE || '200', 10);
export const HISTORY_MAX_BYTES = parseInt(process.env.HISTORY_MAX_BYTES || '500000', 10);
export const HISTORY_MAX_CHUNKS = parseInt(process.env.HISTORY_MAX_CHUNKS || '2000', 10);

export const WORKSPACES_FILE = path.join(BASE_DIR, process.env.WORKSPACES_FILE || 'data/workspaces.json');
export const GLOBAL_PRESETS_FILE = path.join(BASE_DIR, process.env.GLOBAL_PRESETS_FILE || 'data/presets/global.json');
export const HISTORY_FILE = path.join(BASE_DIR, process.env.HISTORY_FILE || 'data/history.json');
export const SLASH_COMMANDS_FILE = path.join(BASE_DIR, process.env.SLASH_COMMANDS_FILE || 'data/slash_commands.json');
export const USERS_FILE = path.join(BASE_DIR, process.env.USERS_FILE || 'data/users.json');
