// Doctor actions via REST for phase 1 (arrived / next / open cabinet)
// Note: Socket events are emitted from doctor routes via req.app.get('io')

import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../middleware/async.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
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

router.post(
  '/arrived',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({ date: z.string().min(1).optional() });
    const { date = getTodayString() } = schema.parse(req.body);

    const doctorId = req.user.sub;

    // Mark cabinet open for all appointments (same doctor+date)
    const now = new Date();
    await Appointment.updateMany(
      { doctorId, date, status: { $in: ['SCHEDULED', 'IN_PROGRESS'] } },
      { $set: { cabinetOpenedAt: now } }
    );

    const appts = await Appointment.find({ doctorId, date }).sort({ startTime: 1 });
    const queue = computeQueueForAppointments({ appointments: appts });

    // If there is already IN_PROGRESS, keep; else first scheduled becomes IN_PROGRESS
    let current = queue.inProgress;
    if (!current && queue.firstScheduled) {
      current = queue.firstScheduled;
      await Appointment.updateOne({ _id: current._id }, { $set: { status: 'IN_PROGRESS', startedAt: now } });
    }

    const refreshed = await Appointment.find({ doctorId, date }).sort({ startTime: 1 });

    // Notify patients of this doctor/date
    const io = req.app.get('io');
    for (const a of refreshed) {
      if (a.status === 'CANCELLED') continue;
      await Notification.create({
        userId: a.patientId,
        type: 'CABINET_OPENED',
        title: 'Le cabinet est ouvert',
        message: `Le cabinet est ouvert. Votre rendez-vous est prévu à ${a.startTime}.`,
      });
    }

    emitDoctorTodayUpdated(io, { doctorId, date, payload: { date, appointments: refreshed } });

    // Emit to all patients rooms
    for (const a of refreshed) {
      emitPatientUpdated(io, {
        patientId: a.patientId.toString(),
        payload: { appointmentId: a._id.toString(), status: a.status, date: a.date, startTime: a.startTime },
      });
    }

    res.json({ ok: true });
  })
);

router.post(
  '/next',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({ date: z.string().min(1).optional() });
    const { date = getTodayString() } = schema.parse(req.body);

    const doctorId = req.user.sub;
    const now = new Date();

    // Finish current
    const current = await Appointment.findOne({ doctorId, date, status: 'IN_PROGRESS' });
    if (current) {
      current.status = 'DONE';
      current.finishedAt = now;
      await current.save();

      await Notification.create({
        userId: current.patientId,
        type: 'TURN_INCOMING',
        title: 'Votre prochaine étape',
        message: 'Votre consultation est terminée. Merci.',
      });
    }

    // Next scheduled becomes IN_PROGRESS
    const next = await Appointment.findOne({
      doctorId,
      date,
      status: { $in: ['SCHEDULED'] },
    }).sort({ startTime: 1 });

    if (!next) {
      return res.json({ ok: true, message: 'No next appointment' });
    }

    next.status = 'IN_PROGRESS';
    next.startedAt = now;
    await next.save();

    // Recalculate delay for remaining by updating estimatedDelayMinutes on read (phase 1: skip persisting)
    const remaining = await Appointment.find({ doctorId, date }).sort({ startTime: 1 });

    const io = req.app.get('io');

    // Emit doctor dashboard update
    emitDoctorTodayUpdated(io, { doctorId, date, payload: { date, appointments: remaining } });

    // Notify incoming patient + next next (simplified: notify all scheduled)
    const patientIds = remaining.filter((a) => a.status === 'SCHEDULED' || a._id.toString() === next._id.toString()).map((a) => a.patientId.toString());

    for (const pid of patientIds) {
      emitPatientUpdated(io, {
        patientId: pid,
        payload: { appointmentId: next._id.toString(), status: pid === next.patientId.toString() ? 'IN_PROGRESS' : 'SCHEDULED' },
      });
    }

    res.json({ ok: true });
  })
);

export default router;

