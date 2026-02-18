import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../hooks/useUser';
import { supabase } from '../lib/supabase';
import { User } from '../models/User'; // Ensure User model is comprehensive
import { GoalTree } from '../models/GoalTree'; // Not directly used in render, but might be for data fetching.
import { GoalNode } from '../models/GoalNode'; // Not directly used in render, but might be for data fetching.

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
import EditIcon from '@mui/icons-material/Edit'; // Icon for editing
import SaveIcon from '@mui/icons-material/Save'; // Icon for saving
import CancelIcon from '@mui/icons-material/Cancel'; // Icon for canceling

/**
 * @description Profile page component displaying user information and allowing them to edit it.
 * It fetches profile data from the backend and handles updates, including avatar uploads to Supabase Storage.
 */
const ProfilePage: React.FC = () => {
    const theme = useTheme(); // Access the Material-UI theme for styling
    // Get the authenticated user and their loading state from the custom hook
    const { user: authUser, loading: authUserLoading } = useUser();
    const navigate = useNavigate(); // Hook for programmatic navigation
    // Get the profile user ID from the URL parameters
    const { id: profileUserIdParam } = useParams<{ id: string }>();

    const [profileUser, setProfileUser] = useState<User | null>(null); // State for the user whose profile is being viewed/edited
    const [loadingProfile, setLoadingProfile] = useState(true); // State to manage profile data loading
    const [error, setError] = useState<string | null>(null); // State to store error messages
    const [isEditing, setIsEditing] = useState(false); // State to control edit mode

    // States for editable fields
    const [editedName, setEditedName] = useState('');
    const [editedAge, setEditedAge] = useState<number | ''>(''); // Can be number or empty string
    const [editedBio, setEditedBio] = useState('');
    // State for the selected avatar file for upload
    const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);

    // Determine if the currently logged-in user is viewing their own profile
    const isOwnProfile = authUser?.id === profileUserIdParam || (!profileUserIdParam && authUser);

    // Effect to fetch the profile data when the component mounts or dependencies change
    useEffect(() => {
        const fetchProfileData = async () => {
            setLoadingProfile(true); // Start loading profile data
            setError(null); // Clear previous errors
            // Determine which user's ID to fetch: URL param or authenticated user's ID
            const userIdToFetch = profileUserIdParam || authUser?.id;

            if (!userIdToFetch) {
                setError('User ID not found for profile.');
                setLoadingProfile(false);
                return;
            }

            try {
                // Fetch user details from the backend API
                const userResponse = await axios.get(`http://localhost:3001/users/${userIdToFetch}`);
                const fetchedUser: User = userResponse.data;
                setProfileUser(fetchedUser); // Set the fetched profile user

                // Initialize editable states with fetched data
                setEditedName(fetchedUser.name);
                setEditedAge(fetchedUser.age);
                setEditedBio(fetchedUser.bio);
                setSelectedAvatarFile(null); // Ensure no old file is selected
            } catch (err) {
                console.error('Failed to fetch profile data:', err);
                setError('Failed to load profile.');
            } finally {
                setLoadingProfile(false); // End loading
            }
        };

        // Fetch data only after the authenticated user status is known
        if (!authUserLoading) {
            fetchProfileData();
        }
    }, [profileUserIdParam, authUser?.id, authUserLoading]); // Dependencies for re-fetching

    /**
     * @description Handles file selection for avatar upload.
     * Stores the selected file in state.
     */
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
        setSelectedAvatarFile(event.target.files[0]);
      }
    };

    /**
     * @description Handles saving the updated profile details.
     * Uploads new avatar to Supabase Storage if selected, then updates profile in backend.
     */
    const handleSaveProfile = async () => {
        if (!profileUser) return; // Prevent saving if no profile user is loaded
        setLoadingProfile(true); // Indicate saving process
        try {
            let newAvatarUrl = profileUser.avatarUrl; // Start with existing avatar URL

            // If a new avatar file is selected, upload it to Supabase Storage
            if (selectedAvatarFile) {
                const fileExt = selectedAvatarFile.name.split('.').pop();
                // Generate a unique file name to avoid collisions
                const fileName = `${profileUser.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `avatars/${fileName}`; // Path within the Supabase storage bucket

                // Upload the file
                const { data, error: uploadError } = await supabase.storage
                    .from('avatars') // Specify the storage bucket
                    .upload(filePath, selectedAvatarFile, {
                        cacheControl: '3600', // Cache for one hour
                        upsert: true, // Overwrite if a file with the same path exists
                    });

                if (uploadError) {
                    throw uploadError; // Propagate upload errors
                }

                // Get the public URL of the uploaded file
                const { data: publicUrlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                newAvatarUrl = publicUrlData.publicUrl; // Use the new public URL
            }

            // Construct the updated profile object
            const updatedProfile: User = {
                ...profileUser, // Keep existing profile data
                name: editedName,
                age: typeof editedAge === 'number' ? editedAge : (editedAge === '' ? 0 : parseInt(editedAge)),
                bio: editedBio,
                avatarUrl: newAvatarUrl, // Use the new (or existing) avatar URL
            };

            // Send the updated profile data to the backend API
            await axios.put(`http://localhost:3001/users/${profileUser.id}`, updatedProfile);
            setProfileUser(updatedProfile); // Update local state with new data
            setIsEditing(false); // Exit editing mode
        } catch (err: any) {
            console.error('Failed to save profile:', err.message);
            setError('Failed to save profile: ' + err.message);
        } finally {
            setLoadingProfile(false); // End saving
        }
    };

    /**
     * @description Handles canceling the edit operation.
     * Reverts editable fields to original profile values and exits edit mode.
     */
    const handleCancelEdit = () => {
        // Revert to original profile values
        if (profileUser) {
            setEditedName(profileUser.name);
            setEditedAge(profileUser.age);
            setEditedBio(profileUser.bio);
            setSelectedAvatarFile(null); // Clear any selected file
        }
        setIsEditing(false); // Exit editing mode
    };

    // Display loading state while auth or profile data is being fetched
    if (authUserLoading || loadingProfile) {
        return (
            <Container component="main" maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    // Display error message if fetching failed
    if (error) {
        return (
            <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    // Display message if no profile was found
    if (!profileUser) {
        return (
            <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="info">No profile found for this user.</Alert>
            </Container>
        );
    }

    // Render the profile UI
    return (
        <Container component="main" maxWidth="md" sx={{ mt: 4 }}>
            <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                {/* User Avatar */}
                <Avatar
                    alt={profileUser.name}
                    // Display selected file preview or existing avatar URL
                    src={selectedAvatarFile ? URL.createObjectURL(selectedAvatarFile) : (profileUser.avatarUrl || undefined)}
                    sx={{ width: 120, height: 120, bgcolor: theme.palette.action.active, mb: 2 }}
                >
                    {/* Fallback to first letter of name if no avatar */}
                    {profileUser.name.charAt(0)}
                </Avatar>

                {isEditing ? (
                    // Render editable fields when in editing mode
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
                        {/* Hidden file input for avatar upload */}
                        <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="avatar-upload-button"
                            type="file"
                            onChange={handleFileChange}
                        />
                        {/* Label acts as a button to trigger the hidden file input */}
                        <label htmlFor="avatar-upload-button">
                            <Button variant="outlined" component="span" startIcon={<EditIcon />}>
                                {selectedAvatarFile ? selectedAvatarFile.name : 'Change Avatar'}
                            </Button>
                        </label>
                        {/* Action buttons for saving or canceling edits */}
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
                    // Render static profile display when not in editing mode
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

                        {/* Edit Profile button, only visible if it's the user's own profile */}
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
                {/* Button to navigate to the user's Goal Tree page */}
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