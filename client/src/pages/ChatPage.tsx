import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Message } from '../models/Message'; // Adjust path as necessary
import { User } from '../models/User'; // Adjust path as necessary

const ChatPage: React.FC = () => {
  const { user1Id, user2Id } = useParams<{ user1Id: string; user2Id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user1, setUser1] = useState<User | null>(null);
  const [user2, setUser2] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!user1Id || !user2Id) {
      setError('Both user IDs are required for chat.');
      setLoading(false);
      return;
    }
    try {
      const messagesResponse = await axios.get(`http://localhost:3001/messages/${user1Id}/${user2Id}`);
      setMessages(messagesResponse.data);

      const user1Response = await axios.get(`http://localhost:3001/users/${user1Id}`);
      setUser1(user1Response.data);
      const user2Response = await axios.get(`http://localhost:3001/users/${user2Id}`);
      setUser2(user2Response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch messages or user data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every few seconds (simplified real-time)
    const interval = setInterval(fetchMessages, 5000); 
    return () => clearInterval(interval);
  }, [user1Id, user2Id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user1Id || !user2Id || !newMessageContent.trim()) return;

    try {
      const response = await axios.post('http://localhost:3001/messages', {
        senderId: user1Id,
        receiverId: user2Id,
        content: newMessageContent,
      });
      setMessages((prevMessages) => [...prevMessages, response.data.message]);
      setNewMessageContent('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send message.');
    }
  };

  if (loading) return <div>Loading chat...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user1 || !user2) return <div>Could not load chat partners.</div>;

  return (
    <div>
      <h1>Chat with {user2.name}</h1>
      <div style={{ border: '1px solid #ccc', padding: '10px', height: '400px', overflowY: 'scroll' }}>
        {messages.length === 0 ? (
          <p>No messages yet. Start the conversation!</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} style={{ textAlign: message.senderId === user1Id ? 'right' : 'left', margin: '5px 0' }}>
              <strong>{message.senderId === user1Id ? user1.name : user2.name}:</strong> {message.content}
              <small style={{ marginLeft: '10px', color: '#888' }}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </small>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} style={{ marginTop: '10px' }}>
        <input
          type="text"
          value={newMessageContent}
          onChange={(e) => setNewMessageContent(e.target.value)}
          placeholder="Type your message..."
          style={{ width: '80%', padding: '8px' }}
          required
        />
        <button type="submit" style={{ width: '18%', padding: '8px', marginLeft: '2%' }}>Send</button>
      </form>
    </div>
  );
};

export default ChatPage;
