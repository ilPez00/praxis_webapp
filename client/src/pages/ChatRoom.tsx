import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { FeedbackGrade } from '../models/FeedbackGrade';
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    List,
    ListItem,
    ListItemText,
    AppBar,
    Toolbar,
    IconButton,
    Paper,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Stack,
    Avatar,
    useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';

const ChatRoom: React.FC = () => {
    const { user1Id, user2Id } = useParams<{ user1Id: string; user2Id: string }>();
    const navigate = useNavigate();
    const theme = useTheme();

    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<any>(null);

    const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
    const [receiverName, setReceiverName] = useState<string>('Partner');
    const [showFeedbackForm, setShowFeedbackForm] = useState(false);
    const [userGoalTree, setUserGoalTree] = useState<GoalTree | null>(null);
    const [receiverGoalTree, setReceiverGoalTree] = useState<GoalTree | null>(null);
    const [selectedGoalNode, setSelectedGoalNode] = useState<string>(''); // GoalNode ID
    const [selectedGrade, setSelectedGrade] = useState<FeedbackGrade>(FeedbackGrade.SUCCEEDED);
    const [feedbackComment, setFeedbackComment] = useState('');

    useEffect(() => {
        const getCurrentUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserId(user?.id);
        };
        getCurrentUser();
    }, []);

    // Fetch receiver's name
    useEffect(() => {
        if (!user2Id) return;
        const fetchReceiverName = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('name')
                    .eq('id', user2Id)
                    .single();
                if (error) throw error;
                setReceiverName(data.name || 'Partner');
            } catch (error) {
                console.error('Error fetching receiver name:', error);
            }
        };
        fetchReceiverName();
    }, [user2Id]);

    useEffect(() => {
        if (!currentUserId) return;

        const fetchUserGoalTree = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/goals/${currentUserId}`);
                setUserGoalTree(response.data);
            } catch (err) {
                console.error('Failed to fetch user goal tree for feedback:', err);
            }
        };
        fetchUserGoalTree();
    }, [currentUserId]);

    useEffect(() => {
        if (!user2Id) return;

        const fetchReceiverGoalTree = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/goals/${user2Id}`);
                setReceiverGoalTree(response.data);
            } catch (err) {
                console.error('Failed to fetch receiver goal tree:', err);
            }
        };
        fetchReceiverGoalTree();
    }, [user2Id]);

    useEffect(() => {
        if (!user1Id || !user2Id) return;

        const fetchMessages = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/messages/${user1Id}/${user2Id}`);
                setMessages(response.data || []);
            } catch (error) {
                console.error('Fetch messages error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();

        // Create a unique channel name for the conversation
        const channelName = [user1Id, user2Id].sort().join('-');

        channelRef.current = supabase.channel(`chat_${channelName}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `or(senderId.eq.${user1Id},senderId.eq.${user2Id})`, // Filter for messages relevant to this chat
            }, (payload) => {
                // Only add message if it's for this specific conversation
                const newMessage = payload.new;
                if ((newMessage.senderId === user1Id && newMessage.receiverId === user2Id) ||
                    (newMessage.senderId === user2Id && newMessage.receiverId === user1Id)) {
                    setMessages(prev => [...prev, newMessage]);
                }
            })
            .subscribe((status) => {
                console.log('Realtime status:', status);
            });

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [user1Id, user2Id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if (!newMessage.trim() || !currentUserId || !user2Id) return;

        try {
            await axios.post('http://localhost:3001/messages/send', {
                senderId: currentUserId,
                receiverId: user2Id,
                content: newMessage.trim(),
            });
            setNewMessage('');
        } catch (error) {
            console.error('Send message error:', error);
        }
    };

    const handleSubmitFeedback = async () => {
        if (!currentUserId || !user2Id || !selectedGoalNode || !selectedGrade) {
            alert('Please select a goal and a grade for feedback.');
            return;
        }

        try {
            await axios.post('http://localhost:3001/feedback', {
                giverId: currentUserId,
                receiverId: user2Id,
                goalNodeId: selectedGoalNode,
                grade: selectedGrade,
                comment: feedbackComment,
            });
            alert('Feedback submitted successfully!');
            setShowFeedbackForm(false);
            setSelectedGoalNode('');
            setSelectedGrade(FeedbackGrade.SUCCEEDED);
            setFeedbackComment('');
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('Failed to submit feedback.');
        }
    };

    if (loading || !currentUserId) {
        return (
            <Container component="main" maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="h5" color="text.secondary">Loading chat...</Typography>
            </Container>
        );
    }

    const receiverRootGoalsSummary = receiverGoalTree?.rootNodes
        .map(node => `${node.name} (${node.domain})`)
        .join(', ');

    return (
        <Container component="main" maxWidth="md" sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
            <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid', borderColor: theme.palette.divider }}>
                <Toolbar>
                    <IconButton edge="start" color="inherit" aria-label="back" onClick={() => navigate(-1)}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Avatar sx={{ bgcolor: theme.palette.action.active, mr: 1 }}>
                        {receiverName.charAt(0)}
                    </Avatar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'primary.main' }}>
                        Chat with {receiverName}
                    </Typography>
                </Toolbar>
            </AppBar>

            <Box sx={{ p: 2, bgcolor: 'background.default', flexGrow: 1, overflowY: 'auto' }}>
                {receiverRootGoalsSummary && (
                    <Paper elevation={0} sx={{ p: 1, mb: 2, bgcolor: theme.palette.grey[200], textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">
                            Focusing on: {receiverRootGoalsSummary}
                        </Typography>
                    </Paper>
                )}
                <List>
                    {messages.length === 0 ? (
                        <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                            Say hi to start the conversation!
                        </Typography>
                    ) : (
                        messages.map(msg => (
                            <ListItem
                                key={msg.id}
                                sx={{
                                    justifyContent: msg.senderId === currentUserId ? 'flex-end' : 'flex-start',
                                    p: 0,
                                    mb: 1,
                                }}
                            >
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 1.5,
                                        borderRadius: '20px',
                                        backgroundColor: msg.senderId === currentUserId ? theme.palette.primary.main : theme.palette.secondary.main,
                                        color: msg.senderId === currentUserId ? theme.palette.common.white : theme.palette.text.primary,
                                        maxWidth: '70%',
                                        wordBreak: 'break-word',
                                        borderColor: msg.senderId === currentUserId ? theme.palette.primary.main : theme.palette.secondary.light,
                                    }}
                                >
                                    <Typography variant="body2">{msg.content}</Typography>
                                    <Typography variant="caption" display="block" sx={{ textAlign: 'right', mt: 0.5, color: msg.senderId === currentUserId ? 'rgba(255,255,255,0.7)' : theme.palette.text.secondary }}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                </Paper>
                            </ListItem>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </List>
            </Box>

            <Box sx={{ p: 2, borderTop: '1px solid', borderColor: theme.palette.divider, bgcolor: 'background.paper' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && sendMessage()}
                        size="small"
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={sendMessage}
                        endIcon={<SendIcon />}
                        sx={{ height: '40px', bgcolor: theme.palette.action.active }}
                    >
                        Send
                    </Button>
                </Stack>
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Button
                        onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                        variant="text"
                        sx={{ color: theme.palette.action.active }}
                    >
                        {showFeedbackForm ? 'Hide Feedback Form' : 'Give Feedback'}
                    </Button>
                </Box>
            </Box>

            {showFeedbackForm && (
                <Paper elevation={3} sx={{ p: 3, mt: 2, bgcolor: 'background.paper' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ color: 'primary.main' }}>Submit Feedback</Typography>
                        <IconButton onClick={() => setShowFeedbackForm(false)} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Stack spacing={2}>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel>Goal Node</InputLabel>
                            <Select
                                value={selectedGoalNode}
                                onChange={(e) => setSelectedGoalNode(e.target.value as string)}
                                label="Goal Node"
                                disabled={!userGoalTree || userGoalTree.nodes.length === 0}
                            >
                                <MenuItem value="">
                                    <em>Select a goal</em>
                                </MenuItem>
                                {userGoalTree?.nodes.map((node: GoalNode) => (
                                    <MenuItem key={node.id} value={node.id}>
                                        {node.name} ({node.domain})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel>Grade</InputLabel>
                            <Select
                                value={selectedGrade}
                                onChange={(e) => setSelectedGrade(e.target.value as FeedbackGrade)}
                                label="Grade"
                            >
                                {Object.values(FeedbackGrade).map((grade) => (
                                    <MenuItem key={grade} value={grade}>
                                        {grade}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Comment (optional)"
                            multiline
                            rows={3}
                            variant="outlined"
                            fullWidth
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSubmitFeedback}
                            sx={{ bgcolor: theme.palette.action.active }}
                        >
                            Submit Feedback
                        </Button>
                    </Stack>
                </Paper>
            )}
        </Container>
    );
};

export default ChatRoom;