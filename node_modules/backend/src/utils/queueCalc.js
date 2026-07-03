// Queue calculation helpers

function parseDate(date) {
  // date: YYYY-MM-DD
  return date;
}

function minutesDiff(a, b) {
  // a-b in minutes where each is Date
  return Math.round((a.getTime() - b.getTime()) / 60000);
}

export function computeQueueForAppointments({ appointments }) {
  // appointments: array for a doctor+date (only SCHEDULED or IN_PROGRESS)
  // Sort by planned start time
  const sorted = [...appointments].sort((x, y) => (x.startTime < y.startTime ? -1 : 1));

  // Determine now appointment
  const now = new Date();

  // Compute plannedStartDateTime from date + startTime
  const enriched = sorted.map((a) => {
    const planned = new Date(`${a.date}T${a.startTime}:00`);
    const delay = minutesDiff(now, planned); // positive => late, negative => early
    return {
      ...a,
      plannedStartDateTime: planned,
      estimatedDelayMinutes: delay,
    };
  });

  // Find who is currently IN_PROGRESS
  const inProgress = enriched.find((a) => a.status === 'IN_PROGRESS');

  // If none IN_PROGRESS, consider first by planned start time as next
  const firstScheduled = enriched.find((a) => a.status === 'SCHEDULED');

  return {
    enriched,
    inProgress,
    firstScheduled,
  };
}

export function derivePatientStatus({ queue, appointment }) {
  // queue: enriched + inProgress
  if (queue.inProgress) {
    const idx = queue.enriched.findIndex((a) => a._id.toString() === appointment._id.toString());
    const inIdx = queue.enriched.findIndex((a) => a._id.toString() === queue.inProgress._id.toString());

    // cabinet opened if doctor arrivedAt exists for this date
    const cabinetOpened = Boolean(appointment.cabinetOpenedAt);

    if (!cabinetOpened) {
      return { label: "Le cabinet n'est pas encore ouvert", kind: 'NOT_OPENED' };
    }

    if (appointment.status === 'IN_PROGRESS') {
      const delay = appointment.estimatedDelayMinutes ?? 0;
      if (delay > 5) return { label: `Retard estimé : ${delay} minutes`, kind: 'LATE' };
      if (delay < -5) return { label: `En avance : vous pouvez arriver ${Math.abs(delay)} min plus tôt`, kind: 'EARLY' };
      return { label: `À l'heure`, kind: 'ON_TIME' };
    }

    if (idx > inIdx) {
      // waiting
      const ahead = idx - inIdx;
      if (ahead === 1) return { label: "C'est bientôt votre tour, merci de vous présenter à l'accueil", kind: 'INCOMING' };
      return { label: `En attente (${ahead}ème sur la file)`, kind: 'WAITING' };
    }

    if (appointment.status === 'SCHEDULED') {
      // before in progress: should not happen for this logic
      return { label: `En attente`, kind: 'WAITING' };
    }
  }

  // No in progress yet
  if (appointment.cabinetOpenedAt) {
    const delay = appointment.estimatedDelayMinutes ?? 0;
    if (delay > 5) return { label: `Retard estimé : ${delay} minutes`, kind: 'LATE' };
    if (delay < -5) return { label: `En avance : vous pouvez arriver ${Math.abs(delay)} min plus tôt`, kind: 'EARLY' };
    return { label: `À l'heure`, kind: 'ON_TIME' };
  }

  return { label: "Le cabinet n'est pas encore ouvert", kind: 'NOT_OPENED' };
}

