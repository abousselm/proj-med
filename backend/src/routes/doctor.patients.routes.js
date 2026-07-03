import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { asyncHandler } from '../middleware/async.middleware.js';

import { Appointment } from '../models/Appointment.js';
import { DoctorPatientNote } from '../models/DoctorPatientNote.js';
import { User } from '../models/User.js';

const router = Router();

function computeAppointmentStats(appointments) {
  // appointments: array of Appointment docs/lean
  const total = appointments.length;
  const last = appointments.length
    ? appointments
        .slice()
        .sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? 1 : -1) : a.date < b.date ? 1 : -1))[0]
    : null;

  const next = appointments
    .filter((a) => ['SCHEDULED', 'IN_PROGRESS'].includes(a.status))
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? -1 : 1))[0];

  return {
    totalConsultations: total,
    lastVisit: last ? { date: last.date, startTime: last.startTime } : null,
    nextAppointment: next
      ? { appointmentId: next._id?.toString?.() || next._id, date: next.date, startTime: next.startTime, status: next.status }
      : null,
  };
}

router.get(
  '/patients',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      q: z.string().trim().optional().default(''),
      sortBy: z
        .enum(['name', 'lastVisit', 'totalVisits'])
        .optional()
        .default('name'),
      sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
      limit: z.coerce.number().int().min(1).max(200).optional().default(100),
    });

    const { q, sortBy, sortDir, limit } = schema.parse({
      q: req.query.q,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
      limit: req.query.limit,
    });

    // We derive the set of patients from appointments.
    // Approach: fetch all appointments for this doctor (lean, only needed fields), grouped in JS.
    const appts = await Appointment.find({
      doctorId: req.user.sub,
    })
      .select('patientId date startTime status')
      .sort({ date: 1, startTime: 1 })
      .lean();

    const byPatient = new Map();
    for (const a of appts) {
      const pid = a.patientId?.toString?.() || a.patientId;
      if (!byPatient.has(pid)) byPatient.set(pid, []);
      byPatient.get(pid).push(a);
    }

    const patientsIds = Array.from(byPatient.keys());

    // Load patient profile fields
    const users = await User.find({ _id: { $in: patientsIds } })
      .select('firstName lastName phone email')
      .lean();

    const usersById = new Map(users.map((u) => [u._id.toString(), u]));

    const qLower = q.toLowerCase();

    const rows = patientsIds
      .map((pid) => {
        const u = usersById.get(pid);
        const appointments = byPatient.get(pid) || [];
        const stats = computeAppointmentStats(appointments);
        const fullName = `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

        return {
          patientId: pid,
          firstName: u?.firstName || '',
          lastName: u?.lastName || '',
          fullName: fullName || `Patient ${pid.slice(-4)}`,
          phone: u?.phoneNumber || u?.phone || null,
          email: u?.email || null,
          totalConsultations: stats.totalConsultations,
          lastVisit: stats.lastVisit, // {date,startTime}
          nextAppointment: stats.nextAppointment,
        };
      })
      .filter((row) => {
        if (!qLower) return true;
        return row.fullName.toLowerCase().includes(qLower);
      });

    // Enrich with notes existence (optional: only for ordering/preview; we add empty notes value)
    const notes = await DoctorPatientNote.find({
      doctorId: req.user.sub,
      patientId: { $in: patientsIds },
    })
      .select('patientId notes')
      .lean();
    const notesByPatient = new Map(notes.map((n) => [n.patientId.toString(), n.notes || '']));

    for (const r of rows) {
      r.privateNotes = notesByPatient.get(r.patientId) || '';
    }

    const dir = sortDir === 'desc' ? -1 : 1;

    rows.sort((a, b) => {
      if (sortBy === 'name') {
        return a.fullName.localeCompare(b.fullName) * dir;
      }
      if (sortBy === 'totalVisits') {
        return (a.totalConsultations - b.totalConsultations) * dir;
      }
      // lastVisit
      const aKey = a.lastVisit ? `${a.lastVisit.date}T${a.lastVisit.startTime}` : '';
      const bKey = b.lastVisit ? `${b.lastVisit.date}T${b.lastVisit.startTime}` : '';
      return (aKey < bKey ? -1 : aKey > bKey ? 1 : 0) * dir;
    });

    res.json({
      patients: rows.slice(0, limit),
    });
  })
);

router.get(
  '/patients/:patientId',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({ patientId: z.string().min(1) });
    const { patientId } = schema.parse({ patientId: req.params.patientId });

    const patient = await User.findById(patientId)
      .select('firstName lastName phoneNumber email birthDate photoUrl')
      .lean();

    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const appointments = await Appointment.find({
      doctorId: req.user.sub,
      patientId,
    })
      .sort({ date: 1, startTime: 1 })
      .lean();

    const notesDoc = await DoctorPatientNote.findOne({ doctorId: req.user.sub, patientId })
      .lean();

    res.json({
      patient: {
        patientId: patient._id.toString(),
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        fullName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
        age: patient.birthDate ? patient.birthDate : null,
        photoUrl: patient.photoUrl || null,
        phone: patient.phoneNumber || patient.phone || null,
        email: patient.email || null,
      },
      appointments: appointments.map((a) => ({
        appointmentId: a._id.toString(),
        date: a.date,
        startTime: a.startTime,
        status: a.status,
        cancelledReason: a.cancelledReason || null,
      })),
      privateNotes: notesDoc?.notes || '',
    });
  })
);

router.patch(
  '/patients/:patientId/notes',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      patientId: z.string().min(1),
      notes: z.string().optional().default(''),
    });

    const { patientId } = schema.pick({ patientId: true }).parse({ patientId: req.params.patientId });
    const { notes } = schema.parse({ patientId, notes: req.body?.notes });

    const existing = await DoctorPatientNote.findOne({ doctorId: req.user.sub, patientId });
    if (!existing) {
      const created = await DoctorPatientNote.create({
        doctorId: req.user.sub,
        patientId,
        notes,
      });
      return res.json({ ok: true, privateNotes: created.notes || '' });
    }

    existing.notes = notes;
    await existing.save();

    res.json({ ok: true, privateNotes: existing.notes || '' });
  })
);

export default router;

