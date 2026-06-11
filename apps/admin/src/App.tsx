import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken } from './api/client';
import { Layout } from './components/Layout';
import { RestaurantProvider } from './state/restaurant';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { BlockedSlotsPage } from './pages/BlockedSlotsPage';
import { CalendarPage } from './pages/CalendarPage';
import { CallLogsPage } from './pages/CallLogsPage';
import { LoginPage } from './pages/LoginPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { RestaurantsPage } from './pages/RestaurantsPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';

function Protected({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <RestaurantProvider>{children}</RestaurantProvider>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Navigate to="/calendario" replace />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/reservas" element={<ReservationsPage />} />
        <Route path="/disponibilidad" element={<AvailabilityPage />} />
        <Route path="/bloqueos" element={<BlockedSlotsPage />} />
        <Route path="/revision" element={<ReviewPage />} />
        <Route path="/llamadas" element={<CallLogsPage />} />
        <Route path="/restaurantes" element={<RestaurantsPage />} />
        <Route path="/ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/calendario" replace />} />
      </Route>
    </Routes>
  );
}
