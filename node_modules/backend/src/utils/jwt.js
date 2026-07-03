import jwt from 'jsonwebtoken';

export function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET');

  return jwt.sign(payload, secret, { expiresIn: '7d' });
}


export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing JWT_SECRET');

  return jwt.verify(token, secret);
}


