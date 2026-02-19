import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Box,
    Typography,
    Paper,
    Grid,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Slider,
    Button,
    Card,
    CardContent,
    CardActions,
    Avatar,
    Chip,
} from '@mui/material';
import { Domain } from '../../models/Domain'; // Correct path for Domain
import toast from 'react-hot-toast'; // Import toast

// Mock data interfaces
interface Goal {
    id: string;
    name: string;
}

interface MockMatchUser {
    id: string;
    name: string;
    avatar: string;
    domains: Domain[];
    goals: Goal[];
}

// Dummy compatibility calculation
const calculateCompatibility = (user1Domains: Domain[], user2Domains: Domain[]): number => {
    const sharedDomains = user1Domains.filter(domain => user2Domains.includes(domain));
    const compatibilityScore = (sharedDomains.length / Math.max(user1Domains.length, user2Domains.length)) * 100;
    return Math.floor(compatibilityScore + Math.random() * 20); // Add some randomness
};

const MatchesPage: React.FC = () => {
    const navigate = useNavigate();
    const [compatibilityFilter, setCompatibilityFilter] = useState<number>(50);
    const [selectedDomainsFilter, setSelectedDomainsFilter] = useState<string[]>([]);

    // Current user's dummy data (for compatibility calculation)
    const currentUser: MockMatchUser = {
        id: 'user-0',
        name: 'You',
        avatar: '/static/images/avatar/1.jpg', // Placeholder
        domains: [Domain.CAREER, Domain.FITNESS, Domain.MENTAL_HEALTH],
        goals: [{ id: 'g1', name: 'Get Promoted' }, { id: 'g2', name: 'Run Marathon' }],
    };

    // Mock match data
    const mockMatches: MockMatchUser[] = [
        {
            id: 'user-1',
            name: 'Alice',
            avatar: 'https://mui.com/static/images/avatar/1.jpg',
            domains: [Domain.CAREER, Domain.INVESTING, Domain.FITNESS],
            goals: [{ id: 'g1', name: 'Get Promoted' }, { id: 'g3', name: 'Invest in Stocks' }],
        },
        {
            id: 'user-2',
            name: 'Bob',
            avatar: 'https://mui.com/static/images/avatar/2.jpg',
            domains: [Domain.FITNESS, Domain.MENTAL_HEALTH, Domain.ACADEMICS],
            goals: [{ id: 'g2', name: 'Run Marathon' }, { id: 'g4', name: 'Learn React' }],
        },
        {
            id: 'user-3',
            name: 'Charlie',
            avatar: 'https://mui.com/static/images/avatar/3.jpg',
            domains: [Domain.PHILOSOPHICAL_DEVELOPMENT, Domain.CULTURE_HOBBIES_CREATIVE_PURSUITS],
            goals: [{ id: 'g5', name: 'Read Philosophy' }, { id: 'g6', name: 'Learn Guitar' }],
        },
        {
            id: 'user-4',
            name: 'Diana',
            avatar: 'https://mui.com/static/images/avatar/4.jpg',
            domains: [Domain.CAREER, Domain.INTIMACY_ROMANTIC_EXPLORATION],
            goals: [{ id: 'g1', name: 'Get Promoted' }, { id: 'g7', name: 'Improve Communication' }],
        },
    ];

    const filteredMatches = mockMatches.filter(match => {
        const comp = calculateCompatibility(currentUser.domains, match.domains);
        const domainMatch = selectedDomainsFilter.length === 0 || selectedDomainsFilter.some(d => match.domains.includes(d as Domain));
        return comp >= compatibilityFilter && domainMatch;
    });

    return (
        <Container maxWidth="lg" sx={{ mt: 4 }}>
            <Paper elevation={3} sx={{ p: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Matches
                </Typography>

                <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                            <InputLabel id="domain-filter-label">Filter by Domain</InputLabel>
                            <Select
                                labelId="domain-filter-label"
                                multiple
                                value={selectedDomainsFilter}
                                onChange={(e) => setSelectedDomainsFilter(e.target.value as string[])}
                                renderValue={(selected) => (selected as string[]).join(', ')}
                            >
                                {Object.values(Domain).map((domain) => (
                                    <MenuItem key={domain} value={domain}>
                                        {domain}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Typography gutterBottom>Minimum Compatibility (%)</Typography>
                        <Slider
                            value={compatibilityFilter}
                            onChange={(e, newValue) => setCompatibilityFilter(newValue as number)}
                            aria-labelledby="compatibility-slider"
                            valueLabelDisplay="auto"
                            min={0}
                            max={100}
                        />
                    </Grid>
                </Grid>
                
                <Grid container spacing={3}>
                    {filteredMatches.length > 0 ? (
                        filteredMatches.map((match) => {
                            const compatibility = calculateCompatibility(currentUser.domains, match.domains);
                            const sharedGoals = currentUser.goals.filter(goal => match.goals.some(mg => mg.id === goal.id));
                            return (
                                <Grid item xs={12} sm={6} md={4} key={match.id}>
                                    <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                        <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                                            <Avatar src={match.avatar} sx={{ width: 80, height: 80, mx: 'auto', mb: 2 }} />
                                            <Typography variant="h6" gutterBottom>{match.name}</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                Compatibility: <strong>{compatibility}%</strong>
                                            </Typography>
                                            {sharedGoals.length > 0 && (
                                                <Box sx={{ mt: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">Shared Goals:</Typography>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
                                                        {sharedGoals.map((goal) => (
                                                            <Chip key={goal.id} label={goal.name} size="small" />
                                                        ))}
                                                    </Box>
                                                </Box>
                                            )}
                                        </CardContent>
                                        <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                                            <Button 
                                                variant="contained" 
                                                onClick={() => {
                                                    toast.success(`Match requested with ${match.name}!`);
                                                    navigate(`/chat/${currentUser.id}/${match.id}`); // Route to ChatPage stub
                                                }}
                                            >
                                                Message
                                            </Button>
                                        </CardActions>
                                    </Card>
                                </Grid>
                            );
                        })
                    ) : (
                        <Grid item xs={12}>
                            <Box sx={{ textAlign: 'center', py: 8, border: '2px dashed grey', borderRadius: 2 }}>
                                <Typography variant="h5" color="text.secondary" gutterBottom>
                                    No matches found with current filters.
                                </Typography>
                                <Button variant="contained" sx={{mt: 2}} onClick={() => setSelectedDomainsFilter([])}>Reset Filters</Button>
                            </Box>
                        </Grid>
                    )}
                </Grid>
            </Paper>
        </Container>
    );
};

export default MatchesPage;
