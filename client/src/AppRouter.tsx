import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar'; // Import Navbar
import App from './App'; // Our current test component

// Import authentication pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProfilePage from './pages/ProfilePage'; // Import ProfilePage
import MatchesPage from './pages/MatchesPage'; // Import MatchesPage
import ChatPage from './pages/ChatPage';       // Import ChatPage
import OnboardingPage from './pages/OnboardingPage'; // Import OnboardingPage
import GoalTreePage from './pages/GoalTreePage';
import ChatRoom from './pages/ChatRoom';       // Import ChatRoom

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Navbar /> {/* Add Navbar here */}
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} /> {/* Redirect to login */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/test" element={<App />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:id" element={<ProfilePage />} /> {/* Profile page route */}
        <Route path="/matches/:id" element={<MatchesPage />} /> {/* Matches page route */}
        <Route path="/chat/:user1Id/:user2Id" element={<ChatPage />} /> {/* Chat page route */}
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/goals/:id" element={<GoalTreePage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:id" element={<ChatRoom />} />

           {/* TODO: Add more routes here as we build out the components:
          <Route path="/goals/:id" element={<GoalTreePage />} />
        */}
      </Routes>
    </Router>
  );
};

export default AppRouter;
