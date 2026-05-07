import { ValidationError } from './errors.js';

export interface PaginationArgs {
  first?: number;
  after?: string;
}

export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64');
}

export function decodeCursor(cursor: string): string {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    if (!decoded) {
      throw new Error('Empty cursor');
    }
    return decoded;
  } catch {
    throw new ValidationError('Invalid pagination cursor');
  }
}

export function applyPagination(args: PaginationArgs): {
  take?: number;
  skip?: number;
  cursor?: { id: string };
} {
  const first = args.first;

  if (first !== undefined) {
    if (!Number.isInteger(first) || first <= 0 || first > 100) {
      throw new ValidationError('first must be an integer between 1 and 100');
    }
  }

  if (args.after) {
    return {
      take: first,
      skip: 1,
      cursor: { id: decodeCursor(args.after) }
    };
  }

  return {
    take: first
  };
}
