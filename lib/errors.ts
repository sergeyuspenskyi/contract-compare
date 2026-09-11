export class AppError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
export function publicError(error: unknown): { error: string; status: number } {
  return error instanceof AppError ? { error: error.message, status: error.status } : { error: 'Something went wrong on the server. Please try again.', status: 500 };
}
