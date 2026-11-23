import { describe, it, expect } from 'vitest';
import type { Request, Response } from 'express';
import { AppError, errorHandler, apiNotFoundHandler } from './errors.js';

function createMockResponse(): {
  res: Response;
  getStatus: () => number;
  getBody: () => unknown;
} {
  let statusCode = 200;
  let body: unknown = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      body = data;
      return this;
    },
  } as unknown as Response;

  return {
    res,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

describe('errors', () => {
  it('creates an AppError instance correctly', () => {
    const error = new AppError('VALIDATION', 400, 'Invalid parameters', { field: 'cityId' });
    expect(error.name).toBe('AppError');
    expect(error.code).toBe('VALIDATION');
    expect(error.status).toBe(400);
    expect(error.message).toBe('Invalid parameters');
    expect(error.details).toEqual({ field: 'cityId' });
  });

  it('apiNotFoundHandler responds with 404 JSON', () => {
    const mock = createMockResponse();
    const req = { method: 'GET', originalUrl: '/api/missing' } as Request;

    apiNotFoundHandler(req, mock.res);

    expect(mock.getStatus()).toBe(404);
    expect(mock.getBody()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Unknown API endpoint: GET /api/missing',
      },
    });
  });

  it('errorHandler maps entity.too.large to 413 PAYLOAD_TOO_LARGE', () => {
    const mock = createMockResponse();
    const err = { type: 'entity.too.large' };

    errorHandler(err, {} as Request, mock.res, () => {});

    expect(mock.getStatus()).toBe(413);
    expect(mock.getBody()).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request entity exceeds 256kb limit',
      },
    });
  });

  it('errorHandler formats AppError with status and details', () => {
    const mock = createMockResponse();
    const err = new AppError('OUT_OF_COVERAGE', 422, 'City not covered', { cityId: 'unknown' });

    errorHandler(err, {} as Request, mock.res, () => {});

    expect(mock.getStatus()).toBe(422);
    expect(mock.getBody()).toEqual({
      error: {
        code: 'OUT_OF_COVERAGE',
        message: 'City not covered',
        details: { cityId: 'unknown' },
      },
    });
  });

  it('errorHandler formats unexpected errors as 500 INTERNAL without leaking details', () => {
    const mock = createMockResponse();
    const err = new Error('Secret failure');

    errorHandler(err, {} as Request, mock.res, () => {});

    expect(mock.getStatus()).toBe(500);
    expect(mock.getBody()).toEqual({
      error: {
        code: 'INTERNAL',
        message: 'Internal server error',
      },
    });
  });
});
