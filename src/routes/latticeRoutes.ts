import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import {
    registerDevice,
    listDevices,
    getDevice,
    deleteDevice,
    heartbeat,
} from '../controllers/deviceController';
import {
    submitJob,
    listJobs,
    getJob,
    cancelJob,
    pollJobs,
    updateJobStatus,
} from '../controllers/jobController';

const router = Router();

// ── Devices ──────────────────────────────────────────────────────────────────
// Device-key routes (no JWT — device agent uses x-device-key)
router.post('/devices/heartbeat', heartbeat);
router.post('/jobs/poll',         pollJobs);
router.patch('/jobs/:id/status',  updateJobStatus);

// JWT-authenticated user routes
router.post('/devices/register',  authenticateToken, registerDevice);
router.get('/devices',            authenticateToken, listDevices);
router.get('/devices/:id',        authenticateToken, getDevice);
router.delete('/devices/:id',     authenticateToken, deleteDevice);

// ── Jobs ──────────────────────────────────────────────────────────────────────
router.post('/jobs',              authenticateToken, submitJob);
router.get('/jobs',               authenticateToken, listJobs);
router.get('/jobs/:id',           authenticateToken, getJob);
router.delete('/jobs/:id',        authenticateToken, cancelJob);

export default router;
