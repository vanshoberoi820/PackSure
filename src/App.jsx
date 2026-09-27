import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ScanPage from './pages/ScanPage';
import ResultPage from './pages/ResultPage';
import EvidencePage from './pages/EvidencePage';
import InspectionsPage from './pages/InspectionsPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import OfficerReviewPage from './pages/OfficerReviewPage';
import ComparisonPage from './pages/ComparisonPage';
import { syncWithCloudDatabase } from './utils/storage';
import { isAuthenticated } from './utils/supabaseClient';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const isAuth = isAuthenticated();
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    // Initial background sync with Supabase PostgreSQL cloud if logged in
    if (isAuthenticated()) {
      syncWithCloudDatabase().catch((err) => {
        console.warn('Initial cloud sync notice:', err);
      });
    }
  }, [location.pathname]);

  return (
    <div className="mobile-container">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Dashboard & App Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/scan"
          element={
            <ProtectedRoute>
              <ScanPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/result/:id"
          element={
            <ProtectedRoute>
              <ResultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/evidence/:id"
          element={
            <ProtectedRoute>
              <EvidencePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inspections"
          element={
            <ProtectedRoute>
              <InspectionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review/:id"
          element={
            <ProtectedRoute>
              <OfficerReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compare/:id"
          element={
            <ProtectedRoute>
              <ComparisonPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
