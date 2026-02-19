import React, { useState } from 'react';
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
    Button
} from '@mui/material';
import { Domain } from '../models/Domain';

const MatchesPage: React.FC = () => {
    const [compatibility, setCompatibility] = useState<number>(50);
    const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

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
                                value={selectedDomains}
                                onChange={(e) => setSelectedDomains(e.target.value as string[])}
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
                            value={compatibility}
                            onChange={(e, newValue) => setCompatibility(newValue as number)}
                            aria-labelledby="compatibility-slider"
                            valueLabelDisplay="auto"
                            min={0}
                            max={100}
                        />
                    </Grid>
                </Grid>
                
                <Box sx={{ textAlign: 'center', py: 8, border: '2px dashed grey', borderRadius: 2 }}>
                    <Typography variant="h5" color="text.secondary" gutterBottom>
                        No matches yet – invite friends!
                    </Typography>
                    <Button variant="contained" sx={{mt: 2}}>Invite Friends</Button>
                </Box>
            </Paper>
        </Container>
    );
};

export default MatchesPage;
