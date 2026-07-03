import React, { useMemo } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';

import { AppNavbar } from './components/AppNavbar/AppNavbar.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { MePage } from './pages/MePage.jsx';
import { ChooseDoctorPage } from './pages/chooseDoctor/ChooseDoctorPage.jsx';
import { BookAppointmentPage } from './pages/bookAppointment/BookAppointmentPage.jsx';
import { DoctorSignupPage } from './pages/doctor/DoctorSignupPage.jsx';
import DoctorDashboardPage from './pages/doctor/dashboard/DoctorDashboardPage.jsx';
import DoctorAgendaPage from './pages/doctor/agenda/DoctorAgendaPage.jsx';
import DoctorPatientsPage from './pages/doctor/patients/DoctorPatientsPage.jsx';
import DoctorStatsPage from './pages/doctor/stats/DoctorStatsPage.jsx';
import DoctorCabinetPage from './pages/doctor/cabinet/DoctorCabinetPage.jsx';

function getRoleFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role || null;
  } catch {
    return null;
  }
}


import './styles/global.css';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const auth = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      isAuthenticated: Boolean(token),
      token,
      role: getRoleFromToken(token),
    };
  }, [location.pathname]);

  const publicPaths = ['/', '/login', '/register', '/doctor-register'];
  const authRedirectPath = auth.role === 'doctor' ? '/doctor/dashboard' : auth.role === 'patient' ? '/choose-doctor' : '/me';

  function onLogout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  if (auth.isAuthenticated && publicPaths.includes(location.pathname)) {
    return <Navigate to={authRedirectPath} replace />;
  }

  if (!auth.isAuthenticated && !publicPaths.includes(location.pathname)) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="appShell">
      {auth.isAuthenticated && location.pathname !== '/login' && location.pathname !== '/register' && location.pathname !== '/' ? (
        <div style={{ paddingTop: 70 }}>
          <AppNavbar />
        </div>
      ) : (
        <header className="appHeader"> 
          <div className="brand">
            <h2 className="brandTitle">DocTime</h2>
            <p className="brandSubtitle">Prise de rendez-vous • UI moderne & animations</p>
          </div>

          <nav className="appNav">
            <Link className="navLink" to="/login">
              Login
            </Link>
            <Link className="navLink" to="/register">
              Register
            </Link>
            <Link className="navLink" to="/doctor-register">
              Doctor signup
            </Link>
          </nav>
        </header>
      )}

      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/doctor-register" element={<DoctorSignupPage />} />
        <Route path="/choose-doctor" element={<ChooseDoctorPage />} />

        <Route path="/book-appointment" element={<BookAppointmentPage />} />
        <Route path="/me" element={<MePage />} />

        <Route path="/doctor/dashboard" element={<DoctorDashboardPage />} />
        <Route path="/doctor/appointments" element={<DoctorAgendaPage />} />
        <Route path="/doctor/patients" element={<DoctorPatientsPage />} />
        <Route path="/doctor/stats" element={<DoctorStatsPage />} />
        <Route path="/doctor/cabinet" element={<DoctorCabinetPage />} />
        <Route path="/doctor/agenda" element={<DoctorAgendaPage />} />


      </Routes>
    </div>
  );
}











