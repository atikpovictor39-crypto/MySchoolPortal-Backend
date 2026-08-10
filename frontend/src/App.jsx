import AppRoutes from './routes/AppRoutes';
import MaintenanceGate from './features/platform/MaintenanceGate';

export default function App() {
  return (
    <MaintenanceGate>
      <AppRoutes />
    </MaintenanceGate>
  );
}
