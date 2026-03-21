import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography } from '@mui/material';

interface ContentRendererProps {
  content: string;
  sx?: any;
  variant?: 'post' | 'comment' | 'chat';
}

/**
 * Renders content with clickable hashtags and mentions
 * - #hashtags → Navigate to search/feed filtered by tag
 * - @mentions → Navigate to user profile
 */
const ContentRenderer: React.FC<ContentRendererProps> = ({ 
  content, 
  sx,
  variant = 'post'
}) => {
  const navigate = useNavigate();

  // Parse content to find hashtags and mentions
  const renderContent = () => {
    // Split by both hashtags and mentions
    const parts = content.split(/([#@]\w+)/g);
    
    return parts.map((part, i) => {
      // Hashtag pattern: #word
      if (/^#\w+$/.test(part)) {
        const tag = part.slice(1); // Remove # prefix
        
        // For chat variant, use inline style instead of Chip
        if (variant === 'chat') {
          return (
            <Typography
              key={i}
              component="span"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/search?q=%23${tag}`);
              }}
              sx={{
                color: '#A78BFA',
                fontWeight: 600,
                cursor: 'pointer',
                '&:hover': {
                  textDecoration: 'underline',
                },
                mx: 0.25,
              }}
            >
              {part}
            </Typography>
          );
        }
        
        // For post/comment variants, use Chip
        return (
          <Typography
            key={i}
            component="span"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/search?q=%23${tag}`);
            }}
            sx={{
              display: 'inline-block',
              color: '#A78BFA',
              fontWeight: 600,
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
              },
              mx: 0.25,
            }}
          >
            {part}
          </Typography>
        );
      }
      
      // Mention pattern: @username
      if (/^@\w+$/.test(part)) {
        const username = part.slice(1); // Remove @ prefix
        return (
          <Typography
            key={i}
            component="span"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${username}`);
            }}
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
              },
              ...(variant === 'chat' ? { mx: 0.25 } : {}),
            }}
          >
            {part}
          </Typography>
        );
      }
      
      // Regular text
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <Typography 
      variant="body2" 
      sx={{
        lineHeight: variant === 'chat' ? 1.5 : 1.6,
        wordBreak: 'break-word',
        ...sx,
      }}
    >
      {renderContent()}
    </Typography>
  );
};

export default ContentRenderer;
