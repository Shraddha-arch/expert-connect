import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Auth Pages
import Login from './pages/auth/Login';
import CustomerSignup from './pages/auth/CustomerSignup';
import ServiceProviderSignup from './pages/auth/ServiceProviderSignup';

// Customer
import CustomerChatPage from './pages/customer/ChatPage';

// Service Provider
import ProviderDashboard from './pages/serviceProvider/Dashboard';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';

// Landing page
import LandingPage from './pages/LandingPage';

// Pending page
function PendingApproval() {
  const { logout } = require('./context/AuthContext').useAuth();
  const nav = require('react-router-dom').useNavigate();
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2 style={{ marginBottom: 8 }}>Awaiting Approval</h2>
        <p className="text-gray" style={{ marginBottom: 24 }}>
          Your service provider account is under review. You'll be notified once approved.
        </p>
        <button className="btn btn-outline" onClick={() => { logout(); nav('/login'); }}>
          Back to Login
        </button>
      </div>
    </div>
  );
}

function AppLayout({ children }) {
  return (
    <div className="page-wrapper">
      <Navbar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup/customer" element={<CustomerSignup />} />
            <Route path="/signup/provider" element={<ServiceProviderSignup />} />

            {/* Pending */}
            <Route path="/pending" element={<PendingApproval />} />

            {/* Customer */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute roles={['customer']}>
                  <AppLayout>
                    <CustomerChatPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Service Provider */}
            <Route
              path="/provider"
              element={
                <ProtectedRoute roles={['service_provider']}>
                  <AppLayout>
                    <ProviderDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AppLayout>
                    <AdminDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Landing page */}
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
