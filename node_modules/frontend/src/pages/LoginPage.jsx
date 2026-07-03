import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client.js';

import './login/LoginPage.css';

function getRoleFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role || null;
  } catch {
    return null;
  }
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      localStorage.setItem('token', data.token);
      const role = getRoleFromToken(data.token);
      if (role === 'doctor') {
        navigate('/doctor/dashboard');
        return;
      }
      if (role === 'patient') {
        navigate('/choose-doctor');
        return;
      }
      navigate('/me');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loginLayout pageWrap">
      <div className="pageCard loginCard pageEnter">
        <div className="pageInner">
          <div className="loginRow">
            <div>
              <h3 className="title">Login</h3>
              <p className="subtitle">Connectez-vous en quelques secondes.</p>

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
                  <div className="label">Password</div>
                  <input
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    required
                  />
                </div>

                <button disabled={loading} className="btn" type="submit">
                  {loading ? 'Logging in...' : 'Login'}
                </button>
              </form>

              {error ? <p className="error">{error}</p> : null}

              <div className="linksInline">
                <Link className="inlineLink" to="/register">
                  Create account
                </Link>
              </div>
            </div>

            <aside className="sideInfo">
              <div className="sideBadge">🩺 Santé • Safe UI</div>
              <h4 className="sideTitle">Une interface claire</h4>
              <p className="sideText">
                Animations douces, focus visible et mise en page “card”.
                Pensée pour une expérience rapide et professionnelle.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}


