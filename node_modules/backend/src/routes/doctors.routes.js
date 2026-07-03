import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../middleware/async.middleware.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { User } from '../models/User.js';
import { Appointment } from '../models/Appointment.js';

const router = Router();

function getTodayString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToMinutes(t) {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function buildSlotsForDoctor(doctor, dateStr) {
  const openMins = timeToMinutes(doctor?.hours?.open ?? '09:00');
  const closeMins = timeToMinutes(doctor?.hours?.close ?? '17:00');

  const start = openMins;
  const end = closeMins;

  const slots = [];
  for (let t = start; t + 30 <= end; t += 30) {
    const hh = String(Math.floor(t / 60)).padStart(2, '0');
    const mm = String(t % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }

  return slots;
}

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = z.string().optional().parse(req.query.q ?? '').trim();
    const type = q?.toLowerCase() || '';

    // Simple search by specialty or cabinet name (case-insensitive)
    const docs = await DoctorProfile.find({
      $or: [
        { cabinetName: { $regex: type, $options: 'i' } },
        { specialty: { $regex: type, $options: 'i' } },
      ],
    }).limit(20);

    // Return basic doctor info
    const doctorIds = docs.map((d) => d.userId);
    const users = await User.find({ _id: { $in: doctorIds } }, { email: 1 });
    const emailById = new Map(users.map((u) => [u._id.toString(), u.email]));

    res.json(
      docs.map((d) => ({
        id: d.userId.toString(),
        cabinetName: d.cabinetName,
        specialty: d.specialty,
        address: d.address,
        hours: d.hours,
        email: emailById.get(d.userId.toString()),
      }))
    );
  })
);

// GET /api/doctors - list doctors for patient selection
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const doctors = await DoctorProfile.find({ verificationStatus: 'actif' }).lean();

    const doctorIds = doctors.map((d) => d.userId);

    const users = await User.find(
      { _id: { $in: doctorIds } },
      { firstName: 1, lastName: 1 }
    ).lean();

    const nameById = new Map(users.map((u) => [u._id.toString(), u]));

    const today = getTodayString(0);
    const tomorrow = getTodayString(1);

    const apptsToday = await Appointment.find({
      doctorId: { $in: doctorIds },
      date: today,
      status: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
    }).select('doctorId startTime');

    const apptsTomorrow = await Appointment.find({
      doctorId: { $in: doctorIds },
      date: tomorrow,
      status: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
    }).select('doctorId startTime');

    const busyByDoctorToday = new Map();
    for (const a of apptsToday) {
      const k = a.doctorId.toString();
      if (!busyByDoctorToday.has(k)) busyByDoctorToday.set(k, new Set());
      busyByDoctorToday.get(k).add(a.startTime);
    }

    const busyByDoctorTomorrow = new Map();
    for (const a of apptsTomorrow) {
      const k = a.doctorId.toString();
      if (!busyByDoctorTomorrow.has(k)) busyByDoctorTomorrow.set(k, new Set());
      busyByDoctorTomorrow.get(k).add(a.startTime);
    }

    const result = doctors.map((d) => {
      const user = nameById.get(d.userId.toString());
      const fullName = user ? `Dr. ${user.firstName} ${user.lastName}` : d.cabinetName;

      const todaySlots = buildSlotsForDoctor(d, today);
      const busyToday = busyByDoctorToday.get(d.userId.toString()) ?? new Set();
      const todayFree = todaySlots.filter((s) => !busyToday.has(s));

      let badge = { label: 'Prochain créneau :', tone: 'gray' };
      let nextAvailableText = '';

      if (todayFree.length > 0) {
        badge = { label: 'Disponible aujourd’hui', tone: 'green' };
        nextAvailableText = `Aujourd’hui (${todayFree.length} créneau${todayFree.length > 1 ? 'x' : ''} dispo)`;
      } else {
        const tomorrowSlots = buildSlotsForDoctor(d, tomorrow);
        const busyTomorrow = busyByDoctorTomorrow.get(d.userId.toString()) ?? new Set();
        const tomorrowFree = tomorrowSlots.filter((s) => !busyTomorrow.has(s));

        if (tomorrowFree.length > 0) {
          const [hh, mm] = tomorrowFree[0].split(':');
          badge = {
            label: `Prochain créneau : demain ${Number(hh)}h${mm === '00' ? '' : mm}`,
            tone: 'gray',
          };
          nextAvailableText = `Demain • ${tomorrowFree[0]}`;
        } else {
          badge = { label: `Prochain créneau : bientôt`, tone: 'gray' };
          nextAvailableText = '';
        }
      }

      return {
        id: d.userId.toString(),
        firstName: user?.firstName ?? '',
        lastName: user?.lastName ?? '',
        fullName,
        specialty: d.specialty,
        photoUrl: d.photoUrl || '',
        address: d.address,
        ratingAvg: d.ratingAvg,
        ratingCount: d.ratingCount,
        badge,
        nextAvailableText,
      };
    });

    res.json(result);
  })
);

export default router;


