import { createHash, randomBytes } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';
import { AuthenticationError } from './errors.js';

export interface TokenPayload {
  id: string;
  email: string;
}

export interface GeneratedApiToken {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN
  } as SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    if (typeof decoded !== 'object' || decoded === null || !('id' in decoded) || !('email' in decoded)) {
      throw new AuthenticationError('Invalid token payload');
    }

    const payload = decoded as Record<string, unknown>;
    if (typeof payload.id !== 'string' || typeof payload.email !== 'string') {
      throw new AuthenticationError('Invalid token payload');
    }

    return { id: payload.id, email: payload.email };
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }
}

export function hashApiToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generateApiToken(): GeneratedApiToken {
  const rawSecret = randomBytes(32).toString('hex');
  const rawToken = `sutra_${rawSecret}`;
  return {
    rawToken,
    tokenHash: hashApiToken(rawToken),
    tokenPrefix: rawToken.slice(0, 12)
  };
}
