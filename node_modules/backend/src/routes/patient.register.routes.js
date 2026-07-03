import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { asyncHandler } from '../middleware/async.middleware.js';
import { signToken } from '../utils/jwt.js';
import { User } from '../models/User.js';

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    });

    const { email, password } = schema.parse(req.body);

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, role: 'patient' });

    const token = signToken({ sub: user._id.toString(), email: user.email, role: 'patient' });
    res.status(201).json({ token });
  })
);

export default router;

