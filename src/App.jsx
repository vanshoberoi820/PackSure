import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  return (
    <div className="mobile-container">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/result/:id" element={<ResultPage />} />
        <Route path="/evidence/:id" element={<EvidencePage />} />
        <Route path="/inspections" element={<InspectionsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/review/:id" element={<OfficerReviewPage />} />
        <Route path="/compare/:id" element={<ComparisonPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
