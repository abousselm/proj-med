import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../api/client.js';

import './me/MePage.css';

const ProfileField = ({ label, children }) => (
  <label className="meField">
    <span className="meFieldLabel">{label}</span>
    {children}
  </label>
);

export function MePage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    photoUrl: '',
    officePhotoUrl: '',
    shortBio: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = useMemo(() => localStorage.getItem('token'), []);

  useEffect(() => {
    if (!token) {
      setError('Token manquant. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }

    let alive = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await apiRequest('/users/me', { token });
        if (!alive) return;
        setData(res);
        setForm({
          firstName: res.user.firstName || '',
          lastName: res.user.lastName || '',
          phoneNumber: res.user.phoneNumber || '',
          email: res.user.email || '',
          photoUrl: res.doctorProfile?.photoUrl || '',
          officePhotoUrl: res.doctorProfile?.officePhotoUrl || '',
          shortBio: res.doctorProfile?.shortBio || '',
        });
      } catch (err) {
        if (!alive) return;
        setError(err.message || 'Impossible de charger le profil.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [token]);

  function setValue(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const body = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        photoUrl: form.photoUrl.trim(),
        officePhotoUrl: form.officePhotoUrl.trim(),
        shortBio: form.shortBio.trim(),
      };

      const res = await apiRequest('/users/me', {
        method: 'PATCH',
        token,
        body,
      });

      setData(res);
      setSuccess('Profil mis à jour avec succès.');
    } catch (err) {
      setError(err.message || 'Impossible d’enregistrer le profil.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="meLayout pageWrap pageEnter">
      <div className="pageCard meCard">
        <div className="pageInner">
          <h3 className="title">Mon profil</h3>
          {loading ? (
            <p className="meStatus">Chargement du profil…</p>
          ) : error ? (
            <p className="error">{error}</p>
          ) : null}

          {data ? (
            <form className="meForm" onSubmit={handleSubmit}>
              <div className="meTop">
                <div className="meAvatarCard">
                  {form.photoUrl ? (
                    <img className="meAvatar" src={form.photoUrl} alt="Photo du médecin" />
                  ) : (
                    <div className="meAvatarFallback">👤</div>
                  )}
                  <div>
                    <div className="meName">{`${form.firstName} ${form.lastName}`.trim() || 'Médecin'}</div>
                    <div className="meRole">{data.user.role === 'doctor' ? 'Médecin' : 'Patient'}</div>
                  </div>
                </div>
              </div>

              <section className="meSection">
                <h4>Informations personnelles</h4>
                <div className="meFieldsGrid">
                  <ProfileField label="Prénom">
                    <input className="meInput" value={form.firstName} onChange={(e) => setValue('firstName', e.target.value)} />
                  </ProfileField>
                  <ProfileField label="Nom">
                    <input className="meInput" value={form.lastName} onChange={(e) => setValue('lastName', e.target.value)} />
                  </ProfileField>
                  <ProfileField label="Email">
                    <input className="meInput" value={form.email} disabled />
                  </ProfileField>
                  <ProfileField label="Téléphone">
                    <input className="meInput" value={form.phoneNumber} onChange={(e) => setValue('phoneNumber', e.target.value)} />
                  </ProfileField>
                </div>
              </section>

              {data.user.role === 'doctor' ? (
                <section className="meSection">
                  <h4>Profil docteur</h4>
                  <div className="meFieldsGrid">
                    <ProfileField label="Photo personnelle (URL)">
                      <input className="meInput" value={form.photoUrl} onChange={(e) => setValue('photoUrl', e.target.value)} />
                    </ProfileField>
                    <ProfileField label="Photo du cabinet (URL)">
                      <input className="meInput" value={form.officePhotoUrl} onChange={(e) => setValue('officePhotoUrl', e.target.value)} />
                    </ProfileField>
                    <ProfileField label="Présentation courte">
                      <textarea
                        className="meTextarea"
                        rows="4"
                        value={form.shortBio}
                        onChange={(e) => setValue('shortBio', e.target.value)}
                      />
                    </ProfileField>
                  </div>
                </section>
              ) : null}

              <div className="meActions">
                {success ? <div className="meSuccess">{success}</div> : null}
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer mes modifications'}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}


