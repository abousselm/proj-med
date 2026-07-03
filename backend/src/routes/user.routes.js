import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../middleware/async.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { User } from '../models/User.js';
import { DoctorProfile } from '../models/DoctorProfile.js';

const router = Router();

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.sub).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const response = {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
      },
    };

    if (req.user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ userId: req.user.sub }).lean();
      if (profile) {
        response.doctorProfile = {
          cabinetName: profile.cabinetName,
          specialty: profile.specialty,
          specialtyOther: profile.specialtyOther,
          address: profile.address,
          city: profile.city,
          governorate: profile.governorate,
          photoUrl: profile.photoUrl,
          officePhotoUrl: profile.officePhotoUrl,
          shortBio: profile.shortBio,
          notifications: profile.notifications,
        };
      }
    }

    res.json(response);
  })
);

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phoneNumber: z.string().optional(),
      photoUrl: z.string().optional(),
      officePhotoUrl: z.string().optional(),
      shortBio: z.string().optional(),
    });

    const update = schema.parse(req.body);

    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (update.firstName !== undefined) user.firstName = update.firstName;
    if (update.lastName !== undefined) user.lastName = update.lastName;
    if (update.phoneNumber !== undefined) user.phoneNumber = update.phoneNumber;

    await user.save();

    const response = {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
      },
    };

    if (req.user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ userId: req.user.sub });
      if (profile) {
        if (update.photoUrl !== undefined) profile.photoUrl = update.photoUrl;
        if (update.officePhotoUrl !== undefined) profile.officePhotoUrl = update.officePhotoUrl;
        if (update.shortBio !== undefined) profile.shortBio = update.shortBio;
        await profile.save();

        response.doctorProfile = {
          cabinetName: profile.cabinetName,
          specialty: profile.specialty,
          specialtyOther: profile.specialtyOther,
          address: profile.address,
          city: profile.city,
          governorate: profile.governorate,
          photoUrl: profile.photoUrl,
          officePhotoUrl: profile.officePhotoUrl,
          shortBio: profile.shortBio,
          notifications: profile.notifications,
        };
      }
    }

    res.json(response);
  })
);

export default router;

