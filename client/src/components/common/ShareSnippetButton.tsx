import React, { useRef } from 'react';
import { Button, Tooltip } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

interface Props {
  /** Display name of the user */
  name: string;
  /** Current streak in days */
  streak: number;
  /** Praxis Points balance */
  points: number;
  /** Top goal name (optional) */
  topGoal?: string;
  /** Button size */
  size?: 'small' | 'medium';
}

/**
 * ShareSnippetButton — draws a branded progress card on a hidden <canvas>
 * and downloads it as a PNG.  No server round-trip required.
 */
const ShareSnippetButton: React.FC<Props> = ({ name, streak, points, topGoal, size = 'small' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 600;
    const H = 320;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── Background gradient ──────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0A0B14');
    bg.addColorStop(1, '#111827');
    ctx.fillStyle = bg;
    ctx.roundRect(0, 0, W, H, 20);
    ctx.fill();

    // ── Decorative glow circle ───────────────────────────────────────────
    const glow = ctx.createRadialGradient(W * 0.8, H * 0.2, 0, W * 0.8, H * 0.2, 200);
    glow.addColorStop(0, 'rgba(139,92,246,0.18)');
    glow.addColorStop(1, 'rgba(139,92,246,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // ── Border ───────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    ctx.roundRect(1, 1, W - 2, H - 2, 20);
    ctx.stroke();

    // ── Praxis wordmark ──────────────────────────────────────────────────
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#8B5CF6';
    ctx.fillText('PRAXIS', 32, 42);

    // ── User name ────────────────────────────────────────────────────────
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(name, 32, 110);

    // ── Streak pill ──────────────────────────────────────────────────────
    const fireX = 32;
    const fireY = 140;
    ctx.fillStyle = 'rgba(249,115,22,0.15)';
    ctx.beginPath();
    ctx.roundRect(fireX, fireY, 160, 44, 10);
    ctx.fill();
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#F97316';
    ctx.fillText(`🔥 ${streak} day streak`, fireX + 12, fireY + 29);

    // ── Points pill ──────────────────────────────────────────────────────
    const ptX = 208;
    ctx.fillStyle = 'rgba(139,92,246,0.15)';
    ctx.beginPath();
    ctx.roundRect(ptX, fireY, 160, 44, 10);
    ctx.fill();
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#A78BFA';
    ctx.fillText(`⚡ ${points} PP`, ptX + 12, fireY + 29);

    // ── Top goal ─────────────────────────────────────────────────────────
    if (topGoal) {
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('Currently pursuing', 32, 220);
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      // Truncate if too long
      const truncated = topGoal.length > 48 ? topGoal.slice(0, 48) + '…' : topGoal;
      ctx.fillText(truncated, 32, 246);
    }

    // ── Footer URL ───────────────────────────────────────────────────────
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('praxis.app — build intentionally', 32, H - 20);

    // ── Download ─────────────────────────────────────────────────────────
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `praxis-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <>
      {/* Hidden canvas — sized dynamically in handleExport */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <Tooltip title="Download progress card as PNG">
        <Button
          size={size}
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          sx={{
            borderRadius: '8px',
            fontWeight: 700,
            borderColor: 'rgba(139,92,246,0.4)',
            color: '#8B5CF6',
            '&:hover': { borderColor: '#8B5CF6', bgcolor: 'rgba(139,92,246,0.08)' },
          }}
        >
          Share Card
        </Button>
      </Tooltip>
    </>
  );
};

export default ShareSnippetButton;
