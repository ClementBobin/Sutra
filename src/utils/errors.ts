import { GraphQLError } from 'graphql';

class BaseAppError extends GraphQLError {
  constructor(message: string, code: string, status: number) {
    super(message, {
      extensions: {
        code,
        http: {
          status
        }
      }
    });
  }
}

export class AuthenticationError extends BaseAppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends BaseAppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends BaseAppError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ValidationError extends BaseAppError {
  constructor(message = 'Invalid input') {
    super(message, 'BAD_USER_INPUT', 400);
  }
}
