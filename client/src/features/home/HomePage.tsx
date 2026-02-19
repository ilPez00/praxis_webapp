import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Container, Box, Typography, Button, useTheme } from '@mui/material';

const HomePage: React.FC = () => {
    const theme = useTheme();

    return (
        <Container component="main" maxWidth="md" sx={{ textAlign: 'center', mt: 8 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 'calc(100vh - 64px)', // Adjust for Navbar height
                }}
            >
                <Typography component="h1" variant="h3" gutterBottom sx={{ color: 'primary.main' }}>
                    Stop Swiping. Start{' '}
                    <Box component="span" sx={{ color: theme.palette.action.active }}>
                        Achieving
                    </Box>
                    .
                </Typography>
                <Typography variant="h6" component="p" sx={{ mb: 4, color: 'text.secondary' }}>
                    Praxis is a goal-aligned social operating system. We connect you with driven individuals who share your ambitions, so you can build real-world connections while making measurable progress.
                </Typography>
                <Button
                    variant="contained"
                    size="large"
                    component={RouterLink}
                    to="/signup"
                    sx={{
                        backgroundColor: theme.palette.action.active,
                        '&:hover': {
                            backgroundColor: theme.palette.primary.dark,
                        },
                    }}
                >
                    Find Your Praxis
                </Button>
            </Box>
        </Container>
    );
};

export default HomePage;

