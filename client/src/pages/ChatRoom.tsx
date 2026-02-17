import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { FeedbackGrade } from '../models/FeedbackGrade';
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import '../styles/ChatRoom.css';

const ChatRoom: React.FC = () => {
    const { id: conversationId } = useParams(); // This ID should ideally map to a match or shared goal
    const navigate = useNavigate();

    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<any>(null);

    const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
    const [showFeedbackForm, setShowFeedbackForm] = useState(false);
    const [userGoalTree, setUserGoalTree] = useState<GoalTree | null>(null);
    const [receiverGoalTree, setReceiverGoalTree] = useState<GoalTree | null>(null);
    const [selectedGoalNode, setSelectedGoalNode] = useState<string>(''); // GoalNode ID
    const [selectedGrade, setSelectedGrade] = useState<FeedbackGrade>(FeedbackGrade.SUCCEEDED);
    const [feedbackComment, setFeedbackComment] = useState('');

    // Assuming the conversationId actually represents the receiverId for now, for simplicity
    const receiverId = conversationId; 

    useEffect(() => {
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id);
        };
        getCurrentUser();
    }, []);

    useEffect(() => {
        if (!currentUserId) return; // Wait for currentUserId to be set

        const fetchUserGoalTree = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/goals/${currentUserId}`);
                setUserGoalTree(response.data);
            } catch (err) {
                console.error('Failed to fetch user goal tree for feedback:', err);
            }
        };
        fetchUserGoalTree();
    }, [currentUserId]); // Refetch when currentUserId changes

    // Fetch receiver's goal tree
    useEffect(() => {
        if (!receiverId) return;

        const fetchReceiverGoalTree = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/goals/${receiverId}`);
                setReceiverGoalTree(response.data);
            } catch (err) {
                console.error('Failed to fetch receiver goal tree:', err);
            }
        };
        fetchReceiverGoalTree();
    }, [receiverId]);

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

    const handleSubmitFeedback = async () => {
        if (!currentUserId || !receiverId || !selectedGoalNode || !selectedGrade) {
            alert('Please select a goal and a grade for feedback.');
            return;
        }

        try {
            await axios.post('http://localhost:3001/feedback', {
                giverId: currentUserId,
                receiverId: receiverId,
                goalNodeId: selectedGoalNode,
                grade: selectedGrade,
                comment: feedbackComment,
            });
            alert('Feedback submitted successfully!');
            setShowFeedbackForm(false);
            // Optionally, reset form fields
            setSelectedGoalNode('');
            setSelectedGrade(FeedbackGrade.SUCCEEDED);
            setFeedbackComment('');
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Failed to submit feedback.');
        }
    };

    if (loading) {
        return <div className="chat-room">Loading messages...</div>;
    }

    const receiverRootGoalsSummary = receiverGoalTree?.rootNodes
        .map(node => `${node.name} (${node.domain})`)
        .join(', ');

    return (
        <div className="chat-room">
            <div className="chat-header">
                <button className="back-btn" onClick={() => navigate(-1)}>←</button>
                <h2>Chat with User {receiverId}</h2>
                {receiverRootGoalsSummary && (
                    <p className="shared-goal-context">
                        Focusing on: {receiverRootGoalsSummary}
                    </p>
                )}
            </div>

            <div className="messages-container">
                {messages.length === 0 ? (
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

            <button onClick={() => setShowFeedbackForm(!showFeedbackForm)} className="feedback-toggle-btn">
                {showFeedbackForm ? 'Hide Feedback Form' : 'Give Feedback'}
            </button>

            {showFeedbackForm && (
                <div className="feedback-form">
                    <h3>Submit Feedback</h3>
                    <div>
                        <label>Goal Node:</label>
                        <select
                            value={selectedGoalNode}
                            onChange={(e) => setSelectedGoalNode(e.target.value)}
                            disabled={!userGoalTree || userGoalTree.nodes.length === 0}
                        >
                            <option value="">Select a goal</option>
                            {userGoalTree?.nodes.map((node: GoalNode) => (
                                <option key={node.id} value={node.id}>
                                    {node.name} ({node.domain})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>Grade:</label>
                        <select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value as FeedbackGrade)}>
                            {Object.values(FeedbackGrade).map((grade) => (
                                <option key={grade} value={grade}>
                                    {grade}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>Comment (optional):</label>
                        <textarea
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            rows={3}
                        ></textarea>
                    </div>
                    <button onClick={handleSubmitFeedback}>Submit Feedback</button>
                </div>
            )}
        </div>
    );
};

export default ChatRoom;