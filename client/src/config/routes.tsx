import React from 'react';
import type { RouteObject } from 'react-router-dom';

// Public Pages — eagerly loaded
import Root from '../layout/Root';
import LoginPage from '../features/auth/LoginPage';
import SignupPage from '../features/auth/SignupPage';
import SuccessPage from '../features/payments/SuccessPage';
import CancelPage from '../features/payments/CancelPage';
import DesktopWidget from '../features/dashboard/components/DesktopWidget';
import MobileWidget from '../features/widgets/MobileWidget';

// Private Pages — lazy loaded
const DashboardPage = React.lazy(() => import('../features/dashboard/DashboardPage'));
const DiscoverPage = React.lazy(() => import('../features/discover/DiscoverPage'));
const ProfilePage = React.lazy(() => import('../features/profile/ProfilePage'));
const MatchesPage = React.lazy(() => import('../features/matches/MatchesPage'));
const ChatPage = React.lazy(() => import('../features/chat/ChatPage'));
const OnboardingPage = React.lazy(() => import('../features/onboarding/OnboardingPage'));
const GoalTreePage = React.lazy(() => import('../features/goals/GoalTreePage'));
const GoalSelectionPage = React.lazy(() => import('../features/goals/GoalSelectionPage'));
const ChatRoom = React.lazy(() => import('../features/chat/ChatRoom'));
const UpgradePage = React.lazy(() => import('../features/payments/UpgradePage'));
// TODO: re-enable when needed
// const IdentityVerificationPage = React.lazy(() => import('../features/identity/IdentityVerificationPage'));
const AnalyticsPage = React.lazy(() => import('../features/analytics/AnalyticsPage'));
const GroupsPage = React.lazy(() => import('../features/groups/GroupsPage'));
const GroupRoom = React.lazy(() => import('../features/groups/GroupRoom'));
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
// TODO: re-enable when events feature is ready
// const EventsPage = React.lazy(() => import('../features/events/EventsPage'));
// const EventCheckinPage = React.lazy(() => import('../features/events/EventCheckinPage'));
const FriendsPage = React.lazy(() => import('../features/friends/FriendsPage'));
const PostThreadPage = React.lazy(() => import('../features/posts/PostThreadPage'));
const SettingsPage = React.lazy(() => import('../features/settings/SettingsPage'));
const ChallengesPage = React.lazy(() => import('../features/challenges/ChallengesPage'));
const FailsPage = React.lazy(() => import('../features/fails/FailsPage'));
const NotesPage = React.lazy(() => import('../features/notes/NotesPage'));
const PublicNotebookPage = React.lazy(() => import('../features/notes/PublicNotebookPage'));
const AchievementCollectionPage = React.lazy(() => import('../features/achievements/AchievementCollectionPage'));
const GoLivePage = React.lazy(() => import('../features/streaming/GoLivePage'));
const WatchStreamPage = React.lazy(() => import('../features/streaming/WatchStreamPage'));
const CameraPage = React.lazy(() => import('../features/camera/CameraPage'));

// Route definitions used by AppRouter to build the data router
export const publicRoutes: RouteObject[] = [
  { index: true, element: <Root /> },
  { path: 'login', element: <LoginPage /> },
  { path: 'signup', element: <SignupPage /> },
  { path: 'success', element: <SuccessPage /> },
  { path: 'cancel', element: <CancelPage /> },
  { path: 'desktop-widget', element: <DesktopWidget /> },
  { path: 'mobile-widget', element: <MobileWidget /> },
  // { path: 'events/checkin', element: <EventCheckinPage /> },  // TODO: re-enable
];

export const privateRoutes: RouteObject[] = [
  { path: 'notes', element: <NotesPage /> },
  { path: 'notes/:userId', element: <PublicNotebookPage /> },
  { path: 'dashboard', element: <DashboardPage /> },
  { path: 'discover', element: <DiscoverPage /> },
  { path: 'profile', element: <ProfilePage /> },
  { path: 'profile/:id', element: <ProfilePage /> },
  { path: 'matches', element: <MatchesPage /> },
  { path: 'matches/:id', element: <MatchesPage /> },
  { path: 'chat', element: <ChatPage /> },
  { path: 'chat/:user1Id/:user2Id', element: <ChatRoom /> },
  { path: 'onboarding', element: <OnboardingPage /> },
  { path: 'goals', element: <GoalTreePage /> },
  { path: 'goals/:id', element: <GoalTreePage /> },
  { path: 'goal-selection', element: <GoalSelectionPage /> },
  { path: 'upgrade', element: <UpgradePage /> },
  // { path: 'verify-identity', element: <IdentityVerificationPage /> },
  { path: 'analytics', element: <AnalyticsPage /> },
  { path: 'communication', element: <CommunicationPage /> },
  { path: 'groups', element: <GroupsPage /> },
  { path: 'groups/:roomId', element: <GroupRoom /> },
  { path: 'boards', element: <BoardsPage /> },
  { path: 'boards/:roomId', element: <GroupRoom /> },
  { path: 'coaching', element: <CoachingPage /> },
  { path: 'search', element: <SearchPage /> },
  { path: 'marketplace', element: <MarketplacePage /> },
  { path: 'admin', element: <AdminPage /> },
  { path: 'leaderboard', element: <LeaderboardPage /> },
  { path: 'services', element: <ServicesPage /> },
  { path: 'commitments', element: <BettingPage /> },
  { path: 'words', element: <WordsPage /> },
  // { path: 'events', element: <EventsPage /> },  // TODO: re-enable
  { path: 'friends', element: <FriendsPage /> },
  { path: 'posts/:postId', element: <PostThreadPage /> },
  { path: 'settings', element: <SettingsPage /> },
  { path: 'challenges', element: <ChallengesPage /> },
  { path: 'fails', element: <FailsPage /> },
  { path: 'achievements', element: <AchievementCollectionPage /> },
  { path: 'go-live', element: <GoLivePage /> },
  { path: 'stream/:id', element: <WatchStreamPage /> },
  { path: 'camera', element: <CameraPage /> },
];

export default { publicRoutes, privateRoutes };
