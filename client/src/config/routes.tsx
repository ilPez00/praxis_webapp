import React from 'react';

// Public Pages
import Root from '../layout/Root';
import LoginPage from '../features/auth/LoginPage';
import SignupPage from '../features/auth/SignupPage';
import SuccessPage from '../features/payments/SuccessPage';
import CancelPage from '../features/payments/CancelPage';

// Private Pages
import DashboardPage from '../features/dashboard/DashboardPage';
import ProfilePage from '../features/profile/ProfilePage';
import MatchesPage from '../features/matches/MatchesPage';
import ChatPage from '../features/chat/ChatPage';
import OnboardingPage from '../features/onboarding/OnboardingPage';
import GoalTreePage from '../features/goals/GoalTreePage';
import GoalSelectionPage from '../features/goals/GoalSelectionPage';
import ChatRoom from '../features/chat/ChatRoom';
import UpgradePage from '../features/payments/UpgradePage';
import IdentityVerificationPage from '../features/identity/IdentityVerificationPage';
import AnalyticsPage from '../features/analytics/AnalyticsPage';
import GroupsPage from '../features/groups/GroupsPage';
import GroupRoom from '../features/groups/GroupRoom';
import GroupChatRoom from '../features/groups/GroupChatRoom';
import BoardsPage from '../features/groups/BoardsPage';
import CommunicationPage from '../features/communication/CommunicationPage';
import CoachingPage from '../features/coaching/CoachingPage';
import AICoachPage from '../features/coaching/AICoachPage';
import SearchPage from '../features/search/SearchPage';
import MarketplacePage from '../features/marketplace/MarketplacePage';
import AdminPage from '../features/admin/AdminPage';

interface RouteConfig {
  path: string;
  element: React.ElementType;
  private: boolean;
  param?: string; // Optional parameter for routes like /profile/:id
}

const routes: RouteConfig[] = [
  // Public Routes
  { path: '/', element: Root, private: false },
  { path: '/login', element: LoginPage, private: false },
  { path: '/signup', element: SignupPage, private: false },
  { path: '/success', element: SuccessPage, private: false },
  { path: '/cancel', element: CancelPage, private: false },

  // Private Routes
  { path: '/dashboard', element: DashboardPage, private: true },
  { path: '/profile', element: ProfilePage, private: true },
  { path: '/profile/:id', element: ProfilePage, private: true, param: 'id' },
  { path: '/matches', element: MatchesPage, private: true },
  { path: '/matches/:id', element: MatchesPage, private: true, param: 'id' },
  { path: '/chat', element: ChatPage, private: true },
  { path: '/chat/:user1Id/:user2Id', element: ChatRoom, private: true, param: 'user1Id' },
  { path: '/onboarding', element: OnboardingPage, private: true },
  { path: '/goals', element: GoalTreePage, private: true },
  { path: '/goals/:id', element: GoalTreePage, private: true, param: 'id' },
  { path: '/goal-selection', element: GoalSelectionPage, private: true },
  { path: '/upgrade', element: UpgradePage, private: true },
  { path: '/verify-identity', element: IdentityVerificationPage, private: true },
  { path: '/analytics', element: AnalyticsPage, private: true },
  { path: '/communication', element: CommunicationPage, private: true },
  { path: '/groups', element: GroupsPage, private: true },
  { path: '/groups/:roomId', element: GroupRoom, private: true, param: 'roomId' },
  { path: '/boards', element: BoardsPage, private: true },
  { path: '/boards/:roomId', element: GroupChatRoom, private: true, param: 'roomId' },
  { path: '/coaching', element: CoachingPage, private: true },
  { path: '/ai-coach', element: AICoachPage, private: true },
  { path: '/search', element: SearchPage, private: true },
  { path: '/marketplace', element: MarketplacePage, private: true },
  { path: '/admin', element: AdminPage, private: true },
];

export default routes;
