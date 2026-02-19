import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Container,
    Box,
    Typography,
    List,
    ListItem,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Badge,
    Divider,
    useTheme,
} from '@mui/material';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../hooks/useUser';
import axios from 'axios';

interface ConversationSummary {
    otherUserId: string;
    otherUserName: string;
    lastMessage: string;
    lastMessageTime: string; // This would ideally be a Date object
    unreadCount: number;
}

const ChatPage: React.FC = () => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { user: currentUser, loading: currentUserLoading } = useUser();
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConversations = async () => {
            if (!currentUser || currentUserLoading) return;

            setLoading(true);
            try {
                // In a real app, this would involve a backend endpoint that
                // fetches a summary of conversations for the currentUser.id
                // For now, let's simulate this by fetching all messages
                // and grouping them.

                const { data: allMessages, error } = await supabase
                    .from('messages')
                    .select('*')
                    .or(`senderId.eq.${currentUser.id},receiverId.eq.${currentUser.id}`)
                    .order('timestamp', { ascending: false }); // Newest first

                if (error) {
                    throw error;
                }

                const convMap = new Map<string, ConversationSummary>();

                for (const message of allMessages || []) {
                    const otherUserId = message.senderId === currentUser.id ? message.receiverId : message.senderId;

                    if (!convMap.has(otherUserId)) {
                        // Fetch other user's details
                        const { data: otherUser, error: userError } = await supabase
                            .from('profiles')
                            .select('id, name')
                            .eq('id', otherUserId)
                            .single();

                        if (userError) {
                            console.error('Error fetching other user profile:', userError);
                            continue;
                        }

                        // Mock unread count and time for now
                        convMap.set(otherUserId, {
                            otherUserId: otherUserId,
                            otherUserName: otherUser?.name || 'Unknown User',
                            lastMessage: message.content,
                            lastMessageTime: new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            unreadCount: Math.floor(Math.random() * 3), // Mock
                        });
                    }
                }
                setConversations(Array.from(convMap.values()));

            } catch (error: any) {
                console.error('Error fetching conversations:', error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [currentUser, currentUserLoading]);

    if (currentUserLoading || loading) {
        return (
            <Container component="main" maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="h5" color="text.secondary">Loading conversations...</Typography>
            </Container>
        );
    }

    return (
        <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'primary.main' }}>
                Messages
            </Typography>

            <List sx={{ bgcolor: 'background.paper', borderRadius: 1, boxShadow: 1 }}>
                {conversations.length > 0 ? (
                    conversations.map((conv, index) => (
                        <React.Fragment key={conv.otherUserId}>
                            <ListItem
                                component={RouterLink} // Use RouterLink for navigation
                                to={`/chat/${currentUser?.id}/${conv.otherUserId}`}
                                sx={{ py: 2, textDecoration: 'none', color: 'inherit' }}
                            >
                                <ListItemAvatar>
                                    <Badge
                                        badgeContent={conv.unreadCount}
                                        color="error"
                                        overlap="circular"
                                        invisible={conv.unreadCount === 0}
                                    >
                                        <Avatar sx={{ bgcolor: theme.palette.action.active }}>
                                            {conv.otherUserName.charAt(0)}
                                        </Avatar>
                                    </Badge>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="h6" component="span" sx={{ color: 'primary.main' }}>
                                                {conv.otherUserName}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {conv.lastMessageTime}
                                            </Typography>
                                        </Box>
                                    }
                                    secondary={
                                        <Typography variant="body2" color="text.secondary" noWrap>
                                            {conv.lastMessage}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                            {index < conversations.length - 1 && <Divider component="li" />}
                        </React.Fragment>
                    ))
                ) : (
                    <ListItem>
                        <ListItemText>
                            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                No conversations yet — find matches to start chatting!
                            </Typography>
                        </ListItemText>
                    </ListItem>
                )}
            </List>
        </Container>
    );
};

export default ChatPage;