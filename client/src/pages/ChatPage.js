"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// client/src/pages/ChatPage.tsx
const react_1 = __importDefault(require("react"));
const react_router_dom_1 = require("react-router-dom");
require("../styles/ChatPage.css");
const mockConversations = [
    { id: '1', matchName: 'Elena Rossi', lastMessage: 'Hey! Saw you’re also tracking body fat % — what’s your current routine?', lastMessageTime: '2m ago', unread: 3 },
    { id: '2', matchName: 'Marco Bianchi', lastMessage: 'Just hit a new portfolio milestone — celebrating with a coffee?', lastMessageTime: '1h ago', unread: 0 },
];
const ChatPage = () => {
    const navigate = (0, react_router_dom_1.useNavigate)();
    return (<div className="chat-page">
      <h1>Messages</h1>

      <div className="conversations-list">
        {mockConversations.map(conv => (<div key={conv.id} className="conversation-item" onClick={() => navigate(`/chat/${conv.id}`)}>
            <div className="avatar-wrapper">
              {conv.matchAvatar ? (<img src={conv.matchAvatar} alt={conv.matchName}/>) : (<div className="avatar-placeholder">{conv.matchName.charAt(0)}</div>)}
              {conv.unread > 0 && <span className="unread-badge">{conv.unread}</span>}
            </div>
            <div className="conv-info">
              <div className="conv-header">
                <h3>{conv.matchName}</h3>
                <span className="time">{conv.lastMessageTime}</span>
              </div>
              <p className="last-message">{conv.lastMessage}</p>
            </div>
          </div>))}
        {mockConversations.length === 0 && (<p className="empty-state">No conversations yet — find matches to start chatting!</p>)}
      </div>
    </div>);
};
exports.default = ChatPage;
