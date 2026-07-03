import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../../api/client.js';

import './DoctorPatientsPage.css';

function debounce(fn, ms) {
  let t;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}


function StatusBadge({ label }) {
  return <span className="ppStatus">{label}</span>;
}

function Avatar({ photoUrl, fullName }) {
  const initials = (fullName || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('');

  return (
    <div className="ppAvatar" aria-hidden="true">
      {photoUrl ? <img src={photoUrl} alt="" /> : <div className="ppAvatarFallback">{initials || '👤'}</div>}
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="ppModalOverlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ppModal">
        <div className="ppModalHeader">
          <div className="ppModalTitle">{title}</div>
          <button type="button" className="ppModalClose" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="ppModalBody">{children}</div>
      </div>
    </div>
  );
}

function formatMaybeDateTime(d) {
  if (!d) return '—';
  try {
    const dd = new Date(`${d.date}T${d.startTime}:00`);
    return dd.toLocaleDateString('fr-FR');
  } catch {
    return `${d.date} ${d.startTime}`;
  }
}

export default function DoctorPatientsPage() {
  const token = useMemo(() => localStorage.getItem('token') || '', []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [patients, setPatients] = useState([]);

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name | lastVisit | totalVisits
  const [sortDir, setSortDir] = useState('asc');

  const [selected, setSelected] = useState(null); // patient summary
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState('');

  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState(null);

  const notesRef = useRef({ patientId: null });

  const debouncedSave = useMemo(
    () =>
      debounce(async (patientId, nextNotes) => {
        if (!patientId) return;
        setNotesSaving(true);
        try {
          const res = await apiRequest(`/doctor/patients/${patientId}/notes`, { method: 'PATCH', token, body: { notes: nextNotes } });
          setNotesSavedAt(new Date());
          // keep server value in sync if server normalizes
          if (typeof res?.privateNotes === 'string') setNotes(res.privateNotes);
        } catch (e) {
          // keep local content; show only error
          setSelectedError(e?.message || 'Erreur sauvegarde notes');
        } finally {
          setNotesSaving(false);
        }
      }, 700),
    [token]
  );

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError('');

        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        params.set('sortBy', sortBy);
        params.set('sortDir', sortDir);

        const baseUrl = import.meta.env.VITE_API_URL || '';
        const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
        const url = `${apiBase}/doctor/patients?${params.toString()}`;

        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : undefined,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

        if (!alive) return;
        setPatients(Array.isArray(data?.patients) ? data.patients : []);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Erreur chargement');
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [token, q, sortBy, sortDir]);

  async function openPatient(patientSummary) {
    setSelected(patientSummary);
    setSelectedLoading(true);
    setSelectedError('');

    const patientId = patientSummary?.patientId;
    notesRef.current.patientId = patientId;

    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
      const url = `${apiBase}/doctor/patients/${encodeURIComponent(patientId)}`;

      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      const privateNotes = typeof data?.privateNotes === 'string' ? data.privateNotes : '';
      setNotes(privateNotes);
      setNotesSavedAt(null);
    } catch (e) {
      setSelectedError(e?.message || 'Erreur chargement fiche patient');
      setNotes('');
    } finally {
      setSelectedLoading(false);
    }
  }

  function onNotesChange(next) {
    setNotes(next);
    const pid = notesRef.current.patientId;
    debouncedSave(pid, next);
  }

  const sortedPatients = useMemo(() => {
    // server already sorts, but keep UI stable
    return patients;
  }, [patients]);

  return (
    <div className="ppPage pageWrap pageEnter">
      <div className="ppLayout pageCard">
        <div className="ppInner">
          <div className="ppHeader">
            <div>
              <h1 className="title">Mes patients</h1>
              <p className="subtitle">Liste des patients consultés et fiches complètes.</p>
            </div>
          </div>

          <div className="ppToolbar">
            <label className="ppField">
              <div className="ppFieldLabel">Recherche (nom)</div>
              <input className="ppInput" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tapez un nom" />
            </label>

            <div className="ppSort">
              <label className="ppField">
                <div className="ppFieldLabel">Trier par</div>
                <select className="ppSelect" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">Nom</option>
                  <option value="lastVisit">Dernière visite</option>
                  <option value="totalVisits">Nombre de visites</option>
                </select>
              </label>

              <label className="ppField">
                <div className="ppFieldLabel">Sens</div>
                <select className="ppSelect" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                  <option value="asc">Croissant</option>
                  <option value="desc">Décroissant</option>
                </select>
              </label>
            </div>
          </div>

          {error ? <div className="error">{error}</div> : null}

          {loading ? (
            <div className="ppLoading">Chargement…</div>
          ) : (
            <div className="ppList" role="list" aria-label="Patients">
              {sortedPatients.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyIcon">🩺</div>
                  <div className="emptyTitle">Aucun patient</div>
                  <div className="emptySub">Aucun résultat pour ce médecin.</div>
                </div>
              ) : (
                sortedPatients.map((p) => {
                  const lastLabel = p.lastVisit?.date ? `${p.lastVisit.date}` : '—';
                  return (
                    <button
                      key={p.patientId}
                      type="button"
                      className="ppListItem"
                      onClick={() => openPatient(p)}
                    >
                      <div className="ppListLeft">
                        <Avatar photoUrl={null} fullName={p.fullName} />
                        <div>
                          <div className="ppPatientName">{p.fullName}</div>
                          <div className="ppPatientMeta">{p.email || p.phone || '—'}</div>
                        </div>
                      </div>

                      <div className="ppListMid">
                        <div className="ppStat">
                          <div className="ppStatLabel">Âge</div>
                          <div className="ppStatValue">—</div>
                        </div>
                        <div className="ppStat">
                          <div className="ppStatLabel">Dernière visite</div>
                          <div className="ppStatValue">{lastLabel}</div>
                        </div>
                      </div>

                      <div className="ppListRight">
                        <div className="ppVisits">
                          <div className="ppVisitsLabel">Consultations</div>
                          <div className="ppVisitsValue">{p.totalConsultations}</div>
                        </div>
                        <div className="ppChevron">›</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected ? selected.fullName : 'Fiche patient'}
        onClose={() => {
          setSelected(null);
          setNotes('');
          setSelectedError('');
        }}
      >
        {selectedLoading ? (
          <div className="ppModalLoading">Chargement fiche…</div>
        ) : selectedError ? (
          <div className="error">{selectedError}</div>
        ) : selected ? (
          <div className="ppPatientModalGrid">
            <div className="ppPMHeader">
              <div className="ppPMAvatarWrap">
                <Avatar photoUrl={null} fullName={selected.fullName} />
              </div>

              <div>
                <div className="ppPMName">{selected.fullName}</div>
                <div className="ppPMRow">
                  <div className="ppPMKey">Âge</div>
                  <div className="ppPMVal">—</div>
                </div>
                <div className="ppPMRow">
                  <div className="ppPMKey">Dernière visite</div>
                  <div className="ppPMVal">{formatMaybeDateTime(selected.lastVisit)}</div>
                </div>
                <div className="ppPMRow">
                  <div className="ppPMKey">Nombre de consultations</div>
                  <div className="ppPMVal">{selected.totalConsultations}</div>
                </div>
                <div className="ppPMRow">
                  <div className="ppPMKey">Prochain rendez-vous</div>
                  <div className="ppPMVal">
                    {selected.nextAppointment ? `${selected.nextAppointment.date} ${selected.nextAppointment.startTime}` : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="ppPMSection">
              <div className="ppPMSectionTitle">Coordonnées</div>
              <div className="ppPMKV">
                <div className="kvLine">
                  <div className="k">Téléphone</div>
                  <div className="v">{selected.phone || '—'}</div>
                </div>
                <div className="kvLine">
                  <div className="k">Email</div>
                  <div className="v">{selected.email || '—'}</div>
                </div>
              </div>
            </div>

            <PatientHistoryBlock token={token} patientId={selected.patientId} />

            <div className="ppPMSection">
              <div className="ppPMSectionTitle">Notes privées (médecin)</div>
              <div className="ppPMNotesHint">Sauvegarde automatique.</div>

              <textarea
                className="ppNotesArea"
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="Écrire une note privée…"
                rows={7}
              />

              <div className="ppNotesFooter">
                {notesSaving ? <span className="ppSaving">Enregistrement…</span> : <span />}
                {notesSavedAt ? <span className="ppSavedAt">Dernière sauvegarde: {notesSavedAt.toLocaleTimeString('fr-FR')}</span> : null}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function PatientHistoryBlock({ token, patientId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!patientId) return;
      setLoading(true);
      setError('');

      try {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
        const url = `${apiBase}/appointments/patient/${encodeURIComponent(patientId)}/history`;

        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : undefined,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

        if (!alive) return;
        setHistory(Array.isArray(data?.appointments) ? data.appointments : []);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Erreur historique');
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [token, patientId]);

  return (
    <div className="ppPMSection">
      <div className="ppPMSectionTitle">Historique des consultations</div>

      {loading ? (
        <div className="ppInlineLoading">Chargement…</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : history.length === 0 ? (
        <div className="emptyInline">Aucune consultation.</div>
      ) : (
        <div className="ppHistoryList" role="list">
          {history.map((h) => (
            <div key={h._id || `${h.date}-${h.startTime}`} className="ppHistoryItem" role="listitem">
              <div className="ppHistoryWhen">
                {h.date} • {h.startTime}
              </div>
              <div className="ppHistoryStatus">
                <StatusBadge label={h.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="ppHistoryNote">Motifs: non disponible dans le modèle actuel.</div>
    </div>
  );
}

