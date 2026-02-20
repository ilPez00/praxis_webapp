import { Request, Response, NextFunction } from 'express';

/**
 * @description Global error handling middleware for Express.
 * Catches errors thrown in async routes and sends a standardized error response.
 * This should be the last middleware added to the Express app.
 *
 * @param err - The error object.
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The Express next middleware function.
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err); // Log the error for server-side debugging

  const statusCode = err.statusCode || 500; // Use custom status code if available, otherwise 500
  const message = err.message || 'An unexpected error occurred on the server.';

  // In production, avoid sending detailed error messages to the client
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    return res.status(statusCode).json({ message: 'An internal server error occurred.' });
  }

  res.status(statusCode).json({
    message: message,
    // Optionally, include stack trace in development for easier debugging
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * @description Middleware to handle 404 Not Found errors for unmatched routes.
 * This should be placed before the global error handler.
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error: any = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error); // Pass the error to the next middleware (errorHandler)
};
