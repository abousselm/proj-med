import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../api/client.js';

import './ChooseDoctorPage.css';

function normalize(s) {
  return (s ?? '').toString().trim().toLowerCase();
}

function StarRating({ avg, count }) {
  if (avg == null || Number.isNaN(Number(avg))) return <div className="ratingPlaceholder">—</div>;
  const v = Math.max(0, Math.min(5, Number(avg)));
  const full = Math.floor(v);
  const half = v - full >= 0.5;

  return (
    <div className="rating">
      <div className="stars" aria-label={`Note moyenne ${v} sur 5`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const idx = i + 1;
          const isFull = idx <= full;
          const isHalf = !isFull && half && idx === full + 1;
          return (
            <span key={i} className={isFull ? 'star full' : isHalf ? 'star half' : 'star'}>
              ★
            </span>
          );
        })}
      </div>
      <div className="ratingMeta">{count ? `${v.toFixed(1)} (${count})` : v.toFixed(1)}</div>
    </div>
  );
}

function availabilityToneClass(tone) {
  return tone === 'green' ? 'badgeGreen' : 'badgeGray';
}

function DoctorCard({ doc, onChoose }) {
  const initials = `${(doc.firstName || '').slice(0, 1)}${(doc.lastName || '').slice(0, 1)}`.toUpperCase();

  return (
    <button type="button" className="doctorCard" onClick={onChoose}>
      <div className="doctorTop">
        <div className="avatarWrap" aria-hidden="true">
          {doc.photoUrl ? (
            <img className="avatar" src={doc.photoUrl} alt={doc.fullName} loading="lazy" />
          ) : (
            <div className="avatarFallback">
              <span>{initials || 'DR'}</span>
            </div>
          )}
        </div>

        <div className="doctorMeta">
          <h4 className="doctorName">{doc.fullName}</h4>
          <div className="doctorSpec">{doc.specialty}</div>
          <div className="doctorAddr">📍 {doc.address}</div>
        </div>
      </div>

      <div className="doctorMid">
        <StarRating avg={doc.ratingAvg} count={doc.ratingCount} />
        <div className={`availabilityBadge ${availabilityToneClass(doc.badge?.tone)}`}>
          {doc.badge?.label || '—'}
        </div>
      </div>

      <div className="doctorBottom">
        <span className="bookHint">Prendre rendez-vous</span>
        <span className="bookCta">→</span>
      </div>
    </button>
  );
}

export function ChooseDoctorPage() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [activeSpecialty, setActiveSpecialty] = useState('Tous');
  const [sortBy, setSortBy] = useState('name_asc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    apiRequest('/doctors')
      .then((res) => {
        if (!cancelled) setDocs(Array.isArray(res) ? res : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Erreur lors du chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const specialties = useMemo(() => {
    const set = new Set(docs.map((d) => d.specialty).filter(Boolean));
    return ['Tous', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))];
  }, [docs]);

  const filtered = useMemo(() => {
    const nq = normalize(query);
    const bySpec = activeSpecialty === 'Tous' ? docs : docs.filter((d) => d.specialty === activeSpecialty);

    const res = bySpec.filter((d) => {
      const name = normalize(d.fullName);
      const spec = normalize(d.specialty);
      return !nq || name.includes(nq) || spec.includes(nq);
    });

    const getNameKey = (d) => normalize(d.fullName);

    if (sortBy === 'name_asc') {
      res.sort((a, b) => getNameKey(a).localeCompare(getNameKey(b), 'fr'));
    } else if (sortBy === 'name_desc') {
      res.sort((a, b) => getNameKey(b).localeCompare(getNameKey(a), 'fr'));
    } else if (sortBy === 'specialty') {
      // group headers order is handled later; still keep stable within specialty
      res.sort((a, b) => {
        const s = normalize(a.specialty).localeCompare(normalize(b.specialty), 'fr');
        if (s !== 0) return s;
        return getNameKey(a).localeCompare(getNameKey(b), 'fr');
      });
    } else if (sortBy === 'availability') {
      // green availability first, then by name
      const toneRank = (d) => (d.badge?.tone === 'green' ? 0 : 1);
      res.sort((a, b) => {
        const tr = toneRank(a) - toneRank(b);
        if (tr !== 0) return tr;
        return getNameKey(a).localeCompare(getNameKey(b), 'fr');
      });
    }

    return res;
  }, [docs, query, activeSpecialty, sortBy]);

  const groupedBySpecialty = useMemo(() => {
    if (sortBy !== 'specialty') return null;

    const groups = new Map();
    for (const d of filtered) {
      if (!groups.has(d.specialty)) groups.set(d.specialty, []);
      groups.get(d.specialty).push(d);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([spec, items]) => ({ spec, items }));
  }, [filtered, sortBy]);

  function onChooseDoctor(doctorId) {
    window.location.href = `/book-appointment?doctorId=${encodeURIComponent(doctorId)}`;
  }

  return (
    <div className="chooseDoctorLayout pageWrap pageEnter">
      <div className="pageCard chooseDoctorCard">
        <div className="pageInner">
          <div className="chooseHeader">
            <div>
              <h3 className="title chooseTitle">Choix du médecin</h3>
              <p className="subtitle" style={{ marginBottom: 0 }}>
                Recherchez, filtrez, puis prenez rendez-vous en quelques secondes.
              </p>
            </div>
          </div>

          <div className="controls">
            <div className="searchWrap">
              <span className="searchIcon" aria-hidden="true">🔎</span>
              <input
                className="searchInput"
                value={query}
                placeholder="Rechercher par nom ou spécialité..."
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="sortWrap">
              <label className="sortLabel">Trier par</label>
              <select className="sortSelect" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name_asc">Ordre alphabétique (A → Z)</option>
                <option value="name_desc">Ordre alphabétique (Z → A)</option>
                <option value="specialty">Par spécialité</option>
                <option value="availability">Par disponibilité</option>
              </select>
            </div>
          </div>

          <div className="chipsRow" role="tablist" aria-label="Filtre par spécialité">
            {specialties.map((sp) => {
              const active = sp === activeSpecialty;
              return (
                <button
                  key={sp}
                  type="button"
                  className={`chip ${active ? 'chipActive' : ''}`}
                  onClick={() => setActiveSpecialty(sp)}
                >
                  {sp}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="loadingArea">
              <div className="spinner" />
              <p className="loadingText">Chargement des médecins...</p>
            </div>
          ) : error ? (
            <div className="emptyState">
              <p className="error">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon" aria-hidden="true">🩺</div>
              <h4 className="emptyTitle">Aucun médecin trouvé pour cette recherche</h4>
              <p className="emptyText">Essayez un autre nom ou une autre spécialité.</p>
            </div>
          ) : sortBy === 'specialty' && groupedBySpecialty ? (
            <div className="specialtyGroups">
              {groupedBySpecialty.map((g) => (
                <div key={g.spec} className="specialtyGroup">
                  <div className="specialtyHeader stickyHeader">
                    <span className="specialtyHeaderIcon" aria-hidden="true">🧩</span>
                    <span className="specialtyHeaderText">{g.spec}</span>
                  </div>

                  <div className="grid doctorsGrid">
                    {g.items.map((doc) => (
                      <div key={doc.id} className="fadeIn">
                        <DoctorCard doc={doc} onChoose={() => onChooseDoctor(doc.id)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid doctorsGrid">
              {filtered.map((doc) => (
                <div key={doc.id} className="fadeIn">
                  <DoctorCard doc={doc} onChoose={() => onChooseDoctor(doc.id)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

