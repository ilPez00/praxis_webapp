import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import App from './App'; // Our current test component

// Import authentication pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProfilePage from './pages/ProfilePage'; // Import ProfilePage
import MatchesPage from './pages/MatchesPage'; // Import MatchesPage
import ChatPage from './pages/ChatPage';       // Import ChatPage

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} /> {/* Redirect to login */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        {/* The App component is currently a test component showing backend connection */}
        <Route path="/test" element={<App />} /> 
        
        <Route path="/profile/:id" element={<ProfilePage />} /> {/* Profile page route */}
        <Route path="/matches/:id" element={<MatchesPage />} /> {/* Matches page route */}
        <Route path="/chat/:user1Id/:user2Id" element={<ChatPage />} /> {/* Chat page route */}
        {/*
          TODO: Add more routes here as we build out the components:
          <Route path="/goals/:id" element={<GoalTreePage />} />
        */}
      </Routes>
    </Router>
  );
};

export default AppRouter;
