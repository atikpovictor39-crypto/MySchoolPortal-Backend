import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPlatformStatus } from './api';
import MaintenancePage from './MaintenancePage';

// Checked once on load (and again on every route change, cheap single GET)
// — a SuperAdmin always gets through so they can reach the Platform Admin
// page and turn it back off; /login stays reachable for everyone so a
// SuperAdmin can actually sign in during a maintenance window.
export default function MaintenanceGate({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    getPlatformStatus()
      .then(setStatus)
      .catch(() => setStatus({ maintenanceMode: false }));
  }, [location.pathname]);

  if (isLoading || !status) return null;

  const isExempt = user?.role === 'SUPERADMIN' || location.pathname === '/login';
  if (status.maintenanceMode && !isExempt) {
    return <MaintenancePage message={status.message} />;
  }

  return children;
}
