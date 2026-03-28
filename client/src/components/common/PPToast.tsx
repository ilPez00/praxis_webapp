/**
 * PPToast Component
 * Animated toast for PP/XP gains (like mobile games)
 */

import React, { useEffect } from 'react';
import { Box, Typography, keyframes } from '@mui/material';
import { createPortal } from 'react-dom';

interface PPToastProps {
  amount: number;
  type?: 'pp' | 'xp' | 'both';
  xpAmount?: number;
  position?: { x: number; y: number };
  onClose?: () => void;
  duration?: number;
}

const floatUpAnimation = keyframes`
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-80px) scale(1.2);
  }
`;

const PPToast: React.FC<PPToastProps> = ({
  amount,
  type = 'pp',
  xpAmount,
  position = { x: 0, y: 0 },
  onClose,
  duration = 2000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const toastContent = (
    <Box
      sx={{
        position: 'fixed',
        left: position.x || '50%',
        top: position.y || '20%',
        transform: position.x ? 'none' : 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none',
        animation: `${floatUpAnimation} ${duration}ms ease-out forwards`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {/* PP Gain */}
        {(type === 'pp' || type === 'both') && (
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'rgba(245,158,11,0.95)',
              borderRadius: 4,
              boxShadow: '0 4px 20px rgba(245,158,11,0.5)',
              border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Typography
              sx={{
                fontSize: '1.5rem',
                fontWeight: 900,
                color: '#fff',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              +{amount}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.9rem',
                fontWeight: 800,
                color: '#fff',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              PP
            </Typography>
          </Box>
        )}

        {/* XP Gain */}
        {(type === 'xp' || type === 'both') && xpAmount && (
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'rgba(167,139,250,0.95)',
              borderRadius: 4,
              boxShadow: '0 4px 20px rgba(167,139,250,0.5)',
              border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Typography
              sx={{
                fontSize: '1.5rem',
                fontWeight: 900,
                color: '#fff',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              +{xpAmount}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.9rem',
                fontWeight: 800,
                color: '#fff',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              XP
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  return createPortal(toastContent, document.body);
};

export default PPToast;
