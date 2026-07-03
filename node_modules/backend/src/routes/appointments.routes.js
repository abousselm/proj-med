import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../middleware/async.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { Appointment } from '../models/Appointment.js';
import { Notification } from '../models/Notification.js';
import { computeQueueForAppointments } from '../utils/queueCalc.js';
import { emitDoctorTodayUpdated, emitPatientUpdated } from '../socket/index.js';

const router = Router();

function getTodayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

router.get(
  '/slots',
  requireAuth,
  asyncHandler(async (req, res) => {
    // very simplified: return 30-min slots between open/close for next date
    const querySchema = z.object({
      doctorId: z.string().min(1),
      date: z.string().min(1).default(getTodayString()),
    });
    const { doctorId, date } = querySchema.parse({
      doctorId: req.query.doctorId,
      date: req.query.date,
    });

    const doctor = await DoctorProfile.findOne({ userId: doctorId });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const [openH, openM] = (doctor.hours?.open || '09:00').split(':').map(Number);
    const [closeH, closeM] = (doctor.hours?.close || '17:00').split(':').map(Number);

    const start = openH * 60 + openM;
    const end = closeH * 60 + closeM;

    const slots = [];
    for (let t = start; t + 30 <= end; t += 30) {
      const hh = String(Math.floor(t / 60)).padStart(2, '0');
      const mm = String(t % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }

    const existing = await Appointment.find({
      doctorId,
      date,
      status: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
    }).select('startTime');

    const existingSet = new Set(existing.map((a) => a.startTime));

    res.json({
      doctorId,
      date,
      slots: slots.map((s) => ({ time: s, available: !existingSet.has(s) })),
    });
  })
);

router.post(
  '/',
  requireAuth,
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      doctorId: z.string().min(1),
      date: z.string().min(1),
      startTime: z.string().min(1),
    });
    const { doctorId, date, startTime } = schema.parse(req.body);

    const doctor = await DoctorProfile.findOne({ userId: doctorId });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const existing = await Appointment.findOne({ doctorId, patientId: req.user.sub, date, startTime });
    if (existing) return res.status(409).json({ message: 'You already have an appointment at this time' });

    const appointment = await Appointment.create({
      doctorId,
      patientId: req.user.sub,
      date,
      startTime,
      status: 'SCHEDULED',
    });

    // Notify patient (optional)
    await Notification.create({
      userId: req.user.sub,
      type: 'TURN_INCOMING',
      title: 'Rendez-vous confirmé',
      message: `Votre rendez-vous est confirmé pour le ${date} à ${startTime}.`,
    });

    res.status(201).json({ appointment });
  })
);

router.get(
  '/me',
  requireAuth,
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    const appts = await Appointment.find({
      patientId: req.user.sub,
    }).sort({ date: 1, startTime: 1 });

    res.json({ appointments: appts });
  })
);

router.get(
  '/doctor/today',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const date = req.query.date || getTodayString();
    const appts = await Appointment.find({
      doctorId: req.user.sub,
      date,
    }).sort({ startTime: 1 });

    const queue = computeQueueForAppointments({ appointments: appts });

    res.json({
      date,
      appointments: queue.enriched,
      inProgressId: queue.inProgress?._id?.toString() || null,
      firstScheduledId: queue.firstScheduled?._id?.toString() || null,
    });
  })
);

// Doctor agenda: single day
router.get(
  '/doctor/day',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      date: z.string().min(1).default(getTodayString()),
    });
    const { date } = schema.parse({ date: req.query.date });

    const appts = await Appointment.find({
      doctorId: req.user.sub,
      date,
    })
      .populate('patientId', 'firstName lastName phone email')
      .sort({ startTime: 1 });

    // for consistency with other endpoints
    const queue = computeQueueForAppointments({ appointments: appts });

    res.json({
      date,
      appointments: queue.enriched,
    });
  })
);

// Doctor agenda: range (week/month)
router.get(
  '/doctor/range',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      from: z.string().min(1),
      to: z.string().min(1),
    });
    const { from, to } = schema.parse(req.query);

    const appts = await Appointment.find({
      doctorId: req.user.sub,
      date: { $gte: from, $lte: to },
    })
      .populate('patientId', 'firstName lastName phone email')
      .sort({ date: 1, startTime: 1 });

    // keep as flat list; frontend can group by date
    res.json({
      from,
      to,
      appointments: appts,
    });
  })
);

// Patient history for doctor modal
router.get(
  '/patient/:patientId/history',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({ patientId: z.string().min(1) });
    const { patientId } = schema.parse({ patientId: req.params.patientId });

    const appts = await Appointment.find({
      doctorId: req.user.sub,
      patientId,
    })
      .sort({ date: 1, startTime: 1 })
      .lean();

    res.json({
      patientId,
      appointments: appts,
    });
  })
);

// Doctor actions on an appointment
router.patch(
  '/doctor/:id',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      action: z.enum(['UPDATE', 'CANCEL', 'DONE']),
      // UPDATE fields
      date: z.string().min(1).optional(),
      startTime: z.string().min(1).optional(),
      // CANCEL fields
      reason: z.string().optional(),
    });
    const { action, date, startTime, reason } = schema.parse(req.body);

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.doctorId.toString() !== req.user.sub) return res.status(403).json({ message: 'Forbidden' });

    if (action === 'CANCEL') {
      appt.status = 'CANCELLED';
      appt.cancelledReason = reason;
      await appt.save();

      await Notification.create({
        userId: appt.patientId,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Rendez-vous annulé',
        message: `Votre rendez-vous du ${appt.date} à ${appt.startTime} a été annulé.`,
      });

      return res.json({ ok: true, appointment: appt });
    }

    if (action === 'DONE') {
      appt.status = 'DONE';
      await appt.save();

      await Notification.create({
        userId: appt.patientId,
        type: 'TURN_INCOMING',
        title: 'Votre consultation est terminée',
        message: 'Votre rendez-vous est marqué comme terminé. Merci.',
      });

      return res.json({ ok: true, appointment: appt });
    }

    // UPDATE
    if (!date || !startTime) return res.status(400).json({ message: 'date and startTime required for UPDATE' });

    // Conflict check: same doctor+patient+date+startTime
    const conflict = await Appointment.findOne({
      doctorId: appt.doctorId,
      patientId: appt.patientId,
      date,
      startTime,
      _id: { $ne: appt._id },
    });
    if (conflict) return res.status(409).json({ message: 'This timeslot is already used for this patient' });

    appt.date = date;
    appt.startTime = startTime;
    appt.status = 'SCHEDULED';
    appt.cancelledReason = undefined;
    await appt.save();

    return res.json({ ok: true, appointment: appt });
  })
);


// Patient cancel (simplified)
router.patch(
  '/:id',
  requireAuth,
  requireRole(['patient']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      action: z.enum(['CANCEL', 'RESCHEDULE']).default('CANCEL'),
      reason: z.string().optional(),
      newDate: z.string().optional(),
      newStartTime: z.string().optional(),
    });
    const { action, reason, newDate, newStartTime } = schema.parse(req.body);

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.patientId.toString() !== req.user.sub) return res.status(403).json({ message: 'Forbidden' });

    if (action === 'CANCEL') {
      appt.status = 'CANCELLED';
      appt.cancelledReason = reason;
      await appt.save();

      await Notification.create({
        userId: appt.patientId,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Rendez-vous annulé',
        message: `Votre rendez-vous a été annulé.`,
      });

      return res.json({ ok: true, appointment: appt });
    }

    // RESCHEDULE
    if (!newDate || !newStartTime) return res.status(400).json({ message: 'newDate and newStartTime required' });

    appt.date = newDate;
    appt.startTime = newStartTime;
    appt.status = 'SCHEDULED';
    await appt.save();

    return res.json({ ok: true, appointment: appt });
  })
);

export default router;

