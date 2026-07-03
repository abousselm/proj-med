import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../api/client.js';
import './DoctorCabinetPage.css';

function Field({ label, children, description, error }) {
  return (
    <div className="cabinetField">
      <label className="cabinetLabel">{label}</label>
      {children}
      {description ? <div className="cabinetFieldDesc">{description}</div> : null}
      {error ? <div className="cabinetFieldError">{error}</div> : null}
    </div>
  );
}

const specialtyOptions = [
  'Généraliste',
  'Cardiologue',
  'Dermatologue',
  'Pédiatre',
  'Dentiste',
  'Gynécologue',
  'Ophtalmologue',
  'Chirurgien',
  'ORL',
  'Psychiatre',
  'Autre',
];

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCommaString(value) {
  return Array.isArray(value) ? value.join(', ') : String(value || '');
}

export default function DoctorCabinetPage() {
  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    cabinetName: '',
    officeName: '',
    specialty: '',
    specialtyOther: '',
    address: '',
    city: '',
    governorate: '',
    licenseNumber: '',
    yearsOfExperience: '',
    consultationDurationMinutes: '',
    languages: '',
    qualifications: '',
    shortBio: '',
    photoUrl: '',
    officePhotoUrl: '',
    notifications: {
      email: true,
      sms: true,
      push: true,
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await apiRequest('/doctor/cabinet', { token });
        if (!alive) return;
        const doc = res.profile || res;
        setProfile(doc);
        setForm({
          cabinetName: doc.cabinetName || '',
          officeName: doc.officeName || '',
          specialty: doc.specialty || '',
          specialtyOther: doc.specialtyOther || '',
          address: doc.address || '',
          city: doc.city || '',
          governorate: doc.governorate || '',
          licenseNumber: doc.licenseNumber || '',
          yearsOfExperience: doc.yearsOfExperience?.toString() || '',
          consultationDurationMinutes: doc.consultationDurationMinutes?.toString() || '',
          languages: toCommaString(doc.languages),
          qualifications: Array.isArray(doc.qualifications) ? doc.qualifications.join('\n') : doc.qualifications || '',
          shortBio: doc.shortBio || '',
          photoUrl: doc.photoUrl || '',
          officePhotoUrl: doc.officePhotoUrl || '',
          notifications: {
            email: doc.notifications?.email ?? true,
            sms: doc.notifications?.sms ?? true,
            push: doc.notifications?.push ?? true,
          },
        });
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'Impossible de charger les informations du cabinet.');
      } finally {
        if (alive) setLoading(false);
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

  function setNotification(key, value) {
    setForm((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value,
      },
    }));
    setSuccess('');
    setError('');
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const body = {
        cabinetName: form.cabinetName.trim(),
        officeName: form.officeName.trim(),
        specialty: form.specialty.trim(),
        specialtyOther: form.specialty === 'Autre' ? form.specialtyOther.trim() : '',
        address: form.address.trim(),
        city: form.city.trim(),
        governorate: form.governorate.trim(),
        licenseNumber: form.licenseNumber.trim(),
        yearsOfExperience: Number(form.yearsOfExperience) || 0,
        consultationDurationMinutes: Number(form.consultationDurationMinutes) || 30,
        languages: normalizeList(form.languages),
        qualifications: normalizeList(form.qualifications),
        shortBio: form.shortBio.trim(),
        photoUrl: form.photoUrl.trim(),
        officePhotoUrl: form.officePhotoUrl.trim(),
        notifications: {
          email: Boolean(form.notifications.email),
          sms: Boolean(form.notifications.sms),
          push: Boolean(form.notifications.push),
        },
      };

      const res = await apiRequest('/doctor/cabinet', {
        method: 'PUT',
        token,
        body,
      });

      const updated = res.profile || res;
      setProfile(updated);
      setSuccess('Profil du cabinet mis à jour avec succès.');
    } catch (err) {
      setError(err?.message || 'Impossible d’enregistrer les modifications.');
    } finally {
      setSaving(false);
    }
  }

  const subtitle = profile ? 'Mettez à jour les informations affichées aux patients, votre cabinet et vos notifications.' : 'Chargement des données du cabinet...';

  return (
    <div className="cabinetPage pageWrap pageEnter">
      <div className="cabinetHeader">
        <div>
          <h1 className="cabinetTitle">Mon cabinet</h1>
          <p className="cabinetSubtitle">{subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="cabinetLoading">Chargement…</div>
      ) : error ? (
        <div className="cabinetError">{error}</div>
      ) : (
        <form className="cabinetForm" onSubmit={handleSave}>
          <section className="cabinetSection">
            <h2>Informations du cabinet</h2>
            <Field label="Nom du cabinet" error={!form.cabinetName.trim() ? 'Champ obligatoire' : ''}>
              <input
                className="cabinetInput"
                value={form.cabinetName}
                onChange={(e) => setValue('cabinetName', e.target.value)}
              />
            </Field>

            <Field label="Nom de l’espace / bureau" description="Optionnel si identique au nom du cabinet."> 
              <input
                className="cabinetInput"
                value={form.officeName}
                onChange={(e) => setValue('officeName', e.target.value)}
              />
            </Field>

            <Field label="Spécialité" error={!form.specialty.trim() ? 'Champ obligatoire' : ''}>
              <select className="cabinetSelect" value={form.specialty} onChange={(e) => setValue('specialty', e.target.value)}>
                <option value="">Sélectionnez</option>
                {specialtyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            {form.specialty === 'Autre' ? (
              <Field label="Autre spécialité" error={!form.specialtyOther.trim() ? 'Champ obligatoire' : ''}>
                <input
                  className="cabinetInput"
                  value={form.specialtyOther}
                  onChange={(e) => setValue('specialtyOther', e.target.value)}
                />
              </Field>
            ) : null}

            <Field label="Adresse" error={!form.address.trim() ? 'Champ obligatoire' : ''}>
              <input
                className="cabinetInput"
                value={form.address}
                onChange={(e) => setValue('address', e.target.value)}
              />
            </Field>

            <div className="cabinetGrid2">
              <Field label="Ville" error={!form.city.trim() ? 'Champ obligatoire' : ''}>
                <input className="cabinetInput" value={form.city} onChange={(e) => setValue('city', e.target.value)} />
              </Field>
              <Field label="Gouvernorat" error={!form.governorate.trim() ? 'Champ obligatoire' : ''}>
                <input className="cabinetInput" value={form.governorate} onChange={(e) => setValue('governorate', e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="cabinetSection">
            <h2>Profil professionnel</h2>
            <div className="cabinetGrid2">
              <Field label="Numéro d’autorisation" error={!form.licenseNumber.trim() ? 'Champ obligatoire' : ''}>
                <input className="cabinetInput" value={form.licenseNumber} onChange={(e) => setValue('licenseNumber', e.target.value)} />
              </Field>
              <Field label="Années d’expérience" error={!form.yearsOfExperience.trim() ? 'Champ obligatoire' : ''}>
                <input
                  type="number"
                  min="0"
                  className="cabinetInput"
                  value={form.yearsOfExperience}
                  onChange={(e) => setValue('yearsOfExperience', e.target.value)}
                />
              </Field>
            </div>

            <Field label="Durée de consultation (minutes)" error={!form.consultationDurationMinutes.trim() ? 'Champ obligatoire' : ''}>
              <input
                type="number"
                min="10"
                className="cabinetInput"
                value={form.consultationDurationMinutes}
                onChange={(e) => setValue('consultationDurationMinutes', e.target.value)}
              />
            </Field>

            <Field label="Langues parlées" description="Séparez par des virgules.">
              <input
                className="cabinetInput"
                value={form.languages}
                onChange={(e) => setValue('languages', e.target.value)}
              />
            </Field>

            <Field label="Qualifications" description="Listez une qualification par ligne.">
              <textarea
                className="cabinetTextarea"
                rows="4"
                value={form.qualifications}
                onChange={(e) => setValue('qualifications', e.target.value)}
              />
            </Field>

            <Field label="Présentation courte" description="Texte visible par les patients.">
              <textarea
                className="cabinetTextarea"
                rows="4"
                value={form.shortBio}
                onChange={(e) => setValue('shortBio', e.target.value)}
              />
            </Field>
          </section>

          <section className="cabinetSection">
            <h2>Visibilité & médias</h2>
            <Field label="URL photo de profil" description="Affichée sur votre fiche publique.">
              <input className="cabinetInput" value={form.photoUrl} onChange={(e) => setValue('photoUrl', e.target.value)} />
            </Field>
            <Field label="URL photo du cabinet" description="Optionnel, visible sur la page du cabinet.">
              <input className="cabinetInput" value={form.officePhotoUrl} onChange={(e) => setValue('officePhotoUrl', e.target.value)} />
            </Field>
          </section>

          <section className="cabinetSection">
            <h2>Notifications</h2>
            <div className="cabinetCheckboxGroup">
              <label className="cabinetCheckbox">
                <input
                  type="checkbox"
                  checked={form.notifications.email}
                  onChange={(e) => setNotification('email', e.target.checked)}
                />
                Recevoir des notifications par email
              </label>
              <label className="cabinetCheckbox">
                <input
                  type="checkbox"
                  checked={form.notifications.sms}
                  onChange={(e) => setNotification('sms', e.target.checked)}
                />
                Recevoir des notifications SMS
              </label>
              <label className="cabinetCheckbox">
                <input
                  type="checkbox"
                  checked={form.notifications.push}
                  onChange={(e) => setNotification('push', e.target.checked)}
                />
                Recevoir des notifications push
              </label>
            </div>
          </section>

          <div className="cabinetFooter">
            {success ? <div className="cabinetSuccess">{success}</div> : null}
            {error ? <div className="cabinetError">{error}</div> : null}
            <button type="submit" className="cabinetButton" disabled={saving}>
              {saving ? 'Enregistrement …' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
