import { Server } from 'socket.io';
import { doctorDateRoom, patientRoom } from './rooms.js';

export function attachSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    // Frontend can optionally join rooms
    socket.on('socket:joinDoctorDate', ({ doctorId, date }) => {
      if (!doctorId || !date) return;
      socket.join(doctorDateRoom(doctorId, date));
    });

    socket.on('socket:joinPatient', ({ patientId }) => {
      if (!patientId) return;
      socket.join(patientRoom(patientId));
    });
  });

  return io;
}

// Helpers to emit events
export function emitDoctorTodayUpdated(io, { doctorId, date, payload }) {
  io.to(doctorDateRoom(doctorId, date)).emit('doctor:today', payload);
}

export function emitPatientUpdated(io, { patientId, payload }) {
  io.to(patientRoom(patientId)).emit('patient:appointment', payload);
}

