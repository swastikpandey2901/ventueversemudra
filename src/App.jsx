import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MarketPage from './pages/MarketPage';
import CompanyPage from './pages/CompanyPage';
import PortfolioPage from './pages/PortfolioPage';
import LeaderboardPage from './pages/LeaderboardPage';
import NewsPage from './pages/NewsPage';
import AdminPage from './pages/AdminPage';
import FinancePage from './pages/FinancePage';
import ShopPage from './pages/ShopPage';
import { runAutonomousCycleIfNeeded } from './engine/priceEngine';
import { checkAutonomousNewsDropIfNeeded } from './engine/newsEngine';
import NameSetupModal from './components/NameSetupModal';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-64 text-mudra-muted">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, userData, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-64 text-mudra-muted">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (userData?.role !== 'admin') return <Navigate to="/market" />;
  return children;
};

const AppRoutes = () => {
  useEffect(() => {
    // Market & News are ALWAYS ON: Autonomous background heartbeat every 20s
    runAutonomousCycleIfNeeded();
    checkAutonomousNewsDropIfNeeded();
    const interval = setInterval(() => {
      runAutonomousCycleIfNeeded();
      checkAutonomousNewsDropIfNeeded();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Navbar />
      <NameSetupModal />
      <main>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/market" element={<ProtectedRoute><MarketPage /></ProtectedRoute>} />
        <Route path="/company/:ticker" element={<ProtectedRoute><CompanyPage /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
        <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
        <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </main>
    </>
  );
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
