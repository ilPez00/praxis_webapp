import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
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
    Chip,
    Tooltip,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { useUser } from '../../hooks/useUser';

interface ConversationSummary {
    otherUserId: string;
    otherUserName: string;
    lastMessage: string;
    lastMessageTime: string; // This would ideally be a Date object
    unreadCount: number;
}

const ChatPage: React.FC = () => {
    const { user: currentUser, loading: currentUserLoading } = useUser();
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [mutualStreaks, setMutualStreaks] = useState<Record<string, number>>({});

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
                    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
                    .order('timestamp', { ascending: false }); // Newest first

                if (error) {
                    throw error;
                }

                // Collect unique other-user IDs and their most recent message
                const latestMessageByUser = new Map<string, typeof allMessages[0]>();
                for (const message of allMessages || []) {
                    const otherUserId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;
                    if (!otherUserId) continue; // skip group/system messages
                    if (!latestMessageByUser.has(otherUserId)) {
                        latestMessageByUser.set(otherUserId, message);
                    }
                }

                // Batch fetch all profiles in a single query
                const otherUserIds = Array.from(latestMessageByUser.keys());
                let profileMap = new Map<string, { id: string; name: string }>();
                if (otherUserIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, name')
                        .in('id', otherUserIds);
                    for (const p of profiles || []) {
                        profileMap.set(p.id, p);
                    }
                }

                const convList: ConversationSummary[] = [];
                for (const [otherUserId, message] of Array.from(latestMessageByUser)) {
                    const profile = profileMap.get(otherUserId);
                    convList.push({
                        otherUserId,
                        otherUserName: profile?.name || 'Unknown User',
                        lastMessage: message.content,
                        lastMessageTime: new Date(message.timestamp || message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        unreadCount: 0,
                    });
                }
                setConversations(convList);

            } catch (error: any) {
                console.error('Error fetching conversations:', error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [currentUser, currentUserLoading]);

    // Fetch mutual streaks for all conversation partners
    useEffect(() => {
        if (conversations.length === 0 || !currentUser) return;
        (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
                const results = await Promise.allSettled(
                    conversations.map(conv =>
                        axios.get(`${API_URL}/checkins/mutual`, { params: { partnerId: conv.otherUserId }, headers })
                            .then(r => ({ id: conv.otherUserId, streak: r.data.mutualStreak as number }))
                    )
                );
                const map: Record<string, number> = {};
                for (const r of results) {
                    if (r.status === 'fulfilled' && r.value.streak > 0) {
                        map[r.value.id] = r.value.streak;
                    }
                }
                setMutualStreaks(map);
            } catch {
                // silently ignore
            }
        })();
    }, [conversations, currentUser]);

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
                {/* Master Roshi — always pinned at top */}
                <ListItem
                    component={RouterLink}
                    to="/coaching"
                    sx={{
                        py: 2,
                        textDecoration: 'none',
                        color: 'inherit',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.07) 0%, rgba(139,92,246,0.05) 100%)',
                        borderLeft: '3px solid rgba(245,158,11,0.6)',
                        '&:hover': { background: 'linear-gradient(135deg, rgba(245,158,11,0.13) 0%, rgba(139,92,246,0.1) 100%)' },
                    }}
                >
                    <ListItemAvatar>
                        <Avatar sx={{
                            background: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)',
                            border: '2px solid rgba(245,158,11,0.45)',
                            fontSize: '1.25rem',
                            width: 44,
                            height: 44,
                        }}>
                            🥋
                        </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                        primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="h6" component="span" sx={{ color: '#F59E0B', fontWeight: 800 }}>
                                        Master Roshi
                                    </Typography>
                                    <Chip
                                        icon={<AutoAwesomeIcon sx={{ fontSize: '12px !important' }} />}
                                        label="AI Coach"
                                        size="small"
                                        sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 700 }}
                                    />
                                </Box>
                                <Typography variant="caption" sx={{ color: 'rgba(245,158,11,0.6)', fontStyle: 'italic' }}>
                                    always here
                                </Typography>
                            </Box>
                        }
                        secondary={
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Strategy, accountability, mindset — ask me anything
                            </Typography>
                        }
                    />
                </ListItem>
                <Divider component="li" />

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
                                        <Avatar>
                                            {conv.otherUserName.charAt(0)}
                                        </Avatar>
                                    </Badge>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="h6" component="span" sx={{ color: 'primary.main' }}>
                                                    {conv.otherUserName}
                                                </Typography>
                                                {mutualStreaks[conv.otherUserId] ? (
                                                    <Tooltip title={`You and ${conv.otherUserName} have both checked in for ${mutualStreaks[conv.otherUserId]} days in a row`}>
                                                        <Chip
                                                            icon={<LocalFireDepartmentIcon sx={{ fontSize: '13px !important', color: '#F97316 !important' }} />}
                                                            label={`${mutualStreaks[conv.otherUserId]}d mutual`}
                                                            size="small"
                                                            sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(249,115,22,0.1)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)', fontWeight: 700 }}
                                                        />
                                                    </Tooltip>
                                                ) : null}
                                            </Box>
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