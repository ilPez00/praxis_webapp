import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../styles/ChatRoom.css';

const ChatRoom: React.FC = () => {
    const { id: conversationId } = useParams();
    const navigate = useNavigate();

    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<any>(null);

    const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined)
    
    useEffect(() => {
      const getCurrentUser = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          setCurrentUserId(user?.id)
      }
      getCurrentUser();
    }, [])

    useEffect(() => {
        if (!conversationId) return;

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

        channelRef.current = supabase.channel(`conversation:${conversationId}`)
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

        channelRef.current
            .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
                // Show "Other is typing..." if payload.user !== currentUserId
            })
            .on('presence', { event: 'sync' }, () => {
                // Online status
            });

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [conversationId]);

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
                <h2>Chat with Match</h2>
            </div>

            <div className="messages-container">
                {loading ? (
                    <p>Loading messages...</p>
                ) : messages.length === 0 ? (
                    <p className="empty-state">Say hi to start the conversation!</p>
                ) : (
                    messages.map(msg => (
                        <div key={msg.id} className={`message ${msg.sender_id === currentUserId ? 'sent' : 'received'}`}>
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