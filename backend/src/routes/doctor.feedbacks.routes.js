import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { asyncHandler } from '../middleware/async.middleware.js';
import { Appointment } from '../models/Appointment.js';
import { Feedback } from '../models/Feedback.js';
import { Notification } from '../models/Notification.js';

const router = Router();

// Route minimaliste: un patient peut laisser un feedback une fois qu’un rendez-vous est terminé.
// (Optionnel pour ton dashboard, mais utile pour alimenter la data.)
router.post(
  '/',
  requireAuth,
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      appointmentId: z.string().min(1),
      rating: z.number().int().min(1).max(5),
      comment: z.string().optional().default(''),
    });

    const { appointmentId, rating, comment } = schema.parse(req.body);

    const appt = await Appointment.findById(appointmentId).lean();
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.patientId.toString() !== req.user.sub) return res.status(403).json({ message: 'Forbidden' });
    if (appt.status !== 'DONE') return res.status(400).json({ message: 'Feedback allowed only for DONE appointments' });

    const existing = await Feedback.findOne({ doctorId: appt.doctorId, patientId: req.user.sub });
    if (existing) return res.status(409).json({ message: 'Feedback already exists' });

    const fb = await Feedback.create({
      doctorId: appt.doctorId,
      patientId: req.user.sub,
      appointmentId,
      rating,
      comment,
    });

    await Notification.create({
      userId: appt.doctorId,
      type: 'FEEDBACK_RECEIVED',
      title: 'Nouveau feedback patient',
      message: `Vous avez reçu ${rating}/5 de votre patient.`,
    });

    res.status(201).json({ feedback: fb });
  })
);

export default router;

