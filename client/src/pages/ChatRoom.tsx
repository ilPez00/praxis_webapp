// client/src/pages/ChatRoom.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import '../styles/ChatRoom.css';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  // later: read_by, etc.
}

const ChatRoom: React.FC = () => {
  const { id: conversationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // New state for currentUserId

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []); // Run once on mount to get the user ID

  useEffect(() => {
    if (!conversationId || currentUserId === null) return; // Wait for currentUserId to be set

    // 1. Fetch existing messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) console.error('Fetch error:', error);
      else setMessages(data || []);
      setLoading(false);
    };

    fetchMessages();

    // 2. Subscribe to realtime inserts
    channelRef.current = supabase.channel(`conversation:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
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
  channelRef.current?.send({
    type: 'broadcast',
    event: 'typing',
    payload: { user: currentUserId },
  });
};
    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, currentUserId]); // Add currentUserId to dependency array

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: currentUserId,
        content: newMessage.trim(),
      });

    if (error) console.error('Send error:', error);
    else setNewMessage('');
  };

  return (
    <div className="chat-room">
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h2>Chat with Match</h2> {/* Later: fetch other user's name */}
      </div>

      <div className="messages-container">
        {loading ? (
          <p>Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="empty-state">Say hi to start the conversation!</p>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`message ${msg.sender_id === currentUserId ? 'sent' : 'received'}`}
            >
              <div className="bubble">{msg.content}</div>
              <span className="time">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
        />
        <button className="send-btn" onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default ChatRoom;
