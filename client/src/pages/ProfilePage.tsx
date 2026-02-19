import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import { supabase } from '../lib/supabase';
import {
    Container,
    Box,
    Typography,
    Avatar,
    Button,
    Paper,
    Stack,
    CircularProgress,
    Alert,
    TextField,
    Chip,
    Card,
    CardContent,
    CardActions
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import toast from 'react-hot-toast';

interface Profile {
    name: string;
    age: number;
    bio: string;
    avatar_url: string;
    onboarding_completed: boolean;
}

const ProfilePage: React.FC = () => {
    const { user, loading: authLoading } = useUser();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Editable state
    const [editedName, setEditedName] = useState('');
    const [editedBio, setEditedBio] = useState('');
    const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
    const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null);


    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error) throw error;

                setProfile(data);
                setEditedName(data.name || '');
                setEditedBio(data.bio || '');
                setProfilePhotoPreviewUrl(data.avatar_url);

            } catch (err: any) {
                setError(err.message);
                toast.error(`Failed to fetch profile: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading) {
            fetchProfile();
        }
    }, [user, authLoading]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedAvatarFile(file);
            setProfilePhotoPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!user) return;
        
        const promise = async () => {
            setLoading(true);
            let avatarUrl = profile?.avatar_url;
            if (selectedAvatarFile) {
                const fileExt = selectedAvatarFile.name.split('.').pop();
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, selectedAvatarFile, {
                        cacheControl: '3600',
                        upsert: true,
                    });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(uploadData.path);
                avatarUrl = publicUrlData.publicUrl;
            }

            const { data, error: updateError } = await supabase
                .from('profiles')
                .update({
                    name: editedName,
                    bio: editedBio,
                    avatar_url: avatarUrl,
                })
                .eq('id', user.id)
                .select()
                .single();

            if (updateError) throw updateError;
            
            setProfile(data);
            setIsEditing(false);
            setLoading(false);
        }

        toast.promise(promise(), {
            loading: 'Saving profile...',
            success: 'Profile saved!',
            error: (err) => `Error: ${err.message}`,
        });
    };

    const handleCancel = () => {
        if(profile) {
            setEditedName(profile.name);
            setEditedBio(profile.bio);
            setProfilePhotoPreviewUrl(profile.avatar_url);
            setSelectedAvatarFile(null);
        }
        setIsEditing(false);
    };

    if (loading || authLoading) {
        return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Container>;
    }

    if (error && !toast) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
    }

    if (!profile) {
        return <Container sx={{ mt: 4 }}><Alert severity="info">Profile not found.</Alert></Container>;
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4 }}>
            <Paper elevation={3} sx={{ p: 4 }}>
                <Stack direction="row" spacing={4} alignItems="center">
                    <Box>
                        <Avatar
                            src={profilePhotoPreviewUrl || undefined}
                            sx={{ width: 120, height: 120, mb: 2, cursor: isEditing ? 'pointer' : 'default' }}
                            onClick={() => isEditing && document.getElementById('avatar-upload-button')?.click()}
                        />
                        {isEditing && (
                            <input
                                accept="image/*"
                                style={{ display: 'none' }}
                                id="avatar-upload-button"
                                type="file"
                                onChange={handleFileChange}
                            />
                        )}
                    </Box>
                    <Box flexGrow={1}>
                        {isEditing ? (
                            <Stack spacing={2}>
                                <TextField
                                    label="Name"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    fullWidth
                                />
                                <TextField
                                    label="Bio"
                                    value={editedBio}
                                    onChange={(e) => setEditedBio(e.target.value)}
                                    multiline
                                    rows={4}
                                    fullWidth
                                />
                            </Stack>
                        ) : (
                            <>
                                <Typography variant="h4" component="h1" gutterBottom>
                                    {profile.name}
                                </Typography>
                                <Typography variant="body1" color="text.secondary">
                                    {profile.bio}
                                </Typography>
                            </>
                        )}
                    </Box>
                </Stack>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
                    {profile.onboarding_completed && (
                        <Chip
                            icon={<CheckCircleIcon />}
                            label="Onboarding Complete!"
                            color="success"
                            variant="outlined"
                        />
                    )}

                    {isEditing ? (
                        <Stack direction="row" spacing={2}>
                            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>Save</Button>
                            <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleCancel}>Cancel</Button>
                        </Stack>
                    ) : (
                        <Button variant="contained" startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>
                            Edit Profile
                        </Button>
                    )}
                </Box>
            </Paper>

            <Card sx={{ mt: 4 }}>
                <CardContent>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Your Goal Tree
                    </Typography>
                    <Typography color="text.secondary">
                        Your hierarchical goal structure is coming soon. This is where you'll be able to visualize and manage your goals.
                    </Typography>
                </CardContent>
                <CardActions>
                    <Button size="small" onClick={() => navigate('/goal-tree')}>View Goal Tree</Button>
                </CardActions>
            </Card>
        </Container>
    );
};

export default ProfilePage;
