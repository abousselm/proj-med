import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../../api/client.js';
import './DoctorDashboardPage.css';

// Petit composant pour étoiles
function Stars({ value }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(v);
  const half = v - full >= 0.5;
  return (
    <div className="stars" aria-label={`Note ${v} sur 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;
        const isFull = idx <= full;
        const isHalf = idx === full + 1 && half;
        return (
          <span key={idx} className={`star ${isFull ? 'starFull' : isHalf ? 'starHalf' : ''}`}>★</span>
        );
      })}
    </div>
  );
}

function Sparkline({ points = [], color = '#10b981' }) {
  const w = 120;
  const h = 32;
  const pad = 2;
  const max = Math.max(...points, 0);
  const min = Math.min(...points, 0);
  const span = Math.max(1, max - min);

  const mapY = (p) => {
    const t = (p - min) / span;
    return h - pad - t * (h - pad * 2);
  };

  const mapX = (i, n) => {
    if (n <= 1) return pad;
    return pad + (i * (w - pad * 2)) / (n - 1);
  };

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(i, points.length)} ${mapY(p)}`)
    .join(' ');

  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path
        d={`${d} L ${mapX(points.length - 1, points.length)} ${h - pad} L ${mapX(0, points.length)} ${h - pad} Z`}
        fill={color}
        opacity="0.08"
      />
    </svg>
  );
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skLine" style={{ width: `${80 - i * 12}%` }} />
      ))}
    </div>
  );
}

function EmptyState({ title, subtitle, icon = '🩺' }) {
  return (
    <div className="emptyState">
      <div className="emptyIcon">{icon}</div>
      <div className="emptyTitle">{title}</div>
      {subtitle ? <div className="emptySub">{subtitle}</div> : null}
    </div>
  );
}

function formatDelayColor(delayMinutes) {
  const d = Number(delayMinutes || 0);
  if (d < 5) return 'delayGood';
  if (d <= 15) return 'delayWarn';
  return 'delayBad';
}

export default function DoctorDashboardPage() {
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [activityMode, setActivityMode] = useState('30d');

  // Socket real-time (best-effort)
  const socketRef = useRef(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setError('');
        const res = await apiRequest('/doctor/stats', { token });
        if (!alive) return;
        setData(res);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Erreur lors du chargement');
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    (async () => {
      try {
        const { createSocketClient } = await import('../../../api/socketClient.js');
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const socketBase = baseUrl.endsWith('/api') ? baseUrl.slice(0, -3) : baseUrl;

        const socket = await createSocketClient({
          baseUrl: socketBase,
          onDoctorToday: () => {
            apiRequest('/doctor/stats', { token }).then((res) => {
              if (!alive) return;
              setData(res);
            });
          },
          onPatientAppointment: () => {
            apiRequest('/doctor/stats', { token }).then((res) => {
              if (!alive) return;
              setData(res);
            });
          },
        });

        socketRef.current = socket;
      } catch {
        // ignore if socket.io-client not installed
      }
    })();

    return () => {
      alive = false;
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [token]);


  const cards = useMemo(() => {
    if (!data?.today) return null;

    const series7 = (data?.activity?.series7 || []).map((x) => x.count || 0);
    const todayDone = Number(data.today.dayDoneCount || 0);
    const todayRemaining = Number(data.today.dayRemainingCount || 0);
    const weekCurrent = Number(data.weekVsLastWeek?.currentWeekDoneCount || 0);
    const weekDelta = Number(data.weekVsLastWeek?.deltaPct ?? 0);
    const ratingAvg = Number(data.rating?.avg || 0);
    const ratingCount = Number(data.rating?.count || 0);

    return [
      {
        key: 'todayPatients',
        icon: '🧑‍⚕️',
        title: 'Patients du jour',
        value: todayDone,
        sub: `${todayDone} consultés / ${todayRemaining} restants`,
        spark: series7,
        sparkColor: '#10b981',
      },
      {
        key: 'weekPatients',
        icon: '📅',
        title: 'Patients cette semaine',
        value: weekCurrent,
        sub: `${weekDelta >= 0 ? '+' : ''}${weekDelta}% vs semaine dernière`,
        spark: series7,
        sparkColor: '#38bdf8',
      },
      {
        key: 'avgDelay',
        icon: '⏱️',
        title: 'Retard moyen',
        value: Math.max(0, Number(data.today.avgDelayMinutes || 0)),
        sub: 'en minutes (estimation)',
        spark: series7,
        sparkColor: '#f59e0b',
        valueClass: formatDelayColor(data.today.avgDelayMinutes),
      },
      {
        key: 'rating',
        icon: '⭐',
        title: 'Note moyenne',
        value: ratingAvg,
        sub: `${ratingCount} avis`,
        spark: series7,
        sparkColor: '#22c55e',
      },
    ];
  }, [data]);

  const todayQueue = useMemo(() => {
    return Array.isArray(data?.today?.queue) ? data.today.queue : [];
  }, [data]);

  const inProgressAppt = useMemo(() => {
    if (!data?.today?.inProgressId) return null;
    return todayQueue.find((a) => a.appointmentId === data.today.inProgressId) || null;
  }, [data, todayQueue]);

  const delayColorClass = inProgressAppt ? formatDelayColor(inProgressAppt.estimatedDelayMinutes) : 'delayGood';

  const sparkPointsActivity = useMemo(() => {
    if (!data?.activity) return [];
    const series7 = Array.isArray(data.activity.series7) ? data.activity.series7 : [];
    const series30 = Array.isArray(data.activity.series30) ? data.activity.series30 : [];
    if (activityMode === '7d') return series7.map((x) => Number(x?.count || 0));
    return series30.map((x) => Number(x?.count || 0));
  }, [data, activityMode]);

  const nextAppointments = useMemo(() => {
    return data?.nextAppointments || [];
  }, [data]);

  function statusBadge(status) {
    const s = status || '';
    const map = {
      SCHEDULED: { label: 'En attente', cls: 'bWaiting' },
      IN_PROGRESS: { label: 'En cours', cls: 'bRunning' },
      DONE: { label: 'Terminé', cls: 'bDone' },
      CANCELLED: { label: 'Annulé', cls: 'bCancelled' },
    };
    return map[s] || { label: s, cls: 'bNeutral' };
  }

  async function handleArrived() {
    try {
      await apiRequest('/doctor/arrived', { method: 'POST', token, body: {} });
      const res = await apiRequest('/doctor/stats', { token });
      setData(res);
    } catch (e) {
      setError(e?.message || 'Erreur');
    }
  }

  async function handleNext() {
    try {
      await apiRequest('/doctor/next', { method: 'POST', token, body: {} });
      const res = await apiRequest('/doctor/stats', { token });
      setData(res);
    } catch (e) {
      setError(e?.message || 'Erreur');
    }
  }

  async function handleMarkAbsent(appointmentId) {
    // pas d’endpoint dédié actuellement; on utilise PUT PATCH appointments si existe, sinon best-effort: cancel
    // On s’assure que la route existe: backend a PATCH /appointments/:id for patient only; ici doctor.
    // Donc pour rester fonctionnel, on ne fait rien sauf UI: (option)
    // A ce stade, on marque uniquement en front.
    setData((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      next.today = { ...prev.today };
      next.today.queue = next.today.queue.map((a) =>
        a.appointmentId === appointmentId ? { ...a, status: 'CANCELLED', cancelledReason: 'Absent' } : a
      );
      return next;
    });
  }

  return (
    <div className="pageWrap">
      <div className={`pageCard pageEnter`}>
        <div className="pageInner">
          <h1 className="title">Tableau de bord</h1>
          <p className="subtitle">Vue instantanée de votre file d’attente, activité et feedbacks patients.</p>

          {error ? <div className="error">{error}</div> : null}

          {loading ? (
            <div className="dashGrid">
              <div className="cardGrid">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="statCard">
                    <Skeleton lines={3} />
                  </div>
                ))}
              </div>
              <div className="dashLower">
                <div className="panel">
                  <Skeleton lines={6} />
                </div>
                <div className="panel">
                  <Skeleton lines={6} />
                </div>
              </div>
            </div>
          ) : !data ? (
            <EmptyState title="Impossible de charger" subtitle="Vérifiez l’accès et la connexion." icon="⚠️" />
          ) : (
            <div className="dashGrid">
              {/* Cartes stats */}
              <section className="cardGrid" aria-label="Cartes statistiques">
                {cards?.map((c) => (
                  <div key={c.key} className="statCard">
                    <div className="statTop">
                      <div className="statIcon">{c.icon}</div>
                      <div className="statTitle">{c.title}</div>
                    </div>
                    <div className={`statValue ${c.valueClass || ''}`}>{c.value}</div>
                    <div className="statSub">{c.sub}</div>
                    <div className="statSpark">
                      <Sparkline points={c.spark} color={c.sparkColor} />
                    </div>
                  </div>
                ))}
              </section>

              <section className="dashLower">
                {/* Queue du jour */}
                <div className="panel queuePanel">
                  <div className="panelHeader">
                    <div>
                      <div className="panelTitle">File d’attente du jour</div>
                      <div className="panelSub">{data?.today?.date ? `— ${data.today.date}` : ''}</div>
                    </div>

                    <div className="queueActions">
                      {inProgressAppt ? (
                        <button type="button" className="btnGhost" onClick={handleNext}>
                          Patient suivant
                        </button>
                      ) : (
                        <button type="button" className="btnPrimary" onClick={handleArrived}>
                          Je suis arrivé au cabinet
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="queueList" role="list">
                    {todayQueue.filter((a) => a.status !== 'DONE').length === 0 ? (
                      <EmptyState title="Aucun rendez-vous" subtitle="La file d’attente est vide pour aujourd’hui." icon="🗓️" />
                    ) : (
                      todayQueue
                        .slice()
                        .sort((a, b) => (a.startTime < b.startTime ? -1 : 1))
                        .map((a) => {
                          const badge = statusBadge(a.status);
                          const isCurrent = data.today.inProgressId && a.appointmentId === data.today.inProgressId;
                          return (
                            <div key={a.appointmentId} className={`queueItem ${isCurrent ? 'queueItemCurrent' : ''}`} role="listitem">
                              <div className={`queueAvatar ${isCurrent ? 'queueAvatarGlow' : ''}`}>
                                {/** placeholder avatar */}
                                <span>{isCurrent ? '👨‍⚕️' : '🧑'}</span>
                              </div>
                              <div className="queueMain">
                                <div className="queueRow1">
                                  <div className="queueName">Patient {a.patientId.slice(-4)}</div>
                                  <div className="queueTime">{a.startTime}</div>
                                </div>
                                <div className="queueRow2">
                                  <span className={`badge ${badge.cls}`}>{badge.label}</span>
                                  <span className={`delay ${formatDelayColor(a.estimatedDelayMinutes)}`}>
                                    Retard estimé: {a.estimatedDelayMinutes}
                                  </span>
                                </div>
                              </div>
                              <div className="queueRight">
                                {a.status === 'SCHEDULED' ? (
                                  <button type="button" className="absentBtn" onClick={() => handleMarkAbsent(a.appointmentId)}>
                                    Marquer absent
                                  </button>
                                ) : a.status === 'IN_PROGRESS' ? (
                                  <div className={`liveTime ${delayColorClass}`}>
                                    Consultation en cours
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  <div className="queueSticky">
                    {/* Sticky action for large UX: remains visible */}
                    {inProgressAppt ? (
                      <button type="button" className="btnPrimary" onClick={handleNext}>
                        Patient suivant
                      </button>
                    ) : data.today?.firstScheduledId ? (
                      <button type="button" className="btnPrimary" onClick={handleArrived}>
                        Je suis arrivé au cabinet
                      </button>
                    ) : (
                      <button type="button" className="btnPrimary" disabled>
                        En attente
                      </button>
                    )}
                  </div>
                </div>

                {/* Activité + Feedbacks + Prochains RDV */}
                <div className="sideCol">
                  <div className="panel">
                    <div className="panelHeader">
                      <div>
                        <div className="panelTitle">Graphique d’activité</div>
                        <div className="panelSub">Patients reçus par jour</div>
                      </div>
                      <div className="segmented">
                        {[
                          { key: '7d', label: '7 jours' },
                          { key: '30d', label: '30 jours' },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            className={`segBtn ${activityMode === opt.key ? 'segBtnOn' : ''}`}
                            onClick={() => setActivityMode(opt.key)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="activityChart">
                      <Sparkline points={sparkPointsActivity} color={activityMode === '7d' ? '#38bdf8' : '#10b981'} />
                      <div className="activityHint">Tooltips premium via Chart.js à ajouter ensuite si besoin.</div>
                    </div>
                  </div>

                  <div className="panel feedbackPanel">
                    <div className="panelHeader">
                      <div>
                        <div className="panelTitle">Derniers feedbacks patients</div>
                        <div className="panelSub">Basés sur vos avis</div>
                      </div>
                      <button type="button" className="linkBtn" onClick={() => {}}>
                        Voir tous les avis
                      </button>
                    </div>

                    {data.rating.lastFeedbacks?.length ? (
                      <div className="feedbackList">
                        {data.rating.lastFeedbacks.map((f, idx) => {
                          const negative = Number(f.rating) <= 2;
                          return (
                            <div key={f.feedbackId || idx} className={`feedbackItem ${negative ? 'feedbackNegative' : ''}`}>
                              <div className="feedbackAvatar">{f.patientId ? f.patientId.slice(-2) : 'P'}</div>
                              <div className="feedbackMain">
                                <Stars value={f.rating} />
                                <div className="feedbackComment">{f.comment || '—'}</div>
                                <div className="feedbackDate">{new Date(f.createdAt).toLocaleDateString('fr-FR')}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState title="Pas encore d’avis" subtitle="Vos patients pourront laisser un feedback après consultation." icon="⭐" />
                    )}
                  </div>

                  <div className="panel">
                    <div className="panelHeader">
                      <div>
                        <div className="panelTitle">Prochains rendez-vous</div>
                        <div className="panelSub">Aperçu des 2–3 prochains jours</div>
                      </div>
                      <button type="button" className="linkBtn" onClick={() => {}}>
                        Ouvrir l’agenda
                      </button>
                    </div>

                    {nextAppointments?.length ? (
                      <div className="nextList">
                        {nextAppointments.slice(0, 8).map((a, i) => (
                          <div key={`${a.date}-${a.startTime}-${i}`} className="nextItem">
                            <div className="nextLeft">
                              <div className="nextDate">{new Date(`${a.date}T00:00:00`).toLocaleDateString('fr-FR')}</div>
                              <div className="nextTime">{a.startTime}</div>
                            </div>
                            <div className="nextRight">
                              <div className="nextName">Patient {a.patientId.slice(-4)}</div>
                              <div className="nextStatus">
                                {a.status === 'IN_PROGRESS' ? 'En cours' : 'À venir'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState title="Rien de prévu" subtitle="Aucun rendez-vous à venir dans cette plage." icon="🗓️" />
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

