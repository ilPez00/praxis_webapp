import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import { Toaster } from 'react-hot-toast';

import Root from './pages/Root';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import MatchesPage from './pages/MatchesPage';
import ChatPage from './pages/ChatPage';
import OnboardingPage from './pages/OnboardingPage';
import GoalTreePage from './pages/GoalTreePage';
import GoalSelectionPage from './pages/GoalSelectionPage';
import ChatRoom from './pages/ChatRoom';
import UpgradePage from './pages/UpgradePage'; // Import UpgradePage
import SuccessPage from './pages/SuccessPage'; // Import SuccessPage
import CancelPage from './pages/CancelPage';   // Import CancelPage
import IdentityVerificationPage from './pages/IdentityVerificationPage'; // Import IdentityVerificationPage
import AnalyticsPage from './pages/AnalyticsPage'; // Import AnalyticsPage

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Navbar />
      <Toaster position="top-right" />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Root />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/success" element={<SuccessPage />} /> {/* Public success page */}
        <Route path="/cancel" element={<CancelPage />} />   {/* Public cancel page */}

        {/* Private Routes */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/matches/:id" element={<MatchesPage />} />
          <Route path="/chat/:user1Id/:user2Id" element={<ChatPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/goals/:id" element={<GoalTreePage />} />
          <Route path="/goal-selection" element={<GoalSelectionPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:id" element={<ChatRoom />} />
          <Route path="/upgrade" element={<UpgradePage />} /> {/* Private upgrade page */}
          <Route path="/verify-identity" element={<IdentityVerificationPage />} /> {/* Private identity verification page */}
          <Route path="/analytics" element={<AnalyticsPage />} /> {/* Private analytics page */}
        </Route>
      </Routes>
    </Router>
  );
};

export default AppRouter;
