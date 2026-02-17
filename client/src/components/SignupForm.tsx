import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    Stack,
    Link
} from '@mui/material';

const SignupForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [bio, setBio] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:3001/auth/signup', {
                email,
                password,
                name,
                age: parseInt(age),
                bio,
            });
            setMessage(response.data.message);
            navigate('/login'); // Redirect to login after successful signup
        } catch (error: any) {
            setMessage(error.response?.data?.message || 'Signup failed.');
        }
    };

    const handleGoogleSignup = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) {
            setMessage(error.message);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Typography component="h1" variant="h5">
                    Sign up
                </Typography>
                {message && (
                    <Typography color="error" sx={{ mt: 1 }}>
                        {message}
                    </Typography>
                )}
                <Box component="form" onSubmit={handleSignup} noValidate sx={{ mt: 1 }}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Email Address"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="name"
                        label="Name"
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="age"
                        label="Age"
                        name="age"
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="bio"
                        label="Bio"
                        name="bio"
                        multiline
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                    >
                        Sign Up
                    </Button>
                    <Stack spacing={2}>
                        <Button
                            type="button"
                            fullWidth
                            variant="outlined"
                            onClick={handleGoogleSignup}
                        >
                            Sign up with Google
                        </Button>
                        <Link href="/login" variant="body2">
                            Already have an account? Login here
                        </Link>
                    </Stack>
                </Box>
            </Box>
        </Container>
    );
};

export default SignupForm;