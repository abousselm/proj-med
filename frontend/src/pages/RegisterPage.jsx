import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';

import './register/RegisterPage.css';

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: { email, password, firstName, lastName, phoneNumber },
      });

      localStorage.setItem('token', data.token);
      navigate('/me');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="registerLayout pageWrap">
      <div className="pageCard registerCard pageEnter">
        <div className="pageInner">
          <h3 className="title">Register</h3>
          <p className="subtitle">Créez votre compte en toute sécurité.</p>

          <form onSubmit={onSubmit} className="form">
            <div className="field">
              <div className="label">Email</div>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </div>

            <div className="field">
              <div className="label">Prénom</div>
              <input
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                type="text"
                required
              />
            </div>

            <div className="field">
              <div className="label">Nom</div>
              <input
                className="input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                type="text"
                required
              />
            </div>


            <div className="field">
              <div className="label">Num téléphone</div>
              <input
                className="input"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                type="tel"
                required
              />
            </div>

            <div className="field">
              <div className="label">Password</div>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={6}
              />
            </div>


            <button disabled={loading} className="btn" type="submit">
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>

          <ul className="hintList">
            <li className="hint">
              <span className="dot" />
              Mot de passe: au moins 6 caractères.
            </li>
            <li className="hint">
              <span className="dot" />
              Le token sera stocké dans le navigateur.
            </li>
          </ul>

          {error ? <p className="error">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}


