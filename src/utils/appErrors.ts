/**
 * @file appErrors.ts
 * @description Custom error classes for the application to provide more semantic error handling.
 */

/**
 * @class AppError
 * @extends Error
 * @description Base class for custom application errors.
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Operational errors are those that can be anticipated and handled gracefully
    Error.captureStackTrace(this, this.constructor); // Preserve stack trace
  }
}

/**
 * @class NotFoundError
 * @extends AppError
 * @description Error for when a requested resource is not found (HTTP 404).
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found.') {
    super(message, 404);
  }
}

/**
 * @class BadRequestError
 * @extends AppError
 * @description Error for invalid client input (HTTP 400).
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request.') {
    super(message, 400);
  }
}

/**
 * @class UnauthorizedError
 * @extends AppError
 * @description Error for authentication failures (HTTP 401).
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401);
  }
}

/**
 * @class ForbiddenError
 * @extends AppError
 * @description Error for authorization failures (HTTP 403).
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied.') {
    super(message, 403);
  }
}

/**
 * @class InternalServerError
 * @extends AppError
 * @description Error for unexpected server-side issues (HTTP 500).
 */
export class InternalServerError extends AppError {
  constructor(message = 'Internal server error.') {
    super(message, 500);
  }
}

import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * @description Utility function to wrap an async Express route handler
 * to catch errors and pass them to the next middleware (errorHandler).
 * This avoids repetitive try-catch blocks in each async route.
 * @param fn - The async Express route handler function.
 * @returns A properly-typed RequestHandler that wraps the original handler with error catching.
 */
export const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
