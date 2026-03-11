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
    Accordion,
    AccordionSummary,
    AccordionDetails,
    CircularProgress,
    Stack,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ForumIcon from '@mui/icons-material/Forum';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonIcon from '@mui/icons-material/Person';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { useUser } from '../../hooks/useUser';
import GlassCard from '../../components/common/GlassCard';

function checkinDotColor(lastCheckinDate?: string | null): string {
    if (!lastCheckinDate) return '#4B5563';
    const today = new Date().toISOString().slice(0, 10);
    const last = lastCheckinDate.slice(0, 10);
    if (last === today) return '#10B981';
    const diffDays = Math.round((Date.parse(today) - Date.parse(last)) / 86400000);
    if (diffDays <= 2) return '#F59E0B';
    return '#4B5563';
}

function checkinDotTitle(lastCheckinDate?: string | null): string {
    if (!lastCheckinDate) return 'No check-ins yet';
    const today = new Date().toISOString().slice(0, 10);
    const last = lastCheckinDate.slice(0, 10);
    if (last === today) return 'Checked in today';
    const diffDays = Math.round((Date.parse(today) - Date.parse(last)) / 86400000);
    if (diffDays === 1) return 'Missed today — checked in yesterday';
    return `Last checked in ${diffDays}d ago`;
}

interface ConversationSummary {
    id: string; // userId for DM, roomId for Group
    type: 'dm' | 'group';
    name: string;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    lastCheckinDate?: string | null; // DM only
    currentStreak?: number; // DM only
    avatarUrl?: string;
    timestamp?: number;
}

const ChatPage: React.FC = () => {
    const { user: currentUser, loading: currentUserLoading } = useUser();
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [mutualStreaks, setMutualStreaks] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser || currentUserLoading) return;
            setLoading(true);
            try {
                // 1. Fetch DM Messages
                const { data: dmMessages, error: dmError } = await supabase
                    .from('messages')
                    .select('*')
                    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
                    .is('room_id', null)
                    .order('timestamp', { ascending: false });

                if (dmError) throw dmError;

                // 2. Fetch Joined Groups
                const { data: joinedRooms, error: roomError } = await supabase
                    .from('chat_room_members')
                    .select('room_id, chat_rooms(*)')
                    .eq('user_id', currentUser.id);

                if (roomError) throw roomError;

                // 3. Fetch Latest Message for each Group
                const roomIds = joinedRooms?.map(r => r.room_id) || [];
                const { data: groupMessages, error: groupMsgError } = await supabase
                    .from('messages')
                    .select('*')
                    .in('room_id', roomIds)
                    .order('timestamp', { ascending: false });

                if (groupMsgError) throw groupMsgError;

                // Process DMs
                const latestDMByUser = new Map<string, any>();
                for (const msg of dmMessages || []) {
                    const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
                    if (otherId && !latestDMByUser.has(otherId)) {
                        latestDMByUser.set(otherId, msg);
                    }
                }

                // Process Groups
                const latestMsgByRoom = new Map<string, any>();
                for (const msg of groupMessages || []) {
                    if (msg.room_id && !latestMsgByRoom.has(msg.room_id)) {
                        latestMsgByRoom.set(msg.room_id, msg);
                    }
                }

                // Fetch Profile details for DMs
                const otherUserIds = Array.from(latestDMByUser.keys());
                let profileMap = new Map<string, any>();
                if (otherUserIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, name, avatar_url, current_streak, last_activity_date')
                        .in('id', otherUserIds);
                    profiles?.forEach(p => profileMap.set(p.id, p));
                }

                const convList: ConversationSummary[] = [];

                // Add DMs to list
                for (const [userId, msg] of Array.from(latestDMByUser)) {
                    const p = profileMap.get(userId);
                    const ts = Date.parse(msg.timestamp || msg.created_at);
                    convList.push({
                        id: userId,
                        type: 'dm',
                        name: p?.name || 'Unknown User',
                        lastMessage: msg.content,
                        lastMessageTime: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        timestamp: ts,
                        unreadCount: 0,
                        lastCheckinDate: p?.last_activity_date,
                        currentStreak: p?.current_streak,
                        avatarUrl: p?.avatar_url
                    });
                }

                // Add Groups to list
                for (const j of joinedRooms || []) {
                    const room = j.chat_rooms as any;
                    if (!room) continue;
                    const msg = latestMsgByRoom.get(room.id);
                    const ts = msg ? Date.parse(msg.timestamp || msg.created_at) : 0;
                    convList.push({
                        id: room.id,
                        type: 'group',
                        name: room.name,
                        lastMessage: msg ? msg.content : 'No messages yet',
                        lastMessageTime: msg ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                        timestamp: ts,
                        unreadCount: 0,
                    });
                }

                setConversations(convList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));

            } catch (err: any) {
                console.error('Error fetching chat data:', err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [currentUser, currentUserLoading]);

    // Fetch mutual streaks for DM conversation partners
    useEffect(() => {
        const dmConvs = conversations.filter(c => c.type === 'dm');
        if (dmConvs.length === 0 || !currentUser) return;
        (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
                const results = await Promise.allSettled(
                    dmConvs.map(conv =>
                        axios.get(`${API_URL}/checkins/mutual`, { params: { partnerId: conv.id }, headers })
                            .then(r => ({ id: conv.id, streak: r.data.mutualStreak as number }))
                    )
                );
                const map: Record<string, number> = {};
                for (const r of results) {
                    if (r.status === 'fulfilled' && r.value.streak > 0) {
                        map[r.value.id] = r.value.streak;
                    }
                }
                setMutualStreaks(map);
            } catch { /* ignore */ }
        })();
    }, [conversations, currentUser]);

    if (currentUserLoading || loading) {
        return (
            <Container component="main" maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">Loading your messages...</Typography>
            </Container>
        );
    }

    const dmConversations = conversations.filter(c => c.type === 'dm');
    const groupConversations = conversations.filter(c => c.type === 'group');

    const renderConversationItem = (conv: ConversationSummary) => {
        const isDM = conv.type === 'dm';
        const linkTo = isDM ? `/chat/${currentUser?.id}/${conv.id}` : `/groups/${conv.id}`;
        
        return (
            <ListItem
                key={`${conv.type}-${conv.id}`}
                component={RouterLink}
                to={linkTo}
                sx={{ py: 2, textDecoration: 'none', color: 'inherit', '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}
            >
                <ListItemAvatar>
                    <Badge
                        badgeContent={conv.unreadCount}
                        color="error"
                        overlap="circular"
                        invisible={conv.unreadCount === 0}
                    >
                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                            {isDM ? (
                                <Tooltip title={checkinDotTitle(conv.lastCheckinDate)} placement="right">
                                    <Box sx={{ position: 'relative' }}>
                                        <Avatar src={conv.avatarUrl}>
                                            {conv.name.charAt(0)}
                                        </Avatar>
                                        <Box sx={{
                                            position: 'absolute', bottom: 1, right: 1,
                                            width: 10, height: 10, borderRadius: '50%',
                                            bgcolor: checkinDotColor(conv.lastCheckinDate),
                                            border: '2px solid #111827',
                                            boxShadow: `0 0 4px ${checkinDotColor(conv.lastCheckinDate)}`,
                                        }} />
                                    </Box>
                                </Tooltip>
                            ) : (
                                <Avatar sx={{ bgcolor: 'rgba(139,92,246,0.1)', color: 'primary.main' }}>
                                    <ForumIcon fontSize="small" />
                                </Avatar>
                            )}
                        </Box>
                    </Badge>
                </ListItemAvatar>
                <ListItemText
                    primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 700 }}>
                                    {conv.name}
                                </Typography>
                                {isDM && mutualStreaks[conv.id] && (
                                    <Chip
                                        icon={<LocalFireDepartmentIcon sx={{ fontSize: '12px !important', color: '#F97316 !important' }} />}
                                        label={`${mutualStreaks[conv.id]}d`}
                                        size="small"
                                        sx={{ height: 18, fontSize: '0.6rem', bgcolor: 'rgba(249,115,22,0.1)', color: '#F97316', border: '1px solid rgba(249,115,22,0.2)', fontWeight: 800 }}
                                    />
                                )}
                            </Box>
                            <Typography variant="caption" color="text.disabled">
                                {conv.lastMessageTime}
                            </Typography>
                        </Box>
                    }
                    secondary={
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '90%', fontSize: '0.8rem' }}>
                            {conv.lastMessage}
                        </Typography>
                    }
                />
            </ListItem>
        );
    };

    return (
        <Container component="main" maxWidth="md" sx={{ mt: 4, pb: 10 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: '-0.02em', mb: 3 }}>
                Messages
            </Typography>

            {/* Axiom pinned always */}
            <GlassCard sx={{ mb: 3, border: '1px solid rgba(245,158,11,0.2)' }}>
                <ListItem
                    component={RouterLink}
                    to="/coaching"
                    sx={{
                        py: 2, textDecoration: 'none', color: 'inherit',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.05) 0%, rgba(139,92,246,0.03) 100%)',
                    }}
                >
                    <ListItemAvatar>
                        <Avatar sx={{
                            background: 'linear-gradient(135deg, #78350F 0%, #92400E 100%)',
                            border: '2px solid rgba(245,158,11,0.4)',
                            width: 48, height: 48,
                        }}>🥋</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                        primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="h6" sx={{ color: '#F59E0B', fontWeight: 800 }}>Axiom</Typography>
                                <Chip label="AI COACH" size="small" sx={{ height: 16, fontSize: '0.55rem', fontWeight: 900, bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }} />
                            </Box>
                        }
                        secondary="Strategy, accountability, and your daily protocol."
                    />
                </ListItem>
            </GlassCard>

            <Stack spacing={2}>
                <Accordion defaultExpanded sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 1, minHeight: 48 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <PersonIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                            <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: '0.1em', color: 'text.disabled' }}>
                                Direct Messages ({dmConversations.length})
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                        <List disablePadding>
                            {dmConversations.length > 0 ? dmConversations.map(renderConversationItem) : (
                                <Typography variant="body2" color="text.disabled" sx={{ p: 2, textAlign: 'center' }}>No direct messages yet.</Typography>
                            )}
                        </List>
                    </AccordionDetails>
                </Accordion>

                <Accordion defaultExpanded sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 1, minHeight: 48 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <ForumIcon sx={{ color: '#8B5CF6', fontSize: 20 }} />
                            <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: '0.1em', color: 'text.disabled' }}>
                                Community Boards ({groupConversations.length})
                            </Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                        <List disablePadding>
                            {groupConversations.length > 0 ? groupConversations.map(renderConversationItem) : (
                                <Typography variant="body2" color="text.disabled" sx={{ p: 2, textAlign: 'center' }}>You haven't joined any groups yet.</Typography>
                            )}
                        </List>
                    </AccordionDetails>
                </Accordion>
            </Stack>
        </Container>
    );
};

export default ChatPage;
