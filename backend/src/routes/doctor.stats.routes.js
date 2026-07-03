import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { asyncHandler } from '../middleware/async.middleware.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { Appointment } from '../models/Appointment.js';
import { Feedback } from '../models/Feedback.js';

const router = Router();

function getISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function parseStartTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutesToHHmm(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getLastMonths(count, baseDate) {
  const out = [];
  const date = new Date(baseDate);
  date.setDate(1);

  for (let i = count - 1; i >= 0; i -= 1) {
    const current = new Date(date);
    current.setMonth(date.getMonth() - i);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    out.push(`${y}-${m}`);
  }
  return out;
}

function getWeekdayName(index) {
  return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][index];
}

function getPeriodRange(period, baseDate) {
  const date = new Date(`${getISODate(baseDate)}T00:00:00`);
  const mapping = {
    today: 0,
    week: 6,
    month: 29,
    quarter: 89,
    '3m': 89,
    year: 364,
  };
  const days = mapping[period] ?? 29;
  return {
    from: getISODate(addDays(date, -days)),
    to: getISODate(date),
  };
}

router.get(
  '/stats',
  requireAuth,
  requireRole(['doctor']),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      period: z.enum(['today', 'week', 'month', 'quarter', 'year']).default('month'),
      date: z.string().min(1).optional(),
    });

    const { period, date } = schema.parse({
      period: req.query.period,
      date: req.query.date,
    });

    const doctorId = req.user.sub;

    const doctor = await DoctorProfile.findOne({ userId: doctorId }).lean();
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    const baseDate = date ? new Date(`${date}T00:00:00`) : new Date();
    const range = getPeriodRange(period, baseDate);

    const datesInRange = [];
    for (let d = new Date(`${range.from}T00:00:00`); d <= new Date(`${range.to}T23:59:59`); d.setDate(d.getDate() + 1)) {
      datesInRange.push(getISODate(d));
    }

    const apptsRange = await Appointment.find({
      doctorId,
      date: { $gte: range.from, $lte: range.to },
      status: { $in: ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] },
    })
      .select('date startTime status estimatedDelayMinutes startedAt finishedAt patientId')
      .lean();

    const apptsDoneRange = apptsRange.filter((a) => a.status === 'DONE');

    const apptsByDate = new Map();
    datesInRange.forEach((dateKey) => apptsByDate.set(dateKey, []));
    apptsRange.forEach((a) => {
      const list = apptsByDate.get(a.date);
      if (list) list.push(a);
    });

    const activitySeries = datesInRange.map((d) => ({
      date: d,
      count: (apptsByDate.get(d) || []).filter((a) => a.status === 'DONE').length,
    }));

    const today = getISODate(baseDate);
    const todays = await Appointment.find({
      doctorId,
      date: today,
      status: { $in: ['SCHEDULED', 'IN_PROGRESS', 'DONE', 'CANCELLED'] },
    })
      .sort({ startTime: 1 })
      .lean();

    const now = new Date();
    const enrichAppt = (a) => {
      const planned = new Date(`${a.date}T${a.startTime}:00`);
      const delay = Math.round((now.getTime() - planned.getTime()) / 60000);
      return { ...a, plannedStartDateTime: planned, estimatedDelayMinutes: delay };
    };
    const todaysEnriched = todays.map(enrichAppt);
    const inProgress = todaysEnriched.find((a) => a.status === 'IN_PROGRESS') || null;
    const firstScheduled = todaysEnriched.find((a) => a.status === 'SCHEDULED') || null;

    const delayCandidates = todaysEnriched.filter((a) => a.status === 'IN_PROGRESS' || a.status === 'DONE');
    const avgDelay = delayCandidates.length
      ? Math.round(delayCandidates.reduce((s, a) => s + (a.estimatedDelayMinutes ?? 0), 0) / delayCandidates.length)
      : 0;

    const dayDone = todaysEnriched.filter((a) => a.status === 'DONE').length;
    const dayRest = todaysEnriched.filter((a) => a.status === 'SCHEDULED').length;

    const weekDates = Array.from({ length: 7 }).map((_, i) => getISODate(addDays(baseDate, -(6 - i))));
    const lastWeekDates = Array.from({ length: 7 }).map((_, i) => getISODate(addDays(baseDate, -(13 - i))));

    const [apptsWeek, apptsLastWeek] = await Promise.all([
      Appointment.find({ doctorId, date: { $in: weekDates }, status: 'DONE' }).select('date').lean(),
      Appointment.find({ doctorId, date: { $in: lastWeekDates }, status: 'DONE' }).select('date').lean(),
    ]);

    const weekCount = apptsWeek.length;
    const lastWeekCount = apptsLastWeek.length;
    const weekDeltaPct = lastWeekCount === 0 ? (weekCount > 0 ? 100 : 0) : Math.round(((weekCount - lastWeekCount) / lastWeekCount) * 100);

    const feedbacksAll = await Feedback.find({ doctorId })
      .select('patientId rating comment createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const ratingAvg = feedbacksAll.length ? Math.round((feedbacksAll.reduce((s, f) => s + f.rating, 0) / feedbacksAll.length) * 10) / 10 : 0;
    const ratingCount = feedbacksAll.length;
    const lastFeedbacks = feedbacksAll.slice(0, 5);

    const nextDates = Array.from({ length: 3 }).map((_, i) => getISODate(addDays(baseDate, i + 1)));
    const nextAppts = await Appointment.find({
      doctorId,
      date: { $in: nextDates },
      status: { $in: ['SCHEDULED', 'IN_PROGRESS'] },
    })
      .sort({ date: 1, startTime: 1 })
      .select('date startTime status patientId')
      .limit(12)
      .lean();

    const occupiedTimes = new Set(todays.map((a) => a.startTime));

    const cancelledCount = apptsRange.filter((a) => a.status === 'CANCELLED').length;
    const totalCount = apptsRange.length;
    const cancellationRate = totalCount ? Math.round((cancelledCount / totalCount) * 100) : 0;
    const attendanceRate = totalCount ? Math.round(((totalCount - cancelledCount) / totalCount) * 100) : 0;

    const weekdayDurations = new Map();
    ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].forEach((day) => {
      weekdayDurations.set(day, { total: 0, count: 0 });
    });

    for (const a of apptsDoneRange) {
      if (!a.startedAt || !a.finishedAt) continue;
      const started = new Date(a.startedAt);
      const finished = new Date(a.finishedAt);
      const diff = Math.round((finished.getTime() - started.getTime()) / 60000);
      const label = getWeekdayName(started.getDay());
      const record = weekdayDurations.get(label);
      if (record) {
        record.total += diff;
        record.count += 1;
      }
    }

    const avgDurationByWeekday = Array.from(weekdayDurations.entries()).map(([label, record]) => ({
      label,
      avg: record.count ? Math.round(record.total / record.count) : 0,
    }));

    const timeSlotCounts = apptsRange.reduce((map, a) => {
      const hour = a.startTime?.split(':')?.[0] || '00';
      const label = `${hour}:00`;
      map[label] = (map[label] || 0) + 1;
      return map;
    }, {});

    const timeSlotPopularity = Object.entries(timeSlotCounts)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const months = getLastMonths(12, baseDate);
    const monthStart = `${months[0]}-01`;
    const monthEnd = `${months[months.length - 1]}-31`;

    const apptsDone12 = await Appointment.find({
      doctorId,
      date: { $gte: monthStart, $lte: monthEnd },
      status: 'DONE',
    })
      .select('date patientId')
      .lean();

    const patientPerMonthMap = new Map(months.map((m) => [m, new Set()]));
    apptsDone12.forEach((a) => {
      const month = a.date.slice(0, 7);
      const set = patientPerMonthMap.get(month);
      if (set) set.add(a.patientId?.toString?.() || '');
    });

    const patientsPerMonth = months.map((m) => ({ month: m, count: patientPerMonthMap.get(m)?.size ?? 0 }));

    const ratingByMonthMap = new Map(months.map((m) => [m, { total: 0, count: 0 }]));
    feedbacksAll.forEach((f) => {
      const month = `${new Date(f.createdAt).getFullYear()}-${String(new Date(f.createdAt).getMonth() + 1).padStart(2, '0')}`;
      const record = ratingByMonthMap.get(month);
      if (record) {
        record.total += f.rating;
        record.count += 1;
      }
    });

    const ratingEvolution = months.map((m) => {
      const record = ratingByMonthMap.get(m);
      return {
        month: m,
        avg: record && record.count ? Math.round((record.total / record.count) * 10) / 10 : 0,
      };
    });

    const payload = {
      meta: { period, range },
      today: {
        date: today,
        dayDoneCount: dayDone,
        dayRemainingCount: dayRest,
        avgDelayMinutes: avgDelay,
        inProgressId: inProgress?._id?.toString?.() || null,
        firstScheduledId: firstScheduled?._id?.toString?.() || null,
        queue: todaysEnriched
          .map((a) => ({
            appointmentId: a._id.toString(),
            date: a.date,
            startTime: a.startTime,
            status: a.status,
            estimatedDelayMinutes: a.estimatedDelayMinutes ?? 0,
            cabinetOpenedAt: a.cabinetOpenedAt || null,
            startedAt: a.startedAt || null,
            finishedAt: a.finishedAt || null,
            cancelledReason: a.cancelledReason || null,
            patientId: a.patientId.toString(),
          }))
          .sort((x, y) => (x.startTime < y.startTime ? -1 : 1)),
      },
      weekVsLastWeek: {
        currentWeekDoneCount: weekCount,
        lastWeekDoneCount: lastWeekCount,
        deltaPct: weekDeltaPct,
      },
      rating: {
        avg: ratingAvg,
        count: ratingCount,
        lastFeedbacks: lastFeedbacks.map((f) => ({
          feedbackId: f._id?.toString?.() || undefined,
          rating: f.rating,
          comment: f.comment,
          createdAt: f.createdAt,
          patientId: f.patientId.toString(),
        })),
      },
      activity: {
        series: activitySeries,
      },
      nextAppointments: nextAppts,
      occupiedSlots: {
        occupiedTimes: Array.from(occupiedTimes),
      },
      analytics: {
        patientsPerMonth,
        timeSlotPopularity,
        cancellationRate,
        absenceRate: cancellationRate,
        attendanceRate,
        avgDurationByWeekday,
        ratingEvolution,
      },
    };

    res.json(payload);
  })
);

export default router;

