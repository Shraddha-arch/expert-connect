import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (roles && !roles.includes(user.role)) {
    const redirect = user.role === 'admin' ? '/admin' : user.role === 'customer' ? '/chat' : '/provider';
    return <Navigate to={redirect} replace />;
  }

  if (user.role === 'service_provider' && user.status === 'pending' && location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />;
  }

  return children;
}
