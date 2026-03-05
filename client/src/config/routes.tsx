import React from 'react';

// Public Pages — eagerly loaded (needed immediately on first paint)
import Root from '../layout/Root';
import LoginPage from '../features/auth/LoginPage';
import SignupPage from '../features/auth/SignupPage';
import SuccessPage from '../features/payments/SuccessPage';
import CancelPage from '../features/payments/CancelPage';
import DesktopWidget from '../features/dashboard/components/DesktopWidget';
import MobileWidget from '../features/widgets/MobileWidget';

// Private Pages — lazy loaded (code-split per route, loaded on demand)
const DashboardPage = React.lazy(() => import('../features/dashboard/DashboardPage'));
const ProfilePage = React.lazy(() => import('../features/profile/ProfilePage'));
const MatchesPage = React.lazy(() => import('../features/matches/MatchesPage'));
const ChatPage = React.lazy(() => import('../features/chat/ChatPage'));
const OnboardingPage = React.lazy(() => import('../features/onboarding/OnboardingPage'));
const GoalTreePage = React.lazy(() => import('../features/goals/GoalTreePage'));
const GoalSelectionPage = React.lazy(() => import('../features/goals/GoalSelectionPage'));
const ChatRoom = React.lazy(() => import('../features/chat/ChatRoom'));
const UpgradePage = React.lazy(() => import('../features/payments/UpgradePage'));
const IdentityVerificationPage = React.lazy(() => import('../features/identity/IdentityVerificationPage'));
const AnalyticsPage = React.lazy(() => import('../features/analytics/AnalyticsPage'));
const GroupsPage = React.lazy(() => import('../features/groups/GroupsPage'));
const GroupRoom = React.lazy(() => import('../features/groups/GroupRoom'));
const GroupChatRoom = React.lazy(() => import('../features/groups/GroupChatRoom'));
const BoardsPage = React.lazy(() => import('../features/groups/BoardsPage'));
const CommunicationPage = React.lazy(() => import('../features/communication/CommunicationPage'));
const CoachingPage = React.lazy(() => import('../features/coaching/CoachingPage'));
const SearchPage = React.lazy(() => import('../features/search/SearchPage'));
const MarketplacePage = React.lazy(() => import('../features/marketplace/MarketplacePage'));
const AdminPage = React.lazy(() => import('../features/admin/AdminPage'));
const WordsPage = React.lazy(() => import('../features/admin/WordsPage'));
const LeaderboardPage = React.lazy(() => import('../features/leaderboard/LeaderboardPage'));
const ServicesPage = React.lazy(() => import('../features/services/ServicesPage'));
const BettingPage = React.lazy(() => import('../features/betting/BettingPage'));
const EventsPage = React.lazy(() => import('../features/events/EventsPage'));
const FriendsPage = React.lazy(() => import('../features/friends/FriendsPage'));

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
  { path: '/desktop-widget', element: DesktopWidget, private: false }, // Should be accessible for the desktop app
  { path: '/mobile-widget', element: MobileWidget, private: false }, // Home screen PWA shortcut

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
  { path: '/boards/:roomId', element: GroupRoom, private: true, param: 'roomId' },
  { path: '/coaching', element: CoachingPage, private: true },
  { path: '/search', element: SearchPage, private: true },
  { path: '/marketplace', element: MarketplacePage, private: true },
  { path: '/admin', element: AdminPage, private: true },
  { path: '/leaderboard', element: LeaderboardPage, private: true },
  { path: '/services', element: ServicesPage, private: true },
  { path: '/betting', element: BettingPage, private: true },
  { path: '/words', element: WordsPage, private: true },
  { path: '/events', element: EventsPage, private: true },
  { path: '/friends', element: FriendsPage, private: true },
];

export default routes;
