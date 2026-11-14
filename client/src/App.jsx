import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import RequireAuth from './components/RequireAuth';
import AppLayout from './layouts/AppLayout';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import DonationsPage from './pages/DonationsPage';
import MarketplacePage from './pages/MarketplacePage';
import OrdersPage from './pages/OrdersPage';
import RequestsPage from './pages/RequestsPage';
import DeliveriesPage from './pages/DeliveriesPage';
import NotificationsPage from './pages/NotificationsPage';
import ComplaintsPage from './pages/ComplaintsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';

function AuthRoute({ mode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="global-loading"><span className="spinner" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <AuthPage mode={mode} />;
}
function AdminGuard() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminPage /> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthRoute mode="login" />} />
    <Route path="/register" element={<AuthRoute mode="register" />} />
    <Route path="/browse" element={<MarketplacePage publicMode />} />
    <Route element={<RequireAuth />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/donations" element={<DonationsPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/deliveries" element={<DeliveriesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="/admin" element={<AdminGuard />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
