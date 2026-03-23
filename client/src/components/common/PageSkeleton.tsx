import React from 'react';
import { Box, Container, Skeleton, Stack } from '@mui/material';

interface Props {
  /** Number of card-shaped skeleton blocks to show */
  cards?: number;
  /** Show a header skeleton (title + subtitle) */
  header?: boolean;
}

/** Standard loading skeleton for pages — prevents layout shift and white flash */
const PageSkeleton: React.FC<Props> = ({ cards = 3, header = true }) => (
  <Container maxWidth="lg" sx={{ pt: 4, pb: 8 }}>
    {header && (
      <Box sx={{ mb: 4 }}>
        <Skeleton variant="text" width={200} height={36} sx={{ borderRadius: '8px' }} />
        <Skeleton variant="text" width={300} height={20} sx={{ borderRadius: '6px', mt: 0.5 }} />
      </Box>
    )}
    <Stack spacing={3}>
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={i === 0 ? 160 : 120}
          sx={{ borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.04)' }}
        />
      ))}
    </Stack>
  </Container>
);

/** Compact skeleton for widgets/cards inside a page */
export const WidgetSkeleton: React.FC<{ height?: number }> = ({ height = 120 }) => (
  <Skeleton
    variant="rounded"
    height={height}
    sx={{ borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.04)' }}
  />
);

export default PageSkeleton;
