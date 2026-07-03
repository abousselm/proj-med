import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { asyncHandler } from '../middleware/async.middleware.js';
import { DoctorProfile } from '../models/DoctorProfile.js';

const router = Router();

router.get(
  '/cabinet',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const profile = await DoctorProfile.findOne({ userId: req.user.sub }).lean();
    if (!profile) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    res.json({ profile });
  })
);

router.put(
  '/cabinet',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      cabinetName: z.string().min(1).optional(),
      officeName: z.string().optional(),
      specialty: z.string().optional(),
      specialtyOther: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      governorate: z.string().optional(),
      licenseNumber: z.string().optional(),
      yearsOfExperience: z.coerce.number().int().min(0).optional(),
      qualifications: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional(),
      shortBio: z.string().optional(),
      consultationDurationMinutes: z.coerce.number().int().min(1).optional(),
      photoUrl: z.string().optional(),
      officePhotoUrl: z.string().optional(),
      notifications: z
        .object({
          email: z.boolean().optional(),
          sms: z.boolean().optional(),
          push: z.boolean().optional(),
        })
        .optional(),
      closedDates: z.array(z.string()).optional(),
    });

    const update = schema.parse(req.body);

    const profile = await DoctorProfile.findOne({ userId: req.user.sub });
    if (!profile) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    if (update.notifications) {
      profile.notifications = {
        ...profile.notifications,
        ...update.notifications,
      };
      delete update.notifications;
    }

    Object.assign(profile, update);
    await profile.save();

    res.json({ ok: true, profile });
  })
);

export default router;
