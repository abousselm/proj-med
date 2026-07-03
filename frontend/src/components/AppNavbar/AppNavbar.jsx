import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client.js';

import './appNavbar.css';

function useClickOutside(refs, onOutside) {
  useEffect(() => {
    function onDocDown(e) {
      const target = e.target;
      const isInside = refs.some((r) => r.current && r.current.contains(target));
      if (!isInside) onOutside();
    }

    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('touchstart', onDocDown);
    };
  }, [refs, onOutside]);
}

function IconBell({ active, count }) {
  return (
    <div className={`bellWrap ${active ? 'bellPulse' : ''}`} aria-hidden="true">
      <span className="bellIcon">🔔</span>
      {count > 0 ? <span className="notifBadge">{count > 99 ? '99+' : count}</span> : null}
    </div>
  );
}

function ProfileAvatar({ photoUrl }) {
  return (
    <div className="avatarSmall" aria-hidden="true">
      {photoUrl ? <img src={photoUrl} alt="" /> : <div className="avatarFallback">👤</div>}
    </div>
  );
}

function getRoleFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role || null;
  } catch {
    return null;
  }
}

function NavLinkItem({ to, label, active, onClick }) {
  return (
    <Link
      to={to}
      className={`navItem ${active ? 'navItemActive' : ''}`}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}

export function AppNavbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const role = useMemo(() => getRoleFromToken(token), [token]);

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [notifCount, setNotifCount] = useState(0);
  const [notifItems, setNotifItems] = useState([]);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useClickOutside([notifRef, profileRef], () => {
    setNotifOpen(false);
    setProfileOpen(false);
    setDrawerOpen(false);
  });

  useEffect(() => {
    // No backend endpoint for unread count exists in repo; keep placeholder until backend is added.
    // We still fetch /notifications if it exists; otherwise just show 0.
    if (!token) return;
    apiRequest('/notifications/me', { token })
      .then((res) => {
        setNotifItems(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []);
        setNotifCount(Number(res?.unreadCount ?? (Array.isArray(res?.items) ? res.items.filter((x) => !x.read).length : 0)));
      })
      .catch(() => {
        setNotifCount(0);
        setNotifItems([]);
      });
  }, [token]);

  function onLogout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  const isPatient = role === 'patient';
  const isDoctor = role === 'doctor';

  const activePath = location.pathname;

  const commonLogo = (
    <Link to={isDoctor ? '/doctor/dashboard' : '/me'} className="logo" onClick={() => setDrawerOpen(false)}>
      <span className="logoMark">Tabib</span>
      <span className="logoMark2">Now</span>
    </Link>
  );

  const patientLinks = [
    { to: '/me', label: 'Accueil' },
    { to: '/choose-doctor', label: 'Trouver un médecin' },
    { to: '/me', label: 'Mes rendez-vous', disabled: true },
    { to: '/me', label: 'Historique', disabled: true },
  ];

  const doctorLinks = [
    { to: '/doctor/dashboard', label: 'Tableau de bord' },
    { to: '/doctor/appointments', label: 'Mes rendez-vous' },
    { to: '/doctor/patients', label: 'Mes patients' },
    { to: '/doctor/stats', label: 'Statistiques' },
    { to: '/doctor/cabinet', label: 'Mon cabinet' },
  ];





  const cabinetOpen = false; // TODO: connect to doctor "arrived" state via backend/socket

  const links = isDoctor ? doctorLinks : patientLinks;

  return (
    <>
      <header className={`appNavbar ${drawerOpen ? 'appNavbarDim' : ''}`}>
        <div className="navbarInner">
          {commonLogo}


          <nav className="navCenter" aria-label="Navigation principale">
            {links.map((l) => {
              if (l.disabled) {
                return (
                  <span key={l.label} className="navItem navItemDisabled">
                    {l.label}
                  </span>
                );
              }
              const active = activePath === l.to;
              return (
                <NavLinkItem
                  key={l.to + l.label}
                  to={l.to}
                  label={l.label}
                  active={active}
                  onClick={() => setDrawerOpen(false)}
                />
              );
            })}
          </nav>

          <div className="navRight">
            {isDoctor ? (
              <button type="button" className="cabinetBadge" onClick={() => {}}>
                <span className={`cabinetDot ${cabinetOpen ? 'cabinetDotOn' : ''}`} />
                {cabinetOpen ? 'Cabinet ouvert' : 'Cabinet fermé'}
              </button>
            ) : null}

            <div className="notifWrap" ref={notifRef}>
              <button
                type="button"
                className="iconBtn"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={notifOpen}
              >
                <IconBell active={notifCount > 0} count={notifCount} />
              </button>

              {notifOpen ? (
                <div className="dropdown dropdownNotif" role="menu" aria-label="Notifications">
                  {notifItems.length === 0 ? (
                    <div className="dropdownEmpty">Aucune notification</div>
                  ) : (
                    notifItems.slice(0, 8).map((n) => (
                      <div key={n.id || `${n.type}-${n.createdAt}`} className="notifItem">
                        <div className="notifTitle">{n.title || 'Notification'}</div>
                        <div className="notifMsg">{n.message || n.body || ''}</div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className="profileWrap" ref={profileRef}>
              <button
                type="button"
                className="profileBtn"
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                <ProfileAvatar photoUrl={''} />
                <span className="srOnly">Ouvrir le menu profil</span>
              </button>

              {profileOpen ? (
                <div className="dropdown dropdownProfile" role="menu" aria-label="Profil">
                  <button type="button" className="dropdownLink" onClick={() => { setProfileOpen(false); navigate('/me'); }}>
                    Mon profil
                  </button>
                  {isDoctor ? (
                    <button
                      type="button"
                      className="dropdownLink"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/me');
                      }}
                    >
                      Paramètres du cabinet
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="dropdownLink"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/me');
                      }}
                    >
                      Paramètres
                    </button>
                  )}
                  <button type="button" className="dropdownLink" onClick={onLogout}>
                    Déconnexion
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Ouvrir le menu"
            >
              ☰
            </button>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <div className="drawerOverlay" role="dialog" aria-modal="true">
          <div className="drawer">
            <div className="drawerHeader">
              {commonLogo}
              <button className="iconBtn" type="button" onClick={() => setDrawerOpen(false)} aria-label="Fermer">
                ✕
              </button>
            </div>

            <div className="drawerSection">
              <div className="drawerTitle">Navigation</div>
              <div className="drawerLinks">
                {links.map((l) => (
                  <div key={l.to + l.label}>
                    {l.disabled ? (
                      <div className="drawerLink drawerLinkDisabled">{l.label}</div>
                    ) : (
                      <Link
                        className={`drawerLink ${activePath === l.to ? 'drawerLinkActive' : ''}`}
                        to={l.to}
                        onClick={() => setDrawerOpen(false)}
                      >
                        {l.label}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="drawerSection">
              <div className="drawerTitle">Profil</div>
              <button className="drawerLink" type="button" onClick={() => { setDrawerOpen(false); navigate('/me'); }}>
                Mon profil
              </button>
              <button className="drawerLink" type="button" onClick={onLogout}>
                Déconnexion
              </button>
            </div>

            <div className="drawerSection">
              <div className="drawerTitle">Notifications</div>
              <div className="drawerNotifPreview">
                {notifItems.length ? (
                  notifItems.slice(0, 6).map((n) => (
                    <div key={n.id || `${n.type}-${n.createdAt}`} className="drawerNotifItem">
                      <div className="drawerNotifTitle">{n.title || 'Notification'}</div>
                      <div className="drawerNotifMsg">{n.message || n.body || ''}</div>
                    </div>
                  ))
                ) : (
                  <div className="drawerNotifEmpty">Aucune notification</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

