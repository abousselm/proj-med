import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { asyncHandler } from '../middleware/async.middleware.js';
import { signToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { DoctorProfile } from '../models/DoctorProfile.js';

import { uploadDoctorDocs } from '../middleware/multer.middleware.js';
import { toPublicUrl } from '../utils/upload.js';

const router = Router();

const specialties = [
  'Généraliste',
  'Cardiologue',
  'Dermatologue',
  'Pédiatre',
  'Dentiste',
  'Gynécologue',
  'Ophtalmologue',
  'Chirurgien',
  'ORL',
  'Psychiatre',
  'Autre',
];

const languagesAllowed = ['Arabe', 'Français', 'Anglais'];

function parseArrayOfStrings(v) {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') {
    // might be JSON or comma separated
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch (_) {
      // ignore
    }
    return v
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

router.post(
  '/register',
  uploadDoctorDocs.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'officePhoto', maxCount: 1 },
    { name: 'documents', maxCount: 10 },
  ]),
  asyncHandler(async (req, res) => {
    // multipart/form-data: fields come as strings in req.body
    const bodySchema = z.object({
      // Step 1
      email: z.string().email(),
      password: z.string().min(6),
      firstName: z.string().min(1).trim(),
      lastName: z.string().min(1).trim(),
      phoneNumber: z.string().min(1).trim(),
      // password confirmation not validated here (frontend does it), but enforce on backend
      confirmPassword: z.string().min(6),

      // Step 2
      specialty: z.enum(specialties),
      specialtyOther: z.string().optional().default(''),
      licenseNumber: z.string().min(1).trim(),
      yearsOfExperience: z.coerce.number().int().min(0),
      qualifications: z.string().optional().default(''),
      languages: z.string().optional().default(''),

      // Step 3
      cabinetName: z.string().min(1).trim(),
      address: z.string().min(1).trim(),
      city: z.string().optional().default(''),
      governorate: z.string().optional().default(''),
      consultationDurationMinutes: z.coerce.number().int().min(10).max(240).optional().default('30'),

      // Work hours passed as JSON string
      workHours: z.string().optional().default('[]'),

      // Verification logic
      verificationStatus: z.enum(['actif', 'en_attente']).optional().default('actif'),
      profileNonVerifiedBadge: z.coerce.boolean().optional().default(true),
    });

    const parsed = bodySchema.parse({ ...req.body });

    if (parsed.password !== parsed.confirmPassword) {
      return res.status(400).json({ message: 'Les mots de passe ne correspondent pas' });
    }

    const existing = await User.findOne({ email: parsed.email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    let specialtyFinal = parsed.specialty;
    if (parsed.specialty === 'Autre') {
      if (!parsed.specialtyOther || !parsed.specialtyOther.trim()) {
        return res.status(400).json({ message: "Spécialité 'Autre' nécessite un libellé" });
      }
      specialtyFinal = parsed.specialtyOther.trim();
    }

    const qualifications = parseArrayOfStrings(parsed.qualifications)
      .map((s) => s.trim())
      .filter(Boolean);

    const languages = parseArrayOfStrings(parsed.languages)
      .filter((l) => languagesAllowed.includes(l));

    let workHours = [];
    try {
      workHours = JSON.parse(parsed.workHours || '[]');
    } catch (_) {
      workHours = [];
    }

    // Upload URLs
    const profilePhotoFile = req.files?.profilePhoto?.[0];
    const officePhotoFile = req.files?.officePhoto?.[0];
    const documentsFiles = req.files?.documents ?? [];

    const profilePhotoUrl = profilePhotoFile ? toPublicUrl(profilePhotoFile.path) : '';
    const officePhotoUrl = officePhotoFile ? toPublicUrl(officePhotoFile.path) : '';
    const documents = documentsFiles.map((f) => toPublicUrl(f.path));

    // Create user as doctor
    const passwordHash = await bcrypt.hash(parsed.password, 10);
    const user = await User.create({
      email: parsed.email.toLowerCase().trim(),
      passwordHash,
      role: 'doctor',
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      phoneNumber: parsed.phoneNumber,
    });

    await DoctorProfile.create({
      userId: user._id,

      verificationStatus: 'actif',
      profileNonVerifiedBadge: true,

      cabinetName: parsed.cabinetName,
      specialty: specialtyFinal,
      specialtyOther: parsed.specialty === 'Autre' ? parsed.specialtyOther.trim() : '',
      address: parsed.address,
      photoUrl: profilePhotoUrl,

      officeName: parsed.cabinetName,
      city: parsed.city,
      governorate: parsed.governorate,

      licenseNumber: parsed.licenseNumber,
      yearsOfExperience: parsed.yearsOfExperience,
      qualifications,
      languages,

      consultationDurationMinutes: parsed.consultationDurationMinutes,
      workHours,

      hours: {
        open: workHours?.[0]?.open ?? '09:00',
        close: workHours?.[0]?.close ?? '17:00',
      },

      officePhotoUrl,
      documents,
    });

    const token = signToken({ sub: user._id.toString(), email: user.email, role: 'doctor' });
    res.status(201).json({ token });
  })
);

export default router;

