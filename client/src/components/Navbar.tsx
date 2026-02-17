import React from 'react';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const Navbar: React.FC = () => {
    // A real implementation would fetch user data to get the ID
    const userId = '1'; // Hardcoded for now

    return (
        <AppBar position="static">
            <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    Praxis
                </Typography>
                <Button color="inherit" component={RouterLink} to="/home">Home</Button>
                <Button color="inherit" component={RouterLink} to={`/profile/${userId}`}>Profile</Button>
                <Button color="inherit" component={RouterLink} to={`/goals/${userId}`}>Goals</Button>
                <Button color="inherit" component={RouterLink} to="/goal-selection">Select Goals</Button>
                <Button color="inherit" component={RouterLink} to="/matches">Matches</Button>
                <Button color="inherit" component={RouterLink} to="/login">Login</Button>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;
