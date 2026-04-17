import { Request, Response } from 'express';
import { GoogleCalendarService } from '../services/GoogleCalendarService';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';

const calendarService = new GoogleCalendarService();

/**
 * GET /api/calendar/google/auth
 * Initiate Google OAuth flow
 */
export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const authUrl = calendarService.getAuthUrl(userId);
  res.json({ authUrl });
});

/**
 * GET /api/calendar/google/callback
 * Handle Google OAuth callback
 */
export const googleCallback = catchAsync(async (req: Request, res: Response) => {
  const { code, state } = req.query as { code: string; state: string };

  if (!code) throw new BadRequestError('Code is required');
  if (!state) throw new BadRequestError('State is required');

  await calendarService.handleCallback(code, state);

  const redirectUri = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/settings?google_sync=success` : '/';
  res.redirect(redirectUri);
});

/**
 * GET /api/calendar/google/events
 * Get Google Calendar events for a date range
 */
export const getGoogleEvents = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { start, end, days } = req.query as { start?: string; end?: string; days?: string };

  let startDate: Date;
  let endDate: Date;

  if (start && end) {
    startDate = new Date(start);
    endDate = new Date(end);
  } else {
    startDate = new Date();
    const numDays = Math.min(parseInt(days || '7', 10) || 7, 30);
    endDate = new Date();
    endDate.setDate(startDate.getDate() + numDays);
  }

  const events = await calendarService.getEvents(userId, startDate, endDate);
  res.json(events);
});

/**
 * POST /api/calendar/google/events
 * Create a Google Calendar event
 */
export const createGoogleEvent = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { title, description, start, end, location, allDay } = req.body;

  if (!title) throw new BadRequestError('title is required');
  if (!start) throw new BadRequestError('start is required');
  if (!end) throw new BadRequestError('end is required');

  const event = await calendarService.createEvent(userId, {
    title,
    description,
    start,
    end,
    location,
    allDay,
  });

  if (!event) {
    throw new BadRequestError('Google Calendar not linked. Connect in Settings first.');
  }

  res.status(201).json(event);
});

/**
 * GET /api/calendar/google/status
 * Check if Google Calendar is linked
 */
export const getGoogleStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const linked = await calendarService.isLinked(userId);
  res.json({ linked });
});

/**
 * DELETE /api/calendar/google/disconnect
 * Disconnect Google Calendar
 */
export const disconnectGoogle = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  await calendarService.disconnect(userId);
  res.json({ message: 'Google Calendar disconnected' });
});
