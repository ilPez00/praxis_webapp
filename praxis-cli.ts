#!/usr/bin/env node
/**
 * Praxis CLI - Command-line interface for Praxis WebApp
 * 
 * Usage:
 *   ./praxis-cli.ts <command> [options]
 * 
 * Or after making executable:
 *   chmod +x praxis-cli.ts
 *   ./praxis-cli.ts dev
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Configuration
const PROJECT_ROOT = __dirname;
const BACKEND_DIR = PROJECT_ROOT;
const CLIENT_DIR = path.join(PROJECT_ROOT, 'client');
const PID_FILE = path.join(PROJECT_ROOT, '.praxis.pid');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color: string, message: string) {
  console.log(`${color}${message}${colors.reset}`);
}

function info(message: string) {
  log(colors.blue, `ℹ ${message}`);
}

function success(message: string) {
  log(colors.green, `✓ ${message}`);
}

function warn(message: string) {
  log(colors.yellow, `⚠ ${message}`);
}

function error(message: string) {
  log(colors.red, `✗ ${message}`);
}

function header(message: string) {
  console.log('');
  log(colors.cyan, `${colors.bright}═══ ${message} ═══${colors.reset}`);
  console.log('');
}

// Helper to run shell commands
function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; background?: boolean } = {}
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || PROJECT_ROOT,
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
      shell: true,
      detached: options.background,
    });

    if (options.background) {
      resolve(child);
      return;
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve(child);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

// Check if a process is running
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

// Read PID file
function readPidFile(): { backend?: number; frontend?: number } | null {
  if (fs.existsSync(PID_FILE)) {
    try {
      const content = fs.readFileSync(PID_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Write PID file
function writePidFile(pids: { backend?: number; frontend?: number }) {
  fs.writeFileSync(PID_FILE, JSON.stringify(pids, null, 2));
}

// Validate environment setup
function validateEnvironment(): boolean {
  const clientEnvFile = path.join(CLIENT_DIR, '.env');
  
  if (fs.existsSync(clientEnvFile)) {
    const content = fs.readFileSync(clientEnvFile, 'utf-8');
    if (content.includes('YOUR_SUPABASE_URL')) {
      error('Placeholder Supabase configuration found.');
      error(`Please edit ${clientEnvFile} and replace placeholder values with actual credentials.`);
      return false;
    }
  }
  
  return true;
}

// Install dependencies
async function installDependencies(): Promise<void> {
  info('Installing backend dependencies...');
  await runCommand('npm', ['install'], { cwd: BACKEND_DIR });
  
  info('Installing frontend dependencies...');
  await runCommand('npm', ['install'], { cwd: CLIENT_DIR });
  
  success('All dependencies installed.');
}

// Build backend
async function buildBackend(): Promise<void> {
  info('Building backend...');
  await runCommand('npm', ['run', 'build'], { cwd: BACKEND_DIR });
  success('Backend built successfully.');
}

// Build frontend
async function buildFrontend(): Promise<void> {
  info('Building frontend...');
  await runCommand('npm', ['run', 'build'], { cwd: CLIENT_DIR });
  success('Frontend built successfully.');
}

// Start backend
async function startBackend(background = false): Promise<ChildProcess> {
  info('Starting backend server...');
  const child = await runCommand('npm', ['start'], {
    cwd: BACKEND_DIR,
    background,
  });
  
  if (background) {
    const pid = child.pid;
    if (pid) {
      success(`Backend started with PID: ${pid}`);
    }
  }
  
  return child;
}

// Start frontend
async function startFrontend(background = false): Promise<ChildProcess> {
  info('Starting frontend development server...');
  const child = await runCommand('npm', ['start'], {
    cwd: CLIENT_DIR,
    background,
  });
  
  if (background) {
    const pid = child.pid;
    if (pid) {
      success(`Frontend started with PID: ${pid}`);
    }
  }
  
  return child;
}

// Stop all processes
function stopAll(): void {
  const pids = readPidFile();
  
  if (!pids) {
    info('No running processes found.');
    return;
  }
  
  let stopped = false;
  
  if (pids.backend && isProcessRunning(pids.backend)) {
    info(`Stopping backend (PID: ${pids.backend})...`);
    process.kill(pids.backend, 'SIGTERM');
    stopped = true;
  }
  
  if (pids.frontend && isProcessRunning(pids.frontend)) {
    info(`Stopping frontend (PID: ${pids.frontend})...`);
    process.kill(pids.frontend, 'SIGTERM');
    stopped = true;
  }
  
  if (stopped) {
    success('Praxis stopped.');
    fs.unlinkSync(PID_FILE);
  } else {
    info('No running processes found.');
    fs.unlinkSync(PID_FILE);
  }
}

// Show status
function showStatus(): void {
  const pids = readPidFile();
  
  header('Praxis Status');
  
  if (!pids) {
    info('No processes tracked. Processes may still be running.');
    
    // Check for common ports
    const net = require('net');
    
    const checkPort = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(true));
        server.once('listening', () => {
          server.close();
          resolve(false);
        });
        server.listen(port);
      });
    };
    
    Promise.all([
      checkPort(3001).then(inUse => ({ name: 'Backend', port: 3001, inUse })),
      checkPort(3000).then(inUse => ({ name: 'Frontend', port: 3000, inUse })),
    ]).then(results => {
      results.forEach(r => {
        if (r.inUse) {
          success(`${r.name} running on port ${r.port}`);
        } else {
          warn(`${r.name} not running on port ${r.port}`);
        }
      });
    });
    
    return;
  }
  
  if (pids.backend) {
    if (isProcessRunning(pids.backend)) {
      success(`Backend running (PID: ${pids.backend})`);
    } else {
      warn(`Backend not running (stale PID: ${pids.backend})`);
    }
  }
  
  if (pids.frontend) {
    if (isProcessRunning(pids.frontend)) {
      success(`Frontend running (PID: ${pids.frontend})`);
    } else {
      warn(`Frontend not running (stale PID: ${pids.frontend})`);
    }
  }
}

// Clean build artifacts
function clean(): void {
  info('Cleaning build artifacts...');
  
  const dirsToClean = [
    path.join(BACKEND_DIR, 'dist'),
    path.join(CLIENT_DIR, 'build'),
    path.join(CLIENT_DIR, 'node_modules', '.cache'),
  ];
  
  dirsToClean.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      info(`Cleaned: ${dir}`);
    }
  });
  
  success('Cleanup complete.');
}

// Run database migrations
async function runMigrations(): Promise<void> {
  info('Running database migrations...');
  
  const migrationsDir = path.join(PROJECT_ROOT, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    warn('No migrations directory found.');
    return;
  }
  
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  
  if (files.length === 0) {
    info('No migration files found.');
    return;
  }
  
  info(`Found ${files.length} migration file(s).`);
  
  // Check for Supabase CLI
  try {
    await runCommand('npx', ['supabase', 'db', 'push'], { cwd: PROJECT_ROOT });
    success('Migrations applied successfully.');
  } catch (e) {
    warn('Supabase CLI not available or not configured.');
    info('Please apply migrations manually in Supabase dashboard.');
  }
}

// Seed database
async function seedDatabase(): Promise<void> {
  info('Seeding database...');
  
  const seedScript = path.join(PROJECT_ROOT, 'populate_praxis.sh');
  
  if (fs.existsSync(seedScript)) {
    await runCommand('bash', [seedScript], { cwd: PROJECT_ROOT });
    success('Database seeded.');
  } else {
    warn('No seed script found (populate_praxis.sh).');
  }
}

// Open database shell
async function dbShell(): Promise<void> {
  info('Opening database shell...');
  
  try {
    await runCommand('npx', ['supabase', 'db', 'shell'], { cwd: PROJECT_ROOT });
  } catch (e) {
    error('Failed to open database shell. Ensure Supabase CLI is installed and configured.');
  }
}

// Run tests
async function runTests(options: { watch?: boolean; coverage?: boolean } = {}): Promise<void> {
  info('Running tests...');
  
  const args = ['run', 'test'];
  
  if (options.watch) {
    args.push(':watch');
  } else if (options.coverage) {
    args.push(':coverage');
  }
  
  await runCommand('npm', args, { cwd: BACKEND_DIR });
  success('Tests completed.');
}

// Run E2E tests
async function runE2ETests(options: { ui?: boolean; headed?: boolean } = {}): Promise<void> {
  info('Running E2E tests...');
  
  const args = ['run', 'test:e2e'];
  
  if (options.ui) {
    args.push(':ui');
  } else if (options.headed) {
    args.push(':headed');
  }
  
  await runCommand('npm', args, { cwd: BACKEND_DIR });
  success('E2E tests completed.');
}

// Setup environment
async function setupEnv(): Promise<void> {
  header('Environment Setup');
  
  const clientEnvFile = path.join(CLIENT_DIR, '.env');
  const backendEnvFile = path.join(BACKEND_DIR, '.env');
  
  // Create client .env if it doesn't exist
  if (!fs.existsSync(clientEnvFile)) {
    info('Creating client .env file...');
    const template = `VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_API_URL=http://localhost:3001`;
    fs.writeFileSync(clientEnvFile, template);
    success('Client .env created. Please update with your Supabase credentials.');
  } else {
    info('Client .env already exists.');
  }
  
  // Create backend .env if it doesn't exist
  if (!fs.existsSync(backendEnvFile)) {
    info('Creating backend .env file...');
    const template = `PORT=3001
NODE_ENV=development
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY`;
    fs.writeFileSync(backendEnvFile, template);
    success('Backend .env created. Please update with your Supabase credentials.');
  } else {
    info('Backend .env already exists.');
  }
  
  info('Next steps:');
  console.log('  1. Update .env files with your Supabase credentials');
  console.log('  2. Run: ./praxis-cli.ts dev');
}

// Development mode
async function devMode(): Promise<void> {
  header('Starting Praxis Development Mode');
  
  if (!validateEnvironment()) {
    process.exit(1);
  }
  
  await installDependencies();
  await buildBackend();
  
  // Start backend in background
  const backend = await startBackend(true);
  const backendPid = backend.pid;
  
  // Wait a bit for backend to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start frontend in background
  const frontend = await startFrontend(true);
  const frontendPid = frontend.pid;
  
  // Save PIDs
  if (backendPid && frontendPid) {
    writePidFile({ backend: backendPid, frontend: frontendPid });
  }
  
  // Wait for frontend to start
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Open browser
  info('Opening browser...');
  try {
    await runCommand('xdg-open', ['http://localhost:3000']);
  } catch (e) {
    try {
      await runCommand('google-chrome', ['http://localhost:3000']);
    } catch (e2) {
      warn('Could not open browser automatically. Please open http://localhost:3000');
    }
  }
  
  success('Praxis is running!');
  info('Backend: http://localhost:3001');
  info('Frontend: http://localhost:3000');
  info('');
  info('To stop: ./praxis-cli.ts stop');
  info('To check status: ./praxis-cli.ts status');
  info('');
  info('Press Ctrl+C to exit (processes will continue running in background)');
}

// Show help
function showHelp(): void {
  console.log(`
${colors.cyan}${colors.bright}Praxis CLI${colors.reset} - Command-line interface for Praxis WebApp

${colors.bright}Usage:${colors.reset}
  ./praxis-cli.ts <command> [options]

${colors.bright}Commands:${colors.reset}
  ${colors.yellow}dev${colors.reset}         Start development servers (backend + frontend)
  ${colors.yellow}build${colors.reset}       Build both backend and frontend
  ${colors.yellow}start${colors.reset}       Start production servers
  ${colors.yellow}stop${colors.reset}        Stop all running processes
  ${colors.yellow}status${colors.reset}      Show status of running processes
  ${colors.yellow}clean${colors.reset}       Remove build artifacts
  ${colors.yellow}install${colors.reset}     Install all dependencies

${colors.bright}Database:${colors.reset}
  ${colors.yellow}migrate${colors.reset}     Run database migrations
  ${colors.yellow}seed${colors.reset}        Seed the database with sample data
  ${colors.yellow}db${colors.reset}          Open database shell

${colors.bright}Testing:${colors.reset}
  ${colors.yellow}test${colors.reset}        Run unit tests
  ${colors.yellow}test:watch${colors.reset}  Run tests in watch mode
  ${colors.yellow}test:coverage${colors.reset} Run tests with coverage report
  ${colors.yellow}test:e2e${colors.reset}    Run E2E tests
  ${colors.yellow}test:e2e:ui${colors.reset} Run E2E tests with UI

${colors.bright}Setup:${colors.reset}
  ${colors.yellow}setup${colors.reset}       Setup environment files

${colors.bright}Examples:${colors.reset}
  ./praxis-cli.ts dev
  ./praxis-cli.ts build
  ./praxis-cli.ts test --watch
  ./praxis-cli.ts migrate
`);
}

// Main CLI logic
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }
  
  try {
    switch (command) {
      case 'dev':
        await devMode();
        break;
        
      case 'build':
        await installDependencies();
        await buildBackend();
        await buildFrontend();
        break;
        
      case 'start':
        await startBackend();
        break;
        
      case 'stop':
        stopAll();
        break;
        
      case 'status':
        showStatus();
        break;
        
      case 'clean':
        clean();
        break;
        
      case 'install':
        await installDependencies();
        break;
        
      case 'migrate':
        await runMigrations();
        break;
        
      case 'seed':
        await seedDatabase();
        break;
        
      case 'db':
        await dbShell();
        break;
        
      case 'test':
        await runTests({ 
          watch: args.includes('--watch'),
          coverage: args.includes('--coverage')
        });
        break;
        
      case 'test:e2e':
        await runE2ETests({
          ui: args.includes('--ui'),
          headed: args.includes('--headed')
        });
        break;
        
      case 'setup':
        await setupEnv();
        break;
        
      default:
        error(`Unknown command: ${command}`);
        console.log('');
        showHelp();
        process.exit(1);
    }
  } catch (e: any) {
    error(`Command failed: ${e.message}`);
    process.exit(1);
  }
}

// Run the CLI
main();
