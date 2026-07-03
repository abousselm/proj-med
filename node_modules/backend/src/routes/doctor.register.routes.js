import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { asyncHandler } from '../middleware/async.middleware.js';
import { signToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { DoctorProfile } from '../models/DoctorProfile.js';

const router = Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      cabinetName: z.string().min(1),
      specialty: z.string().min(1),
      address: z.string().min(1),
      hours: z
        .object({
          open: z.string().default('09:00'),
          close: z.string().default('17:00'),
        })
        .optional(),
    });

    const { email, password, cabinetName, specialty, address, hours } = schema.parse(req.body);

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    // Create user as doctor
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash, role: 'doctor' });

    await DoctorProfile.create({
      userId: user._id,
      cabinetName,
      specialty,
      address,
      hours: hours ?? undefined,
    });

    const token = signToken({ sub: user._id.toString(), email: user.email, role: 'doctor' });
    res.status(201).json({ token });
  })
);

export default router;

