import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { asyncHandler } from '../middleware/async.middleware.js';
import { signToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['doctor', 'patient']).default('patient'),

  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, role, firstName, lastName, phoneNumber } =
      registerSchema.parse(req.body);


    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      passwordHash,
      role,
      firstName,
      lastName,
      phoneNumber,
    });


    // Token includes role
    const token = signToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.status(201).json({ token });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    res.json({ token });
  })
);

export default router;


