import React from 'react';
import {
    Container,
    Typography,
    Paper,
    Box
} from '@mui/material';

const GoalSelectionPage: React.FC = () => {
    return (
        <Container component="main" maxWidth="md">
            <Box sx={{ my: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Goal Selection
                </Typography>
                <Paper elevation={3} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
                    <Typography variant="body1">
                        This page is under construction.
                    </Typography>
                </Paper>
            </Box>
        </Container>
    );
};

export default GoalSelectionPage;

