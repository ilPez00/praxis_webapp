import React, { useState } from 'react';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { FeedbackGrade } from '../../../models/FeedbackGrade';

interface GradingDialogProps {
  open: boolean;
  onClose: () => void;
  receiverName: string;
  receiverGoalTree: { nodes?: any[] } | null;
  onGradingSubmitted: () => void;
}

const GradingDialog: React.FC<GradingDialogProps> = ({
  open,
  onClose,
  receiverName,
  receiverGoalTree,
  onGradingSubmitted,
}) => {
  const [selectedGoalNode, setSelectedGoalNode] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<FeedbackGrade>(FeedbackGrade.SUCCEEDED);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedGoalNode || !selectedGrade) {
      toast.error('Please select a goal and a grade before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/feedback', {
        goalNodeId: selectedGoalNode,
        grade: selectedGrade,
        comment: feedbackComment,
      });
      toast.success('Grade submitted!');
      onGradingSubmitted();
      onClose();
      setSelectedGoalNode('');
      setSelectedGrade(FeedbackGrade.SUCCEEDED);
      setFeedbackComment('');
    } catch (error) {
      console.error('Error submitting grade:', error);
      toast.error('Failed to submit grade. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmojiEventsIcon sx={{ color: '#F59E0B' }} />
          Grade this Session
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ ml: 'auto', color: 'text.disabled' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            How did <strong>{receiverName}</strong> perform toward their goals this session?
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Their Goal</InputLabel>
            <Select
              label="Their Goal"
              value={selectedGoalNode}
              onChange={(e) => setSelectedGoalNode(e.target.value)}
            >
              {(receiverGoalTree?.nodes || []).map((n: any) => (
                <MenuItem key={n.id} value={n.id}>{n.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Grade</InputLabel>
            <Select
              label="Grade"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value as FeedbackGrade)}
            >
              {(Object.values(FeedbackGrade) as FeedbackGrade[]).map((g) => (
                <MenuItem key={g} value={g}>{g}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth size="small" multiline rows={2}
            label="Comment (optional)"
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !selectedGoalNode}
          sx={{ px: 3 }}
        >
          {submitting ? 'Submitting…' : 'Submit Grade'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GradingDialog;
