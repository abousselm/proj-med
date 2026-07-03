export function doctorDateRoom(doctorId, date) {
  return `doctor:${doctorId}:date:${date}`;
}

export function patientRoom(patientId) {
  return `patient:${patientId}`;
}

