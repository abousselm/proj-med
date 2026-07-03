// frontend/src/api/socketClient.js

// Helper d’import dynamique pour ne pas casser le build si socket.io-client
// n’est pas installé dans les dépendances (phase 0).

export function createSocketClient({ baseUrl, onDoctorToday, onPatientAppointment }) {
  // Pour éviter un échec de build (module manquant), on ne fait aucun import statique.
  // La création socket n'est donc possible que si le module est réellement disponible côté runtime.

  const modName = 'socket.io-client';

  return new Promise((resolve) => {
    try {
      // eslint-disable-next-line no-new-func
      const loader = new Function('return import(modName);');
      loader().then((m) => {
        const { io } = m;
        const socket = io(baseUrl, { withCredentials: true });
        if (onDoctorToday) socket.on('doctor:today', onDoctorToday);
        if (onPatientAppointment) socket.on('patient:appointment', onPatientAppointment);
        resolve(socket);
      }).catch(() => resolve(null));
    } catch {
      resolve(null);
    }
  });
}



