class AppError extends Error {
  constructor(message, code = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class AuthorizationError extends AppError {
  constructor(message) {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  AuthorizationError,
};
