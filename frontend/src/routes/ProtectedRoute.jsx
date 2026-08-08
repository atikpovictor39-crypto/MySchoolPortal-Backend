import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// TODO: also support an `allowedRoles` prop to gate by role once we have
// distinct dashboards per role (SuperAdmin/SchoolAdmin/Teacher/Parent/Student).
export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null; // avoid flashing a redirect while session restore is in flight
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}
