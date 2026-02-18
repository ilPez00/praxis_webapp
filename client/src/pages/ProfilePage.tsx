import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../hooks/useUser';
import { supabase } from '../lib/supabase';
import { User } from '../models/User'; // Ensure User model is comprehensive
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode'; // Needed for goal tree structure, even if not displayed here

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
    useTheme,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

const ProfilePage: React.FC = () => {
    const theme = useTheme();
    const { user: authUser, loading: authUserLoading } = useUser();
    const navigate = useNavigate();
    const { id: profileUserIdParam } = useParams<{ id: string }>();

    const [profileUser, setProfileUser] = useState<User | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Editable state
    const [editedName, setEditedName] = useState('');
    const [editedAge, setEditedAge] = useState<number | ''>('');
    const [editedBio, setEditedBio] = useState('');
    const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null); // New state for selected file

    const isOwnProfile = authUser?.id === profileUserIdParam || (!profileUserIdParam && authUser); // if no param, assume own profile

    useEffect(() => {
        const fetchProfileData = async () => {
            setLoadingProfile(true);
            setError(null);
            const userIdToFetch = profileUserIdParam || authUser?.id;

            if (!userIdToFetch) {
                setError('User ID not found for profile.');
                setLoadingProfile(false);
                return;
            }

            try {
                // Fetch user details from backend
                const userResponse = await axios.get(`http://localhost:3001/users/${userIdToFetch}`);
                const fetchedUser: User = userResponse.data;
                setProfileUser(fetchedUser);

                // Initialize editable fields
                setEditedName(fetchedUser.name);
                setEditedAge(fetchedUser.age);
                setEditedBio(fetchedUser.bio);
                // No need to set editedAvatarUrl from fetchedUser, as we'll handle file upload
                setSelectedAvatarFile(null); // Clear any previously selected file

            } catch (err) {
                console.error('Failed to fetch profile data:', err);
                setError('Failed to load profile.');
            } finally {
                setLoadingProfile(false);
            }
        };

        if (!authUserLoading) { // Only fetch once authUser is loaded
            fetchProfileData();
        }
    }, [profileUserIdParam, authUser?.id, authUserLoading]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
        setSelectedAvatarFile(event.target.files[0]);
      }
    };

    const handleSaveProfile = async () => {
        if (!profileUser) return;
        setLoadingProfile(true); // Indicate saving
        try {
            let newAvatarUrl = profileUser.avatarUrl;

            // Upload new avatar if a file is selected
            if (selectedAvatarFile) {
                const fileExt = selectedAvatarFile.name.split('.').pop();
                const fileName = `${profileUser.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `avatars/${fileName}`;

                const { data, error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, selectedAvatarFile, {
                        cacheControl: '3600',
                        upsert: true,
                    });

                if (uploadError) {
                    throw uploadError;
                }

                // Get public URL
                const { data: publicUrlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);
                
                newAvatarUrl = publicUrlData.publicUrl;
            }

            const updatedProfile: User = { // Explicitly type updatedProfile
                ...profileUser,
                name: editedName,
                // Ensure age is always a number; convert empty string to 0 or handle as null if model allows
                age: typeof editedAge === 'number' ? editedAge : (editedAge === '' ? 0 : parseInt(editedAge)),
                bio: editedBio,
                avatarUrl: newAvatarUrl, // Use the new avatar URL
            };

            await axios.put(`http://localhost:3001/users/${profileUser.id}`, updatedProfile);
            setProfileUser(updatedProfile); // Update local state with new data
            setIsEditing(false); // Exit editing mode
        } catch (err: any) {
            console.error('Failed to save profile:', err.message);
            setError('Failed to save profile: ' + err.message);
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleCancelEdit = () => {
        // Revert changes
        if (profileUser) {
            setEditedName(profileUser.name);
            setEditedAge(profileUser.age);
            setEditedBio(profileUser.bio);
            setSelectedAvatarFile(null); // Clear selected file
        }
        setIsEditing(false);
    };

    if (authUserLoading || loadingProfile) {
        return (
            <Container component="main" maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    if (error) {
        return (
            <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    if (!profileUser) {
        return (
            <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="info">No profile found for this user.</Alert>
            </Container>
        );
    }

    return (
        <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
            <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <Avatar
                    alt={profileUser.name}
                    src={selectedAvatarFile ? URL.createObjectURL(selectedAvatarFile) : (profileUser.avatarUrl || undefined)}
                    sx={{ width: 120, height: 120, bgcolor: theme.palette.action.active, mb: 2 }}
                >
                    {profileUser.name.charAt(0)}
                </Avatar>

                {isEditing ? (
                    <>
                        <TextField
                            label="Name"
                            variant="outlined"
                            fullWidth
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                        />
                        <TextField
                            label="Age"
                            variant="outlined"
                            fullWidth
                            type="number"
                            value={editedAge}
                            onChange={(e) => setEditedAge(parseInt(e.target.value) || '')}
                        />
                        <TextField
                            label="Bio"
                            variant="outlined"
                            fullWidth
                            multiline
                            rows={4}
                            value={editedBio}
                            onChange={(e) => setEditedBio(e.target.value)}
                        />
                        <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="avatar-upload-button"
                            type="file"
                            onChange={handleFileChange}
                        />
                        <label htmlFor="avatar-upload-button">
                            <Button variant="outlined" component="span" startIcon={<EditIcon />}>
                                {selectedAvatarFile ? selectedAvatarFile.name : 'Change Avatar'}
                            </Button>
                        </label>
                        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                            <Button
                                variant="contained"
                                startIcon={<SaveIcon />}
                                onClick={handleSaveProfile}
                                color="primary"
                            >
                                Save
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<CancelIcon />}
                                onClick={handleCancelEdit}
                                color="secondary"
                            >
                                Cancel
                            </Button>
                        </Stack>
                    </>
                ) : (
                    <>
                        <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'primary.main' }}>
                            {profileUser.name}
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                            @{profileUser.name.toLowerCase().replace(/\s/g, '_')}
                        </Typography> {/* Dynamically generate username from name */}
                        <Typography variant="body1" sx={{ mt: 1 }}>
                            Age: {profileUser.age}
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 1, textAlign: 'center' }}>
                            {profileUser.bio}
                        </Typography>

                        {isOwnProfile && (
                            <Button
                                variant="contained"
                                startIcon={<EditIcon />}
                                onClick={() => setIsEditing(true)}
                                sx={{ mt: 3, bgcolor: theme.palette.action.active }}
                            >
                                Edit Profile
                            </Button>
                        )}
                    </>
                )}
                {/* Link to Goal Tree Page */}
                <Button
                    variant="outlined"
                    sx={{ mt: 3 }}
                    onClick={() => navigate(`/goals/${profileUser.id}`)}
                >
                    View / Edit Goal Tree
                </Button>
            </Paper>
        </Container>
    );
};

export default ProfilePage;