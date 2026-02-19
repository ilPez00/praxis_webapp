// client/src/components/GoalTree/GoalNodeComponent.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoalNode, DOMAIN_COLORS } from '../../../types/goal';
import {
    Box,
    Typography,
    IconButton,
    Paper,
    LinearProgress,
    Tooltip,
    Chip,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/Edit';

interface GoalNodeComponentProps {
    node: GoalNode;
    isExpanded: boolean;
    onToggleExpand: (nodeId: string) => void;
    level: number;
    hasChildren: boolean;
}

const GoalNodeComponent: React.FC<GoalNodeComponentProps> = ({
    node,
    isExpanded,
    onToggleExpand,
    level,
    hasChildren,
}) => {
    const theme = useTheme();
    const [openDialog, setOpenDialog] = useState(false);

    const nodeColor = DOMAIN_COLORS[node.domain || node.children[0]?.domain || 'defaultDomain'] || theme.palette.primary.main; // Fallback for children or default

    const handleOpenDialog = () => {
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: theme.spacing(1),
                    paddingLeft: theme.spacing(level * 2), // Indent based on level
                }}
            >
                <Paper
                    elevation={2}
                    sx={{
                        backgroundColor: theme.palette.background.paper,
                        borderRadius: '12px',
                        padding: theme.spacing(2),
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing(1.5),
                        minWidth: '250px',
                        borderColor: nodeColor,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                        '&:hover': {
                            boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
                        },
                        flexGrow: 1,
                    }}
                >
                    {hasChildren && (
                        <IconButton size="small" onClick={() => onToggleExpand(node.id)} sx={{ p: 0 }}>
                            {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                        </IconButton>
                    )}
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                            {node.title}
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={node.progress}
                            sx={{
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: theme.palette.action.disabledBackground,
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: nodeColor,
                                },
                                mt: 0.5,
                            }}
                        />
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            <Chip label={`${node.progress}%`} size="small" sx={{ backgroundColor: nodeColor, color: '#fff' }} />
                            <Chip label={`Weight: ${node.weight}`} size="small" variant="outlined" />
                        </Stack>
                    </Box>
                    <IconButton size="small" onClick={handleOpenDialog} color="primary">
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Paper>
            </motion.div>

            <Dialog open={openDialog} onClose={handleCloseDialog}>
                <DialogTitle>{node.title} Details</DialogTitle>
                <DialogContent>
                    <Typography variant="body1"><strong>Description:</strong> {node.description || 'No description provided.'}</Typography>
                    <Typography variant="body1"><strong>Progress:</strong> {node.progress}%</Typography>
                    <Typography variant="body1"><strong>Weight:</strong> {node.weight}</Typography>
                    {node.domain && <Typography variant="body1"><strong>Domain:</strong> {node.domain}</Typography>}
                    {/* Placeholder for actual edit forms */}
                    <Box sx={{ mt: 2, p: 2, border: '1px dashed grey', borderRadius: '4px' }}>
                        <Typography variant="caption" color="text.secondary">
                            Edit options coming soon...
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Close</Button>
                    <Button onClick={handleCloseDialog} variant="contained" color="primary">Edit (Placeholder)</Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default GoalNodeComponent;
