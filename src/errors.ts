/**
 * Custom error for user rejection.
 */
export class UserRejectionError extends Error {
  constructor(message = 'User rejected the request') {
    super(message);
    this.name = 'UserRejectionError';
  }

  static asSimpleError(message?: string): Record<string, unknown> {
    return {
      code: 4001,
      message: message ?? 'User rejected the request',
    };
  }
}

/**
 * Custom error for invalid params.
 */
export class InvalidParamsError extends Error {
  constructor(message = 'Invalid parameters') {
    super(message);
    this.name = 'InvalidParamsError';
  }

  static asSimpleError(message?: string): Record<string, unknown> {
    return {
      code: -32602,
      message: message ?? 'Invalid parameters',
    };
  }
}

/**
 * Custom error for invalid request method.
 */
export class InvalidRequestMethodError extends Error {
  constructor(method: string) {
    super(`Method not found: ${method}`);
    this.name = 'InvalidRequestMethodError';
  }

  static asSimpleError(method?: string): Record<string, unknown> {
    return {
      code: -32601,
      message: method ? `Method not found: ${method}` : 'Method not found',
    };
  }
}

/**
 * Custom error for when a dry run fails.
 */
export class DryRunFailedError extends Error {
  constructor(message = 'Dry run failed') {
    super(message);
    this.name = 'DryRunFailedError';
  }

  static asSimpleError(message?: string): Record<string, unknown> {
    return {
      code: 4900,
      message: message ?? 'Dry run failed',
    };
  }
}
