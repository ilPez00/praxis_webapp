import * as fs from 'fs';
import logger from '../utils/logger';

const MASTER_ENV_PATH = '/home/gio/.env';

export function loadMasterEnv(): void {
  if (!fs.existsSync(MASTER_ENV_PATH)) {
    logger.info('[EnvLoader] Master .env not found at ' + MASTER_ENV_PATH);
    return;
  }

  let loaded = 0;
  const content = fs.readFileSync(MASTER_ENV_PATH, 'utf-8');

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
      loaded++;
    }
  }

  logger.info(`[EnvLoader] Loaded ${loaded} vars from master .env`);
}
