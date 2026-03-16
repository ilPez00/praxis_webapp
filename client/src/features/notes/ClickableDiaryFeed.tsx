import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ArticleIcon from '@mui/icons-material/Article';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import DiaryFeed, { FeedItem } from './DiaryFeed';

interface ClickableDiaryFeedProps {
  userId: string;
  days?: number;
}

/**
 * Enhanced DiaryFeed with clickable notes that open their associated content:
 * - Posts → Opens post detail in dashboard
 * - Places/Events → Opens map with location
 * - Journal entries → Opens journal for that goal node
 * - Bets/Goals/Verification → Opens goal workspace
 * - Trackers → Opens tracker widget
 */
const ClickableDiaryFeed: React.FC<ClickableDiaryFeedProps> = ({ userId, days = 30 }) => {
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = React.useState<{
    mouseX: number;
    mouseY: number;
    item: FeedItem | null;
  } | null>(null);

  const handleContextMenu = (event: React.MouseEvent, item: FeedItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      item,
    });
  };

  const handleClose = () => {
    setContextMenu(null);
  };

  const handleOpenContent = (item: FeedItem) => {
    handleClose();
    
    switch (item.type) {
      case 'post':
        // Navigate to dashboard and open post
        navigate('/dashboard', { state: { openPost: item.id } });
        break;
      
      case 'place':
      case 'event':
        // Navigate to map with location
        navigate('/map', { state: { openItem: item.id, itemType: item.type } });
        break;
      
      case 'journal':
        // Open journal for the goal node
        if (item.goalId) {
          navigate('/notes', { 
            state: { 
              openJournalForNode: item.goalId,
              selectedNodeId: item.goalId 
            } 
          });
        } else {
          // No specific goal, just open journal page
          navigate('/notes');
        }
        break;
      
      case 'tracker':
        // Navigate to dashboard with tracker widget highlighted
        navigate('/dashboard', { state: { highlightTracker: item.id } });
        break;
      
      case 'bet':
      case 'goal':
      case 'verification':
      case 'achievement':
        // Open goal workspace
        if (item.goalId) {
          navigate('/notes', { 
            state: { 
              selectedNodeId: item.goalId,
              openWorkspaceForNode: item.goalId 
            } 
          });
        } else {
          // No specific goal ID, go to goals page
          navigate('/goals');
        }
        break;
      
      case 'checkin':
        // Open dashboard to show check-in
        navigate('/dashboard');
        break;
      
      case 'match':
      case 'chat':
        // Open messages
        navigate('/messages');
        break;
      
      default:
        // For unknown types, just log it
        console.log('Unknown item type:', item.type, item);
    }
  };

  const handleEdit = (item: FeedItem) => {
    handleClose();
    // For now, just navigate to the content for editing
    handleOpenContent(item);
  };

  return (
    <>
      <DiaryFeed 
        userId={userId} 
        days={days}
        onItemClick={handleOpenContent}
        onItemContextMenu={handleContextMenu}
      />
      
      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(30, 30, 35, 0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          },
        }}
      >
        {contextMenu?.item && (
          <>
            <MenuItem onClick={() => handleOpenContent(contextMenu.item!)}>
              <ListItemIcon>
                <OpenInFullIcon fontSize="small" sx={{ color: '#3B82F6' }} />
              </ListItemIcon>
              <ListItemText primary="Open" />
            </MenuItem>
            
            {(contextMenu.item.type === 'post' || contextMenu.item.type === 'journal') && (
              <MenuItem onClick={() => handleEdit(contextMenu.item!)}>
                <ListItemIcon>
                  <EditIcon fontSize="small" sx={{ color: '#F59E0B' }} />
                </ListItemIcon>
                <ListItemText primary="Edit" />
              </MenuItem>
            )}
            
            <Divider sx={{ my: 0.5 }} />
            
            {/* Type-specific actions */}
            {contextMenu.item.type === 'post' && (
              <MenuItem onClick={() => handleOpenContent(contextMenu.item!)}>
                <ListItemIcon>
                  <ArticleIcon fontSize="small" sx={{ color: '#3B82F6' }} />
                </ListItemIcon>
                <ListItemText primary="View Post" />
              </MenuItem>
            )}
            
            {(contextMenu.item.type === 'place' || contextMenu.item.type === 'event') && (
              <MenuItem onClick={() => handleOpenContent(contextMenu.item!)}>
                <ListItemIcon>
                  <LocationOnIcon fontSize="small" sx={{ color: '#EF4444' }} />
                </ListItemIcon>
                <ListItemText primary="Show on Map" />
              </MenuItem>
            )}
            
            {contextMenu.item.type === 'tracker' && (
              <MenuItem onClick={() => handleOpenContent(contextMenu.item!)}>
                <ListItemIcon>
                  <FitnessCenterIcon fontSize="small" sx={{ color: '#10B981' }} />
                </ListItemIcon>
                <ListItemText primary="View Tracker" />
              </MenuItem>
            )}
          </>
        )}
      </Menu>
    </>
  );
};

export default ClickableDiaryFeed;
