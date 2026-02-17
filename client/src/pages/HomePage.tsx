import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Container,
    Typography,
    Paper,
    List,
    ListItem,
    ListItemText,
    Link,
    Box
} from '@mui/material';

const HomePage: React.FC = () => {
    // A real implementation would fetch user data to get the ID
    const userId = '1'; // Hardcoded for now

    return (
        <Container component="main" maxWidth="md">
            <Box sx={{ my: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Welcome to Praxis
                </Typography>
                <Typography variant="body1" paragraph>
                    This is your home page. It is currently under construction.
                </Typography>
                <Paper elevation={3} sx={{ mt: 4 }}>
                    <List component="nav" aria-label="main navigation">
                        <ListItem component={RouterLink} to={`/profile/${userId}`}>
                            <ListItemText primary="View My Profile" />
                        </ListItem>
                        <ListItem component={RouterLink} to={`/goals/${userId}`}>
                            <ListItemText primary="View My Goal Tree" />
                        </ListItem>
                        <ListItem component={RouterLink} to="/matches">
                            <ListItemText primary="Find Matches" />
                        </ListItem>
                        <ListItem component={RouterLink} to="/onboarding">
                            <ListItemText primary="Go to Onboarding" />
                        </ListItem>
                    </List>
                </Paper>
            </Box>
        </Container>
    );
};

export default HomePage;
