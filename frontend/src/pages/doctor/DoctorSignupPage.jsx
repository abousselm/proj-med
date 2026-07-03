import React, { useMemo, useState } from 'react';
import { apiRequest } from '../../api/client.js';

import './DoctorSignupPage.css';

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

const languageOptions = ['Arabe', 'Français', 'Anglais'];

const workDays = [
  { key: 'MON', label: 'Lundi' },
  { key: 'TUE', label: 'Mardi' },
  { key: 'WED', label: 'Mercredi' },
  { key: 'THU', label: 'Jeudi' },
  { key: 'FRI', label: 'Vendredi' },
  { key: 'SAT', label: 'Samedi' },
  { key: 'SUN', label: 'Dimanche' },
];

function passwordScore(pw) {
  const s = pw || '';
  let score = 0;
  if (s.length >= 8) score += 1;
  if (/[A-Z]/.test(s)) score += 1;
  if (/[0-9]/.test(s)) score += 1;
  if (/[^A-Za-z0-9]/.test(s)) score += 1;
  return score; // 0..4
}

function scoreLabel(score) {
  if (score <= 1) return { text: 'Faible', tone: 'red' };
  if (score === 2) return { text: 'Moyen', tone: 'orange' };
  if (score === 3) return { text: 'Fort', tone: 'green' };
  return { text: 'Très fort', tone: 'green' };
}

function Field({ label, children, error }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
      {error ? <div className="fieldError">{error}</div> : null}
    </div>
  );
}

function Stepper({ step }) {
  const steps = [1, 2, 3];
  return (
    <div className="stepper" aria-label="Progression">
      {steps.map((s, idx) => {
        const state = s < step ? 'done' : s === step ? 'active' : 'todo';
        return (
          <React.Fragment key={s}>
            <div className={`stepCircle ${state}`}>
              {state === 'done' ? '✓' : s}
            </div>
            {idx < steps.length - 1 ? <div className="stepLine" /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function DoctorSignupPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [serverSuccess, setServerSuccess] = useState('');

  const [form, setForm] = useState({
    // step 1
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',

    // step 2
    specialty: 'Généraliste',
    specialtyOther: '',
    licenseNumber: '',
    yearsOfExperience: '0',
    qualifications: '', // newline separated
    languages: [],

    // step 3
    cabinetName: '',
    address: '',
    city: '',
    governorate: '',
    consultationDurationMinutes: '30',

    workHours: workDays.map((d) => ({
      dayOfWeek: d.key,
      enabled: false,
      open: '09:00',
      close: '17:00',
      hasLunchPause: false,
      lunchOpen: '13:00',
      lunchClose: '14:00',
    })),

    profilePhotoFile: null,
    officePhotoFile: null,
    documentsFiles: [],
    // previews
    profilePhotoPreviewUrl: '',
  });

  const pwScore = useMemo(() => passwordScore(form.password), [form.password]);
  const pwMeta = useMemo(() => scoreLabel(pwScore), [pwScore]);

  function setValue(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setWorkHour(dayOfWeek, patch) {
    setForm((f) => ({
      ...f,
      workHours: f.workHours.map((wh) => (wh.dayOfWeek === dayOfWeek ? { ...wh, ...patch } : wh)),
    }));
  }

  const errors = useMemo(() => {
    // Frontend validation per step only
    const e = {};
    if (step === 1) {
      if (!form.firstName.trim()) e.firstName = 'Champ obligatoire';
      if (!form.lastName.trim()) e.lastName = 'Champ obligatoire';
      if (!form.email.trim()) e.email = 'Champ obligatoire';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Email invalide';
      if (!form.phoneNumber.trim()) e.phoneNumber = 'Champ obligatoire';
      if (!form.password) e.password = 'Champ obligatoire';
      else if (form.password.length < 6) e.password = 'Minimum 6 caractères';
      if (!form.confirmPassword) e.confirmPassword = 'Champ obligatoire';
      else if (form.confirmPassword !== form.password) e.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    if (step === 2) {
      if (!form.specialty) e.specialty = 'Champ obligatoire';
      if (form.specialty === 'Autre' && !form.specialtyOther.trim()) e.specialtyOther = "Spécialité 'Autre' requiert un libellé";
      if (!form.licenseNumber.trim()) e.licenseNumber = 'Champ obligatoire';
      const y = Number(form.yearsOfExperience);
      if (Number.isNaN(y) || y < 0) e.yearsOfExperience = 'Valeur invalide';
      if (!form.qualifications.trim()) e.qualifications = 'Ajoutez au moins une formation (une par ligne)';
      if (!form.languages || form.languages.length === 0) e.languages = 'Choisissez au moins une langue';
    }

    if (step === 3) {
      if (!form.cabinetName.trim()) e.cabinetName = 'Champ obligatoire';
      if (!form.address.trim()) e.address = 'Champ obligatoire';
      if (!form.city.trim()) e.city = 'Champ obligatoire';
      if (!form.governorate.trim()) e.governorate = 'Champ obligatoire';
      const d = Number(form.consultationDurationMinutes);
      if (Number.isNaN(d) || d < 10 || d > 240) e.consultationDurationMinutes = 'Entre 10 et 240 minutes';

      const enabledDays = form.workHours.filter((x) => x.enabled);
      if (enabledDays.length === 0) e.workHours = 'Choisissez au moins un jour ouvré';
      if (!form.profilePhotoFile) e.profilePhotoFile = 'Photo de profil obligatoire';
    }

    return e;
  }, [form, step]);

  function hasStepErrors(stepNum) {
    setServerError('');
    return Object.keys(errors).length > 0 && stepNum === step;
  }

  async function onNext(e) {
    e.preventDefault();
    if (Object.keys(errors).length) return;
    setStep((s) => Math.min(3, s + 1));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setServerError('');
    setServerSuccess('');

    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('email', form.email.trim());
      fd.append('password', form.password);
      fd.append('confirmPassword', form.confirmPassword);
      fd.append('firstName', form.firstName.trim());
      fd.append('lastName', form.lastName.trim());
      fd.append('phoneNumber', form.phoneNumber.trim());

      fd.append('specialty', form.specialty);
      fd.append('specialtyOther', form.specialtyOther || '');
      fd.append('licenseNumber', form.licenseNumber.trim());
      fd.append('yearsOfExperience', String(form.yearsOfExperience));
      fd.append('qualifications', form.qualifications);
      fd.append('languages', JSON.stringify(form.languages));

      fd.append('cabinetName', form.cabinetName.trim());
      fd.append('address', form.address.trim());
      fd.append('city', form.city.trim());
      fd.append('governorate', form.governorate.trim());
      fd.append('consultationDurationMinutes', String(form.consultationDurationMinutes));

      const enabledWorkHours = form.workHours
        .filter((x) => x.enabled)
        .map((x) => ({
          dayOfWeek: x.dayOfWeek,
          open: x.open,
          close: x.close,
          hasLunchPause: x.hasLunchPause,
          lunchOpen: x.lunchOpen,
          lunchClose: x.lunchClose,
        }));
      fd.append('workHours', JSON.stringify(enabledWorkHours));

      fd.append('profilePhoto', form.profilePhotoFile);
      if (form.officePhotoFile) fd.append('officePhoto', form.officePhotoFile);
      for (const f of form.documentsFiles) fd.append('documents', f);

      const data = await apiRequest('/doctors/register', {
        method: 'POST',
        body: fd,
      });

      localStorage.setItem('token', data.token);
      setServerSuccess('Inscription médecin terminée ✅');
      window.location.href = '/me';
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const msg =
        data?.message ||
        data?.error ||
        (data ? JSON.stringify(data) : null) ||
        err?.message ||
        'Erreur lors de l’inscription';

      const details = data ? `\n\nDetails (API): ${JSON.stringify(data)}` : '';
      setServerError(`HTTP ${status ?? ''} • ${msg}${details}`.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="doctorSignupLayout pageWrap">
      <div className="pageCard doctorSignupCard pageEnter">
        <div className="pageInner">
          <div className="doctorHeader">
            <h3 className="title">Inscription médecin</h3>
            <p className="subtitle" style={{ marginBottom: 0 }}>
              Parcours séparé (médecins) • 3 étapes • validation & uploads
            </p>
          </div>

          <Stepper step={step} />

          <form className="form" onSubmit={onSubmit}>
            {step === 1 ? (
              <div className="step stepSlideIn">
                <div className="grid2">
                  <Field label="Prénom" error={errors.firstName}>
                    <input className="input" value={form.firstName} onChange={(e) => setValue('firstName', e.target.value)} />
                  </Field>
                  <Field label="Nom" error={errors.lastName}>
                    <input className="input" value={form.lastName} onChange={(e) => setValue('lastName', e.target.value)} />
                  </Field>
                </div>

                <Field label="Email" error={errors.email}>
                  <input className="input" value={form.email} onChange={(e) => setValue('email', e.target.value)} type="email" />
                </Field>

                <div className="grid2">
                  <Field label="Mot de passe" error={errors.password}>
                    <input className="input" value={form.password} onChange={(e) => setValue('password', e.target.value)} type="password" />
                    <div className={`pwMeter ${pwMeta.tone}`}>
                      Force: <b>{pwMeta.text}</b>
                    </div>
                  </Field>
                  <Field label="Confirmer le mot de passe" error={errors.confirmPassword}>
                    <input className="input" value={form.confirmPassword} onChange={(e) => setValue('confirmPassword', e.target.value)} type="password" />
                  </Field>
                </div>

                <Field label="Numéro de téléphone" error={errors.phoneNumber}>
                  <input className="input" value={form.phoneNumber} onChange={(e) => setValue('phoneNumber', e.target.value)} type="tel" />
                </Field>

                <div className="actionsRow">
                  <button className="btnSecondary" type="button" disabled>
                    Précédent
                  </button>
                  <button className="btn" type="button" onClick={onNext} disabled={Object.keys(errors).length > 0}>
                    Suivant
                  </button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="step stepSlideIn">
                <Field label="Spécialité" error={errors.specialty}>
                  <select className="input" value={form.specialty} onChange={(e) => setValue('specialty', e.target.value)}>
                    {specialtyOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>

                {form.specialty === 'Autre' ? (
                  <Field label="Libellé spécialité" error={errors.specialtyOther}>
                    <input className="input" value={form.specialtyOther} onChange={(e) => setValue('specialtyOther', e.target.value)} />
                  </Field>
                ) : null}

                <div className="grid2">
                  <Field label="Numéro d'ordre / licence" error={errors.licenseNumber}>
                    <input className="input" value={form.licenseNumber} onChange={(e) => setValue('licenseNumber', e.target.value)} />
                  </Field>
                  <Field label="Années d'expérience" error={errors.yearsOfExperience}>
                    <input className="input" value={form.yearsOfExperience} onChange={(e) => setValue('yearsOfExperience', e.target.value)} type="number" min={0} />
                  </Field>
                </div>

                <Field label="Diplômes / formations (1 par ligne)" error={errors.qualifications}>
                  <textarea
                    className="textarea"
                    rows={4}
                    value={form.qualifications}
                    onChange={(e) => setValue('qualifications', e.target.value)}
                    placeholder="Ex:\nDiplôme X\nFormation Y"
                  />
                </Field>

                <Field label="Langues parlées" error={errors.languages}>
                  <div className="checkboxRow">
                    {languageOptions.map((l) => {
                      const checked = form.languages.includes(l);
                      return (
                        <label key={l} className={`checkChip ${checked ? 'checkChipOn' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? Array.from(new Set([...form.languages, l]))
                                : form.languages.filter((x) => x !== l);
                              setValue('languages', next);
                            }}
                          />
                          {l}
                        </label>
                      );
                    })}
                  </div>
                </Field>

                <div className="actionsRow">
                  <button className="btnSecondary" type="button" onClick={() => setStep(1)}>
                    Précédent
                  </button>
                  <button className="btn" type="button" onClick={onNext} disabled={Object.keys(errors).length > 0}>
                    Suivant
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="step stepSlideIn">
                <div className="grid2">
                  <Field label="Nom du cabinet" error={errors.cabinetName}>
                    <input className="input" value={form.cabinetName} onChange={(e) => setValue('cabinetName', e.target.value)} />
                  </Field>
                  <Field label="Durée consultation (min)" error={errors.consultationDurationMinutes}>
                    <input
                      className="input"
                      value={form.consultationDurationMinutes}
                      onChange={(e) => setValue('consultationDurationMinutes', e.target.value)}
                      type="number"
                      min={10}
                      max={240}
                    />
                  </Field>
                </div>

                <Field label="Adresse complète" error={errors.address}>
                  <input className="input" value={form.address} onChange={(e) => setValue('address', e.target.value)} />
                </Field>

                <div className="grid2">
                  <Field label="Ville" error={errors.city}>
                    <input className="input" value={form.city} onChange={(e) => setValue('city', e.target.value)} />
                  </Field>
                  <Field label="Gouvernorat" error={errors.governorate}>
                    <input className="input" value={form.governorate} onChange={(e) => setValue('governorate', e.target.value)} />
                  </Field>
                </div>

                <Field label="Horaires de travail" error={errors.workHours}>
                  <div className="workHours">
                    {form.workHours.map((wh) => {
                      const enabled = wh.enabled;
                      return (
                        <div key={wh.dayOfWeek} className={`workDay ${enabled ? 'workDayOn' : ''}`}>
                          <div className="workTop">
                            <label className="toggleLine">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => setWorkHour(wh.dayOfWeek, { enabled: e.target.checked })}
                              />
                              {workDays.find((d) => d.key === wh.dayOfWeek)?.label || wh.dayOfWeek}
                            </label>
                          </div>

                          {enabled ? (
                            <div className="workControls">
                              <div className="grid2">
                                <label className="miniLabel">
                                  Ouverture
                                  <input
                                    className="input"
                                    type="time"
                                    value={wh.open}
                                    onChange={(e) => setWorkHour(wh.dayOfWeek, { open: e.target.value })}
                                  />
                                </label>
                                <label className="miniLabel">
                                  Fermeture
                                  <input
                                    className="input"
                                    type="time"
                                    value={wh.close}
                                    onChange={(e) => setWorkHour(wh.dayOfWeek, { close: e.target.value })}
                                  />
                                </label>
                              </div>

                              <label className="toggleLine" style={{ marginTop: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={wh.hasLunchPause}
                                  onChange={(e) => setWorkHour(wh.dayOfWeek, { hasLunchPause: e.target.checked })}
                                />
                                Pause déjeuner
                              </label>

                              {wh.hasLunchPause ? (
                                <div className="grid2">
                                  <label className="miniLabel">
                                    Début pause
                                    <input
                                      className="input"
                                      type="time"
                                      value={wh.lunchOpen}
                                      onChange={(e) => setWorkHour(wh.dayOfWeek, { lunchOpen: e.target.value })}
                                    />
                                  </label>
                                  <label className="miniLabel">
                                    Fin pause
                                    <input
                                      className="input"
                                      type="time"
                                      value={wh.lunchClose}
                                      onChange={(e) => setWorkHour(wh.dayOfWeek, { lunchClose: e.target.value })}
                                    />
                                  </label>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                  </div>
                </Field>

                <div className="uploadSection">
                  <div className="uploadLeft">
                    <Field label="Photo de profil" error={errors.profilePhotoFile}>
                      <input
                        className="fileInput"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setForm((prev) => ({
                            ...prev,
                            profilePhotoFile: f,
                            profilePhotoPreviewUrl: f ? URL.createObjectURL(f) : '',
                          }));
                        }}
                      />
                      <div className="avatarPreview">
                        {form.profilePhotoPreviewUrl ? (
                          <img src={form.profilePhotoPreviewUrl} alt="Aperçu" />
                        ) : (
                          <div className="avatarFallback">📷</div>
                        )}
                      </div>
                    </Field>

                    <Field label="Photo du cabinet (optionnel)">
                      <input
                        className="fileInput"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setValue('officePhotoFile', e.target.files?.[0] || null)}
                      />
                    </Field>

                    <Field label="Documents (optionnel : PDF/JPG/PNG)" >
                      <input
                        className="fileInput"
                        type="file"
                        multiple
                        accept="image/*,application/pdf"
                        onChange={(e) => setValue('documentsFiles', Array.from(e.target.files || []))}
                      />
                    </Field>
                  </div>
                </div>

                {serverError ? <div className="serverError">{serverError}</div> : null}
                {serverSuccess ? <div className="serverSuccess">{serverSuccess}</div> : null}

                <div className="actionsRow">
                  <button className="btnSecondary" type="button" onClick={() => setStep(2)}>
                    Précédent
                  </button>
                  <button className="btn" type="submit" disabled={submitting}>
                    {submitting ? "En cours..." : "Terminer l'inscription"}
                  </button>
                </div>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

