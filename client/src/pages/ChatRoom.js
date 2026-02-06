"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// client/src/pages/ChatRoom.tsx
const react_1 = __importStar(require("react"));
const react_router_dom_1 = require("react-router-dom");
const supabase_1 = require("../lib/supabase");
require("../styles/ChatRoom.css");
const ChatRoom = () => {
    var _a, _b;
    const { id: conversationId } = (0, react_router_dom_1.useParams)();
    const navigate = (0, react_router_dom_1.useNavigate)();
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [newMessage, setNewMessage] = (0, react_1.useState)('');
    const [loading, setLoading] = (0, react_1.useState)(true);
    const messagesEndRef = (0, react_1.useRef)(null);
    const channelRef = (0, react_1.useRef)(null);
    const currentUserId = (_b = (_a = supabase_1.supabase.auth.getUser()) === null || _a === void 0 ? void 0 : _a.data.user) === null || _b === void 0 ? void 0 : _b.id; // or from context
    (0, react_1.useEffect)(() => {
        if (!conversationId)
            return;
        // 1. Fetch existing messages
        const fetchMessages = () => __awaiter(void 0, void 0, void 0, function* () {
            const { data, error } = yield supabase_1.supabase
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: true });
            if (error)
                console.error('Fetch error:', error);
            else
                setMessages(data || []);
            setLoading(false);
        });
        fetchMessages();
        // 2. Subscribe to realtime inserts
        channelRef.current = supabase_1.supabase.channel(`conversation:${conversationId}`)
            .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => {
            setMessages(prev => [...prev, payload.new]);
        })
            .subscribe((status) => {
            console.log('Realtime status:', status);
        });
        // Inside useEffect, after subscribe
        channelRef.current
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
            // Show "Other is typing..." if payload.user !== currentUserId
        })
            .on('presence', { event: 'sync' }, () => {
            // Online status
        });
        // When user types:
        const handleTyping = () => {
            var _a;
            (_a = channelRef.current) === null || _a === void 0 ? void 0 : _a.send({
                type: 'broadcast',
                event: 'typing',
                payload: { user: currentUserId },
            });
        };
        // Cleanup
        return () => {
            if (channelRef.current) {
                supabase_1.supabase.removeChannel(channelRef.current);
            }
        };
    }, [conversationId]);
    (0, react_1.useEffect)(() => {
        var _a;
        (_a = messagesEndRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    const sendMessage = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!newMessage.trim() || !conversationId)
            return;
        const { error } = yield supabase_1.supabase
            .from('messages')
            .insert({
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: newMessage.trim(),
        });
        if (error)
            console.error('Send error:', error);
        else
            setNewMessage('');
    });
    return (<div className="chat-room">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>Chat with Match</h2> {/* Later: fetch other user's name */}
      </div>

      <div className="messages-container">
        {loading ? (<p>Loading messages...</p>) : messages.length === 0 ? (<p className="empty-state">Say hi to start the conversation!</p>) : (messages.map(msg => (<div key={msg.id} className={`message ${msg.sender_id === currentUserId ? 'sent' : 'received'}`}>
              <div className="bubble">{msg.content}</div>
              <span className="time">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>)))}
        <div ref={messagesEndRef}/>
      </div>

      <div className="input-area">
        <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." onKeyPress={e => e.key === 'Enter' && sendMessage()}/>
        <button className="send-btn" onClick={sendMessage}>Send</button>
      </div>
    </div>);
};
exports.default = ChatRoom;
