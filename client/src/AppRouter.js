"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const react_router_dom_1 = require("react-router-dom");
const App_1 = __importDefault(require("./App")); // Our current test component
// Import authentication pages
const LoginPage_1 = __importDefault(require("./pages/LoginPage"));
const SignupPage_1 = __importDefault(require("./pages/SignupPage"));
const ProfilePage_1 = __importDefault(require("./pages/ProfilePage")); // Import ProfilePage
const MatchesPage_1 = __importDefault(require("./pages/MatchesPage")); // Import MatchesPage
const ChatPage_1 = __importDefault(require("./pages/ChatPage")); // Import ChatPage
const AppRouter = () => {
    return (<react_router_dom_1.BrowserRouter>
      <react_router_dom_1.Routes>
        <react_router_dom_1.Route path="/" element={<react_router_dom_1.Navigate to="/login" replace/>}/> {/* Redirect to login */}
        <react_router_dom_1.Route path="/login" element={<LoginPage_1.default />}/>
        <react_router_dom_1.Route path="/signup" element={<SignupPage_1.default />}/>
        <react_router_dom_1.Route path="/test" element={<App_1.default />}/> 
        <react_router_dom_1.Route path="/profile" element={<ProfilePage_1.default />}/>
        <react_router_dom_1.Route path="/profile/:id" element={<ProfilePage_1.default />}/> {/* Profile page route */}
        <react_router_dom_1.Route path="/matches/:id" element={<MatchesPage_1.default />}/> {/* Matches page route */}
        <react_router_dom_1.Route path="/chat/:user1Id/:user2Id" element={<ChatPage_1.default />}/> {/* Chat page route */}
        <react_router_dom_1.Route path="/onboarding" element={<OnboardingPage />}/>
        <react_router_dom_1.Route path="/matches" element={<MatchesPage_1.default />}/>
        <react_router_dom_1.Route path="/chat" element={<ChatPage_1.default />}/>
        <react_router_dom_1.Route path="/chat/:id" element={<ChatRoom />}/>
       
           {/* TODO: Add more routes here as we build out the components:
       <Route path="/goals/:id" element={<GoalTreePage />} />
     */}
      </react_router_dom_1.Routes>
    </react_router_dom_1.BrowserRouter>);
};
exports.default = AppRouter;
