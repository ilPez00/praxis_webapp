import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import App from './App';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import MatchesPage from './pages/MatchesPage';
import ChatPage from './pages/ChatPage';
import OnboardingPage from './pages/OnboardingPage';
import GoalTreePage from './pages/GoalTreePage';
import GoalSelectionPage from './pages/GoalSelectionPage';
import ChatRoom from './pages/ChatRoom';

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/test" element={<App />} />
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
      </Routes>
    </Router>
  );
};

export default AppRouter;
