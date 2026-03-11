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
import ForumIcon from '@mui/icons-material/Forum';

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
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { useUser } from '../../hooks/useUser';

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
                    convList.push({
                        id: userId,
                        type: 'dm',
                        name: p?.name || 'Unknown User',
                        lastMessage: msg.content,
                        lastMessageTime: new Date(msg.timestamp || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        unreadCount: 0,
                        lastCheckinDate: p?.last_activity_date,
                        currentStreak: p?.current_streak,
                        avatarUrl: p?.avatar_url
                    });
                }

                // Add Groups to list
                for (const j of joinedRooms || []) {
                    const room = j.chat_rooms;
                    if (!room) continue;
                    const msg = latestMsgByRoom.get(room.id);
                    convList.push({
                        id: room.id,
                        type: 'group',
                        name: room.name,
                        lastMessage: msg ? msg.content : 'No messages yet',
                        lastMessageTime: msg ? new Date(msg.timestamp || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                        unreadCount: 0,
                    });
                }

                // Sort entire list by recency (if we have time info)
                // For simplicity now, just set it
                setConversations(convList);

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
                {/* Axiom — pinned at top */}
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
                                        Axiom
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
                    conversations.map((conv, index) => {
                        const isDM = conv.type === 'dm';
                        const linkTo = isDM ? `/chat/${currentUser?.id}/${conv.id}` : `/groups/${conv.id}`;

                        return (
                            <React.Fragment key={`${conv.type}-${conv.id}`}>
                                <ListItem
                                    component={RouterLink}
                                    to={linkTo}
                                    sx={{ py: 2, textDecoration: 'none', color: 'inherit' }}
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
                                                    <Typography variant="h6" component="span" sx={{ color: isDM ? 'primary.main' : '#A78BFA', fontWeight: isDM ? 600 : 700 }}>
                                                        {conv.name}
                                                    </Typography>
                                                    {isDM && mutualStreaks[conv.id] && (
                                                        <Tooltip title={`You and ${conv.name} have both checked in for ${mutualStreaks[conv.id]} days in a row`}>
                                                            <Chip
                                                                icon={<LocalFireDepartmentIcon sx={{ fontSize: '13px !important', color: '#F97316 !important' }} />}
                                                                label={`${mutualStreaks[conv.id]}d mutual`}
                                                                size="small"
                                                                sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(249,115,22,0.1)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)', fontWeight: 700 }}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    {!isDM && (
                                                        <Chip label="Group" size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(167,139,250,0.1)', color: '#A78BFA', fontWeight: 700 }} />
                                                    )}
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
                        );
                    })
                ) : (
                    <ListItem>
                        <ListItemText>
                            <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                No conversations yet — find matches or join events to start chatting!
                            </Typography>
                        </ListItemText>
                    </ListItem>
                )}
            </List>
        </Container>
    );
};

export default ChatPage;