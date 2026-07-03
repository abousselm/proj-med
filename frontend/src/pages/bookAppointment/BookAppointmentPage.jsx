import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api/client.js';

import './BookAppointmentPage.css';

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) || '';
}

function getTodayString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function BookAppointmentPage() {
  const doctorId = getQueryParam('doctorId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [token] = useState(() => localStorage.getItem('token') || '');

  const [date, setDate] = useState(getTodayString(0));
  const [slots, setSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  const dates = useMemo(() => [getTodayString(0), getTodayString(1)], []);

  useEffect(() => {
    if (!doctorId) {
      setLoading(false);
      setError('doctorId manquant');
      return;
    }
    if (!token) {
      setLoading(false);
      setError('Veuillez vous connecter.');
      return;
    }

    setLoading(true);
    setError('');
    setSelectedTime('');

    apiRequest(`/appointments/slots?doctorId=${encodeURIComponent(doctorId)}&date=${encodeURIComponent(date)}`, {
      token,
    })
      .then((res) => {
        setSlots(Array.isArray(res?.slots) ? res.slots : []);
      })
      .catch((err) => setError(err.message || 'Erreur lors du chargement des créneaux'))
      .finally(() => setLoading(false));
  }, [doctorId, date, token]);

  async function onBook() {
    if (!selectedTime) return;
    setBookingLoading(true);
    setError('');

    try {
      await apiRequest('/appointments', {
        method: 'POST',
        token,
        body: {
          doctorId,
          date,
          startTime: selectedTime,
        },
      });

      window.location.href = '/me';
    } catch (err) {
      setError(err.message || 'Erreur lors de la réservation');
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <div className="bookLayout pageWrap pageEnter">
      <div className="pageCard bookCard">
        <div className="pageInner">
          <h3 className="title">Prendre rendez-vous</h3>
          {error ? <p className="error">{error}</p> : null}

          <div className="bookGrid">
            <div className="bookPanel">
              <div className="pill">Doctor ID: {doctorId || '—'}</div>

              <div className="field">
                <div className="label">Date</div>
                <div className="dateRow">
                  {dates.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`dateChip ${d === date ? 'dateChipActive' : ''}`}
                      onClick={() => setDate(d)}
                    >
                      {d === getTodayString(0) ? 'Aujourd’hui' : 'Demain'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <div className="label">Créneaux</div>
                {loading ? (
                  <div className="slotsLoading">Chargement...</div>
                ) : slots.length === 0 ? (
                  <div className="slotsEmpty">Aucun créneau disponible.</div>
                ) : (
                  <div className="slotsGrid">
                    {slots.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!s.available}
                        className={`slotChip ${selectedTime === s.time ? 'slotActive' : ''} ${!s.available ? 'slotDisabled' : ''}`}
                        onClick={() => setSelectedTime(s.time)}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button className="btn bookBtn" disabled={!selectedTime || bookingLoading || loading} onClick={onBook}>
                {bookingLoading ? 'Réservation...' : 'Confirmer le rendez-vous'}
              </button>

              <button
                type="button"
                className="btnSecondary"
                onClick={() => {
                  window.location.href = '/choose-doctor';
                }}
              >
                ← Changer de médecin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

