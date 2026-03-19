import { Router, Request, Response } from 'express';
import { catchAsync, UnauthorizedError } from '../utils/appErrors';
import { authenticateToken } from '../middleware/authenticateToken';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

const PID_FILE = path.join(process.cwd(), '.praxis.pid');
const LOG_FILE = path.join(process.cwd(), '.praxis.log');

// Helper to run shell commands
function runCommand(command: string, cwd?: string): Promise<{ output: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: cwd || process.cwd(),
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        output: output || `Command completed with code ${code}`,
        error: code !== 0 ? errorOutput : undefined,
      });
    });

    child.on('error', (err) => {
      resolve({ output: '', error: err.message });
    });
  });
}

// Read PID file
function readPidFile(): { backend?: number; frontend?: number } | null {
  if (fs.existsSync(PID_FILE)) {
    try {
      const content = fs.readFileSync(PID_FILE, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return null;
}

// Check if process is running
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Get process uptime
function getProcessUptime(pid: number): string {
  try {
    const now = Date.now();
    const processStartTime = now - (process.uptime() * 1000); // Approximate
    const uptime = now - processStartTime;
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  } catch {
    return 'N/A';
  }
}

/**
 * GET /admin/cli/status
 * Get current process status
 */
router.get('/status', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user?.is_admin) {
    throw new UnauthorizedError('Admin access required');
  }

  const pids = readPidFile();
  const backendRunning = pids?.backend ? isProcessRunning(pids.backend) : false;
  const frontendRunning = pids?.frontend ? isProcessRunning(pids.frontend) : false;

  res.json({
    running: backendRunning || frontendRunning,
    backend: {
      running: backendRunning,
      pid: pids?.backend,
      port: 5000,
      uptime: backendRunning ? getProcessUptime(pids!.backend!) : undefined,
    },
    frontend: {
      running: frontendRunning,
      pid: pids?.frontend,
      port: 3000,
      uptime: frontendRunning ? getProcessUptime(pids!.frontend!) : undefined,
    },
  });
}));

/**
 * POST /admin/cli/execute
 * Execute a CLI command
 */
router.post('/execute', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user?.is_admin) {
    throw new UnauthorizedError('Admin access required');
  }

  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  // Allowed commands whitelist
  const allowedCommands: Record<string, string> = {
    'dev': 'npm run dev',
    'stop': 'pkill -f "node dist/index.js" || true; pkill -f "npm start" || true',
    'restart': 'pkill -f "node dist/index.js" || true; sleep 2; npm start',
    'build': 'npm run build',
    'install': 'npm install',
  };

  const commandToRun = allowedCommands[command];
  if (!commandToRun) {
    return res.status(400).json({ error: 'Invalid or unauthorized command' });
  }

  try {
    const result = await runCommand(commandToRun);

    if (result.error) {
      return res.status(500).json({ error: result.error, output: result.output });
    }

    res.json({
      message: `Command '${command}' executed successfully`,
      output: result.output,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}));

/**
 * GET /admin/cli/logs
 * Get recent logs
 */
router.get('/logs', authenticateToken, catchAsync(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user?.is_admin) {
    throw new UnauthorizedError('Admin access required');
  }

  if (fs.existsSync(LOG_FILE)) {
    const logs = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = logs.split('\n').slice(-100); // Last 100 lines
    res.json({ logs: lines.join('\n') });
  } else {
    res.json({ logs: 'No log file found' });
  }
}));

export default router;
