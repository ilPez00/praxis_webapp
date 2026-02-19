import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import { supabase } from '../lib/supabase';
import { AppBar, Toolbar, Typography, Button, Box, Link } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const Navbar: React.FC = () => {
    const { user } = useUser();
    const navigate = useNavigate();
    const theme = useTheme();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    return (
        <AppBar position="static">
            <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    <Link
                        component={RouterLink}
                        to="/"
                        color="inherit"
                        sx={{ textDecoration: 'none' }}
                    >
                        P<Box component="span" sx={{ color: theme.palette.action.active }}>R</Box>AXIS
                    </Link>
                </Typography>
                <Box>
                    {user ? (
                        <>
                            <Button color="inherit" component={RouterLink} to="/dashboard">
                                Dashboard
                            </Button>
                            <Button color="inherit" component={RouterLink} to={`/profile/${user.id}`}>
                                Profile
                            </Button>
                            <Button color="inherit" onClick={handleLogout}>
                                Logout
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button color="inherit" component={RouterLink} to="/login">
                                Login
                            </Button>
                            <Button
                                variant="contained"
                                sx={{
                                    ml: 2,
                                    backgroundColor: theme.palette.action.active,
                                    '&:hover': {
                                        backgroundColor: theme.palette.primary.dark,
                                    },
                                }}
                                component={RouterLink}
                                to="/signup"
                            >
                                Sign Up
                            </Button>
                        </>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;
