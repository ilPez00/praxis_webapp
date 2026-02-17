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

const LoginForm: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:3001/auth/login', {
                email,
                password,
            });
            setMessage(response.data.message);
            // In a real app, save the token and user ID to local storage or context
            const userId = response.data.user.id; // Assuming the backend sends back user ID
            localStorage.setItem('userId', userId); // Store user ID
            navigate(`/profile/${userId}`); // Redirect to user's profile
        } catch (error: any) {
            setMessage(error.response?.data?.message || 'Login failed.');
        }
    };

    const handleGoogleLogin = async () => {
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
                    Login
                </Typography>
                {message && (
                    <Typography color="error" sx={{ mt: 1 }}>
                        {message}
                    </Typography>
                )}
                <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
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
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2 }}
                    >
                        Login
                    </Button>
                    <Stack spacing={2}>
                        <Button
                            type="button"
                            fullWidth
                            variant="outlined"
                            onClick={handleGoogleLogin}
                        >
                            Login with Google
                        </Button>
                        <Link href="/signup" variant="body2">
                            Don't have an account? Signup here
                        </Link>
                    </Stack>
                </Box>
            </Box>
        </Container>
    );
};

export default LoginForm;