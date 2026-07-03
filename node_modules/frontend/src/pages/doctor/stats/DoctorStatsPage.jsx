import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../api/client.js';
import './DoctorStatsPage.css';

const periodOptions = [
  { value: 'today', label: 'Aujourd’hui' },
  { value: 'week', label: '7 jours' },
  { value: 'month', label: '30 jours' },
  { value: 'quarter', label: '3 mois' },
  { value: 'year', label: '12 mois' },
];

function StatCard({ label, value, description }) {
  return (
    <article className="statsCard">
      <div className="statsCardLabel">{label}</div>
      <div className="statsCardValue">{value}</div>
      <div className="statsCardDesc">{description}</div>
    </article>
  );
}

function BarRow({ label, value, max }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="barRow">
      <div className="barRowLabel">{label}</div>
      <div className="barRowTrack">
        <div className="barRowFill" style={{ width: `${width}%` }} />
      </div>
      <div className="barRowValue">{value}</div>
    </div>
  );
}

export default function DoctorStatsPage() {
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    async function loadStats() {
      try {
        setLoading(true);
        setError('');
        const res = await apiRequest('/doctor/stats', {
          token,
          params: { period },
        });
        if (!alive) return;
        setData(res);
      } catch (e) {
        if (!alive) return;
        setError(e?.message || 'Erreur lors du chargement des statistiques');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadStats();
    return () => {
      alive = false;
    };
  }, [token, period]);

  function handleExportPdf() {
    window.print();
  }

  const patientsPerMonth = data?.analytics?.patientsPerMonth || [];
  const slotPopularity = data?.analytics?.timeSlotPopularity || [];
  const avgDurationByWeekday = data?.analytics?.avgDurationByWeekday || [];
  const ratingEvolution = data?.analytics?.ratingEvolution || [];
  const cancellationRate = data?.analytics?.cancellationRate ?? 0;
  const absenceRate = data?.analytics?.absenceRate ?? 0;
  const attendanceRate = data?.analytics?.attendanceRate ?? 0;

  const slotMax = Math.max(...slotPopularity.map((item) => item.count), 1);
  const monthMax = Math.max(...patientsPerMonth.map((item) => item.count), 1);

  return (
    <div className="doctorStatsLayout pageWrap pageEnter">
      <div className="pageHeader">
        <div>
          <h1 className="statsTitle">Statistiques</h1>
          <p className="statsSubtitle">Analyse de votre activité médicale et performance.</p>
        </div>
        <div className="statsActions">
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" className="btnExport" onClick={handleExportPdf}>
            Exporter en PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="statsLoading">Chargement des statistiques…</div>
      ) : error ? (
        <div className="statsError">{error}</div>
      ) : (
        <>
          <section className="statsGrid">
            <StatCard label="Taux d’annulation" value={`${cancellationRate}%`} description="Rendez-vous annulés" />
            <StatCard label="Taux d’absence" value={`${absenceRate}%`} description="Absences prévues" />
            <StatCard label="Taux de présence" value={`${attendanceRate}%`} description="Rendez-vous honorés" />
            <StatCard label="Note moyenne" value={`${data?.rating?.avg ?? 0}`} description={`${data?.rating?.count ?? 0} avis`} />
          </section>

          <div className="statsPanels">
            <section className="statsPanel">
              <div className="statsPanelHeader">
                <h2>Patients par mois</h2>
                <p>Nombre de patients uniques traités par mois sur la période.</p>
              </div>
              <div className="chartList">
                {patientsPerMonth.map((item) => (
                  <BarRow key={item.month} label={item.month} value={item.count} max={monthMax} />
                ))}
              </div>
            </section>

            <section className="statsPanel">
              <div className="statsPanelHeader">
                <h2>Créneaux les plus demandés</h2>
                <p>Heures de la journée avec le plus grand nombre de rendez-vous.</p>
              </div>
              <div className="chartList">
                {slotPopularity.map((item) => (
                  <BarRow key={item.hour} label={item.hour} value={item.count} max={slotMax} />
                ))}
              </div>
            </section>
          </div>

          <div className="statsPanels">
            <section className="statsPanel">
              <div className="statsPanelHeader">
                <h2>Temps moyen de consultation</h2>
                <p>Durée moyenne par jour de la semaine.</p>
              </div>
              <div className="chartList">
                {avgDurationByWeekday.map((item) => (
                  <BarRow key={item.label} label={item.label} value={item.avg} max={Math.max(...avgDurationByWeekday.map((x) => x.avg), 1)} />
                ))}
              </div>
            </section>

            <section className="statsPanel">
              <div className="statsPanelHeader">
                <h2>Évolution de la note</h2>
                <p>Notes moyennes mois par mois.</p>
              </div>
              <div className="ratingList">
                {ratingEvolution.map((item) => (
                  <div key={item.month} className="ratingItem">
                    <span>{item.month}</span>
                    <strong>{item.avg}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
