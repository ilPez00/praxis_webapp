/**
 * Middleware Tests
 * Unit tests for custom middleware
 */

import { validateBody, validateQuery, validateParams } from '../middleware/validateRequest';
import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Mock Express objects
const mockRequest = (body: any = {}, query: any = {}, params: any = {}) => ({
  body,
  query,
  params,
} as any);

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe('validateBody', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should validate and pass correct data', () => {
    const schema: ZodSchema = {
      parse: jest.fn().mockReturnValue({ name: 'test' }),
    };

    const middleware = validateBody(schema);
    const req = mockRequest({ name: 'test' });
    const res = mockResponse();

    middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'test' });
  });

  it('should return 400 on validation error', () => {
    const schema: ZodSchema = {
      parse: jest.fn().mockImplementation(() => {
        throw new ZodError([{
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string',
        }]);
      }),
    };

    const middleware = validateBody(schema);
    const req = mockRequest({ name: 123 });
    const res = mockResponse();

    middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: expect.any(Array),
    });
  });
});

describe('validateQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should validate query parameters', () => {
    const schema: ZodSchema = {
      parse: jest.fn().mockReturnValue({ page: '1' }),
    };

    const middleware = validateQuery(schema);
    const req = mockRequest({}, { page: '1' });
    const res = mockResponse();

    middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('validateParams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should validate URL parameters', () => {
    const schema: ZodSchema = {
      parse: jest.fn().mockReturnValue({ id: '123' }),
    };

    const middleware = validateParams(schema);
    const req = mockRequest({}, {}, { id: '123' });
    const res = mockResponse();

    middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
