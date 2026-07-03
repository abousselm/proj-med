import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../api/client.js';
import './DoctorAgendaPage.css';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateToYMD(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(ymd, days) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateToYMD(d);
}

function frDate(ymd) {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function formatTimeLabel(t) {
  return t;
}

function statusColor(status) {
  const s = status || '';
  if (s === 'SCHEDULED') return 'apptBlue';
  if (s === 'IN_PROGRESS') return 'apptBlue';
  if (s === 'DONE') return 'apptGreen';
  if (s === 'CANCELLED') return 'apptGray';
  return 'apptNeutral';
}

function isUpcoming(appt) {
  return appt.status === 'SCHEDULED' || appt.status === 'IN_PROGRESS';
}

function isDone(appt) {
  return appt.status === 'DONE';
}

function isCancelled(appt) {
  return appt.status === 'CANCELLED';
}

function getMonthGrid(ymd) {
  const base = new Date(`${ymd}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  // Monday-first grid
  const firstDay = first.getDay(); // 0 Sun..6 Sat
  const mondayIndex = (firstDay + 6) % 7; // Mon=0
  const start = new Date(year, month, 1 - mondayIndex);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(dateToYMD(d));
  }

  return {
    monthLabel: base.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    startYMD: dateToYMD(cells[0]),
    endYMD: dateToYMD(cells[cells.length - 1]),
    cells,
    firstMonthYMD: dateToYMD(first),
    lastMonthYMD: dateToYMD(last),
  };
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, children }) {
  return (
    <label className="field">
      <div className="fieldLabel">{label}</div>
      {children}
    </label>
  );
}

function getAppointmentPatientName(appt) {
  const p = appt.patientId;
  if (!p) return 'Patient';
  const fn = p.firstName || '';
  const ln = p.lastName || '';
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  return 'Patient';
}

export default function DoctorAgendaPage() {
  const token = useMemo(() => localStorage.getItem('token') || '', []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const todayYMD = useMemo(() => dateToYMD(new Date()), []);
  const [viewMode, setViewMode] = useState('day'); // day | week | month
  const [anchorDate, setAnchorDate] = useState(todayYMD);

  const [filter, setFilter] = useState('ALL'); // ALL | UPCOMING | DONE | CANCELLED
  const [search, setSearch] = useState('');

  const [appointmentsByDate, setAppointmentsByDate] = useState({}); // ymd -> [appt]
  const [slotsByDate, setSlotsByDate] = useState({}); // ymd -> [{time, available}]

  const [selectedAppt, setSelectedAppt] = useState(null);
  const [history, setHistory] = useState([]);
  const [patientModalOpen, setPatientModalOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ date: todayYMD, startTime: '09:00', patientId: '' });

  const [editBusy, setEditBusy] = useState(false);

  const dateRange = useMemo(() => {
    if (viewMode === 'day') return { from: anchorDate, to: anchorDate };
    if (viewMode === 'week') return { from: addDays(anchorDate, -3), to: addDays(anchorDate, 3) };

    // month
    const base = new Date(`${anchorDate}T00:00:00`);
    const year = base.getFullYear();
    const month = base.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return { from: dateToYMD(first), to: dateToYMD(last) };
  }, [anchorDate, viewMode]);

  const visibleDates = useMemo(() => {
    if (viewMode === 'day') return [anchorDate];
    if (viewMode === 'week') {
      return Array.from({ length: 7 }).map((_, i) => addDays(anchorDate, i - 3));
    }

    // month grid will include leading/trailing days, but badges/blocks should use the grid.
    const grid = getMonthGrid(anchorDate);
    return grid.cells;
  }, [anchorDate, viewMode]);

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();

    const matchesFilter = (appt) => {
      if (filter === 'ALL') return true;
      if (filter === 'UPCOMING') return isUpcoming(appt);
      if (filter === 'DONE') return isDone(appt);
      if (filter === 'CANCELLED') return isCancelled(appt);
      return true;
    };

    const matchesSearch = (appt) => {
      if (!q) return true;
      const name = getAppointmentPatientName(appt).toLowerCase();
      return name.includes(q);
    };

    const out = {};
    for (const [ymd, list] of Object.entries(appointmentsByDate)) {
      out[ymd] = (list || []).filter((a) => matchesFilter(a) && matchesSearch(a));
    }
    return out;
  }, [appointmentsByDate, filter, search]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError('');

        const data = await apiRequest('/appointments/doctor/range', {
          token,
          method: 'GET',
          params: {
            from: dateRange.from,
            to: dateRange.to,
          },
        });

        if (!alive) return;

        const byDate = {};
        for (const a of data.appointments || []) {
          const y = a.date;
          if (!byDate[y]) byDate[y] = [];
          byDate[y].push(a);
        }
        for (const y of Object.keys(byDate)) {
          byDate[y].sort((x, y2) => (x.startTime < y2.startTime ? -1 : 1));
        }
        setAppointmentsByDate(byDate);

        // Day view: load slots for anchor date to show free/occupied indicator
        if (viewMode === 'day') {
          setSlotsByDate({});
        } else {
          setSlotsByDate({});
        }
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Erreur chargement agenda');
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [token, dateRange.from, dateRange.to, viewMode, anchorDate]);

  async function openAppointmentModal(appt) {
    setSelectedAppt(appt);
    setPatientModalOpen(true);
    setHistory([]);

    try {
      const historyUrl = `/appointments/patient/${encodeURIComponent(
        appt.patientId?._id || appt.patientId
      )}/history`;
      const data = await apiRequest(historyUrl, {
        token,
        method: 'GET',
      });
      setHistory(data.appointments || []);
    } catch {
      // best effort
    }
  }

  async function handleDoctorAction(action, payload = {}) {
    if (!selectedAppt) return;
    setEditBusy(true);
    try {
      await apiRequest(`/appointments/doctor/${selectedAppt._id}`, {
        token,
        method: 'PATCH',
        body: {
          action,
          ...payload,
        },
      });

      // Refresh range
      const data = await apiRequest('/appointments/doctor/range', {
        token,
        method: 'GET',
        params: {
          from: dateRange.from,
          to: dateRange.to,
        },
      });

      const byDate = {};
      for (const a of data.appointments || []) {
        const y = a.date;
        if (!byDate[y]) byDate[y] = [];
        byDate[y].push(a);
      }
      for (const y of Object.keys(byDate)) {
        byDate[y].sort((x, y2) => (x.startTime < y2.startTime ? -1 : 1));
      }

      setAppointmentsByDate(byDate);
      setPatientModalOpen(false);
      setSelectedAppt(null);
    } catch (e) {
      setError(e?.message || 'Erreur action rendez-vous');
    } finally {
      setEditBusy(false);
    }
  }

  const monthGrid = useMemo(() => (viewMode === 'month' ? getMonthGrid(anchorDate) : null), [anchorDate, viewMode]);

  const busyDays = useMemo(() => {
    const out = new Set();
    for (const [ymd, list] of Object.entries(filteredAppointments)) {
      if ((list || []).length) out.add(ymd);
    }
    return out;
  }, [filteredAppointments]);

  const navLabel = useMemo(() => {
    if (viewMode === 'day') return frDate(anchorDate);
    if (viewMode === 'week') return `${frDate(dateRange.from)} — ${frDate(dateRange.to)}`;
    return monthGrid?.monthLabel || '';
  }, [viewMode, anchorDate, dateRange.from, dateRange.to, monthGrid]);

  function step(delta) {
    if (viewMode === 'day') setAnchorDate(addDays(anchorDate, delta));
    else if (viewMode === 'week') setAnchorDate(addDays(anchorDate, delta * 7));
    else {
      const d = new Date(`${anchorDate}T00:00:00`);
      d.setMonth(d.getMonth() + delta);
      setAnchorDate(dateToYMD(d));
    }
  }

  const hours = useMemo(() => {
    // simple 9:00 -> 17:00
    const start = 9 * 60;
    const end = 17 * 60;
    const arr = [];
    for (let t = start; t <= end; t += 60) {
      const hh = pad2(Math.floor(t / 60));
      arr.push(hh + ':00');
    }
    return arr;
  }, []);

  return (
    <div className="agendaPage">
      <div className="agendaHeader">
        <div className="agendaTitleWrap">
          <div className="agendaTitle">Mes rendez-vous</div>
          <div className="agendaSub">{navLabel}</div>
        </div>

        <div className="agendaControls">
          <div className="segmented">
            <button type="button" className={`segBtn ${viewMode === 'day' ? 'segBtnOn' : ''}`} onClick={() => setViewMode('day')}>
              Jour
            </button>
            <button type="button" className={`segBtn ${viewMode === 'week' ? 'segBtnOn' : ''}`} onClick={() => setViewMode('week')}>
              Semaine
            </button>
            <button type="button" className={`segBtn ${viewMode === 'month' ? 'segBtnOn' : ''}`} onClick={() => setViewMode('month')}>
              Mois
            </button>
          </div>

          <div className="dateNav">
            <button type="button" className="btnNav" onClick={() => step(-1)}>
              ‹
            </button>
            <button type="button" className="btnNavToday" onClick={() => setAnchorDate(todayYMD)}>
              Aujourd’hui
            </button>
            <button type="button" className="btnNav" onClick={() => step(1)}>
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="agendaToolbar">
        <div className="filters">
          <label className="field">
            <div className="fieldLabel">Statut</div>
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="ALL">Tous</option>
              <option value="UPCOMING">À venir</option>
              <option value="DONE">Terminés</option>
              <option value="CANCELLED">Annulés</option>
            </select>
          </label>

          <label className="field">
            <div className="fieldLabel">Recherche patient</div>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom du patient"
            />
          </label>
        </div>

        <div className="toolbarRight">
          <button type="button" className="btnPrimary" onClick={() => { setCreateForm((p) => ({ ...p, date: anchorDate })); setCreateOpen(true); }}>
            + Nouveau rendez-vous
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {loading ? (
        <div className="agendaLoading">Chargement…</div>
      ) : (
        <div className="agendaBody">
          {viewMode === 'day' ? (
            <div className="dayGrid">
              <div className="dayHours">
                {hours.map((h) => (
                  <div key={h} className="hourLabel">
                    {h}
                  </div>
                ))}
              </div>

              <div className="dayMain">
                {hours.map((h, idx) => {
                  const ymd = anchorDate;
                  const list = filteredAppointments[ymd] || [];
                  const apptsAtHour = list.filter((a) => a.startTime.startsWith(h.slice(0, 2)));
                  const topPct = 0 + idx * 1; // for alignment
                  return (
                    <div key={h} className="daySlotRow" aria-label={`Créneau ${h}`}>
                      <div className="daySlotFree">&nbsp;</div>
                      <div className="dayApptCells">
                        {apptsAtHour.length ? (
                          apptsAtHour.map((a) => (
                            <button
                              type="button"
                              key={a._id}
                              className={`apptBlock ${statusColor(a.status)} ${a.status === 'CANCELLED' ? 'apptStrike' : ''}`}
                              onClick={() => openAppointmentModal(a)}
                            >
                              <div className="apptTime">{formatTimeLabel(a.startTime)}</div>
                              <div className="apptPatient">{getAppointmentPatientName(a)}</div>
                            </button>
                          ))
                        ) : (
                          <div className="freeHint">(libre)</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {viewMode === 'week' ? (
            <div className="weekGrid">
              <div className="weekHead">
                {visibleDates.map((d) => (
                  <div key={d} className={`weekHeadCell ${d === anchorDate ? 'weekHeadToday' : ''}`}>
                    <div className="weekHeadDay">{new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                    <div className="weekHeadDate">{new Date(`${d}T00:00:00`).getDate()}</div>
                  </div>
                ))}
              </div>

              <div className="weekBody">
                {visibleDates.map((d) => {
                  const list = filteredAppointments[d] || [];
                  return (
                    <div key={d} className="weekDayCell" onDoubleClick={() => setAnchorDate(d)}>
                      {list.length ? (
                        list.map((a) => (
                          <button
                            type="button"
                            key={a._id}
                            className={`apptBlock ${statusColor(a.status)} ${a.status === 'CANCELLED' ? 'apptStrike' : ''}`}
                            onClick={() => openAppointmentModal(a)}
                          >
                            <div className="apptTime">{a.startTime}</div>
                            <div className="apptPatient">{getAppointmentPatientName(a)}</div>
                          </button>
                        ))
                      ) : (
                        <div className="freeWeek">Libre</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {viewMode === 'month' ? (
            <div className="monthGrid">
              <div className="monthWeekdays">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((x) => (
                  <div key={x} className="monthWeekday">
                    {x}
                  </div>
                ))}
              </div>

              <div className="monthCells">
                {monthGrid.cells.map((d) => {
                  const inMonth = d >= monthGrid.firstMonthYMD && d <= monthGrid.lastMonthYMD;
                  const hasAppts = busyDays.has(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`monthCell ${inMonth ? '' : 'monthCellOff'} ${d === anchorDate ? 'monthCellActive' : ''}`}
                      onClick={() => {
                        setAnchorDate(d);
                        setViewMode('day');
                      }}
                    >
                      <div className="monthCellTop">
                        <div className="monthDayNum">{new Date(`${d}T00:00:00`).getDate()}</div>
                        {hasAppts ? <div className="monthBadge" /> : <div className="monthBadgeEmpty" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        open={patientModalOpen}
        title={selectedAppt ? `Rendez-vous • ${getAppointmentPatientName(selectedAppt)}` : 'Rendez-vous'}
        onClose={() => {
          setPatientModalOpen(false);
          setSelectedAppt(null);
        }}
      >
        {selectedAppt ? (
          <div className="modalContent">
            <div className="modalRow">
              <div className="kv">
                <div className="k">Date</div>
                <div className="v">{selectedAppt.date}</div>
              </div>
              <div className="kv">
                <div className="k">Heure</div>
                <div className="v">{selectedAppt.startTime}</div>
              </div>
              <div className="kv">
                <div className="k">Statut</div>
                <div className="v">{selectedAppt.status}</div>
              </div>
            </div>

            <div className="modalSection">
              <div className="sectionTitle">Patient</div>
              <div className="patientBox">
                <div className="patientName">{getAppointmentPatientName(selectedAppt)}</div>
                <div className="patientMeta">{selectedAppt.patientId?.phone || '—'}</div>
                <div className="patientMeta">{selectedAppt.patientId?.email || '—'}</div>
              </div>
            </div>

            <div className="modalSection">
              <div className="sectionTitle">Historique</div>
              {history.length ? (
                <div className="historyList">
                  {history.slice(0, 8).map((h) => (
                    <div key={h._id} className="historyItem">
                      <div className="historyWhen">{h.date} • {h.startTime}</div>
                      <div className={`historyStatus ${statusColor(h.status)}`}>{h.status}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="emptyInline">Pas d’historique.</div>
              )}
            </div>

            <div className="modalActions">
              <button
                type="button"
                className="btnGhost"
                disabled={editBusy}
                onClick={() => {
                  // “Modifier” phase 1: open create modal prefilled, but we keep simple: update date/time to anchor date + keep same time.
                  handleDoctorAction('UPDATE', { date: anchorDate, startTime: selectedAppt.startTime });
                }}
              >
                Modifier
              </button>
              <button
                type="button"
                className="btnDanger"
                disabled={editBusy}
                onClick={() => handleDoctorAction('CANCEL', { reason: 'Annulé par le médecin' })}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btnPrimary"
                disabled={editBusy}
                onClick={() => handleDoctorAction('DONE')}
              >
                Marquer comme terminé
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={createOpen} title="Nouveau rendez-vous" onClose={() => setCreateOpen(false)}>
        <div className="modalContent">
          <div className="hint">Phase 1 UI: création nécessite un doctorId/patientId côté backend patient. Ici on simule via patientId libre.</div>
          <Input label="Date">
            <input
              className="input"
              type="date"
              value={createForm.date}
              onChange={(e) => setCreateForm((p) => ({ ...p, date: e.target.value }))}
            />
          </Input>
          <Input label="Heure (HH:mm)">
            <input
              className="input"
              type="time"
              value={createForm.startTime}
              onChange={(e) => setCreateForm((p) => ({ ...p, startTime: e.target.value }))}
            />
          </Input>
          <Input label="Patient ID (ObjectId)">
            <input
              className="input"
              placeholder="ex: 66b..."
              value={createForm.patientId}
              onChange={(e) => setCreateForm((p) => ({ ...p, patientId: e.target.value }))}
            />
          </Input>

          <div className="modalActions">
            <button
              type="button"
              className="btnPrimary"
              onClick={async () => {
                setEditBusy(true);
                try {
                  // Backend POST /appointments requires patient role (auth sub is patient). For doctor creating on behalf,
                  // backend change would be required. We keep this as placeholder.
                  // So we only close modal for now.
                  setCreateOpen(false);
                } finally {
                  setEditBusy(false);
                }
              }}
              disabled={editBusy}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

