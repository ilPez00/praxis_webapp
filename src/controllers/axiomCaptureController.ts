import { Request, Response } from 'express';
import { supabase } from '../lib/supabaseClient';
import { AICoachingService } from '../services/AICoachingService';
import axiomMultimodalService from '../services/AxiomMultimodalService';
import { catchAsync, UnauthorizedError, BadRequestError } from '../utils/appErrors';
import logger from '../utils/logger';

const aiCoachingService = new AICoachingService();

const CAPTURE_PROMPT = `You are Axiom — a wise, warm observer. The user has captured an image and optionally added a note.

Look at the image and the user's note. Then:
1. Describe what you see in the image — be specific, observational, grounded.
2. Offer one insight or connection — relate what you see to the user's life, goals, or growth. What is this moment showing them?
3. Suggest one tag or domain that fits this moment (e.g., Health, Wealth, Wisdom, Relationships, Happiness, Creativity, Nature, Food, Travel, Work, Family, Fitness, Art, Learning).

Keep your response concise: 3-5 sentences. Warm, never generic. If the user included a note, weave it into your observation naturally.

Example response:
"What I see: a minimalist workspace with morning light falling across an open notebook. The pen is uncapped — you were mid-thought when you paused to capture this. This is a threshold moment, where intention meets action. The empty page is not a gap — it's a catalyst. Domain: Creativity"`;

export const captureAxiom = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new UnauthorizedError('Not authenticated');

  const { imageUrl, text, domain: domainHint } = req.body;

  if (!imageUrl) {
    throw new BadRequestError('imageUrl is required');
  }

  if (!aiCoachingService.isConfigured) {
    return res.status(503).json({
      error: 'AXIOM_OFFLINE',
      message: 'Axiom is not configured on this server',
    });
  }

  try {
    const attachment = {
      type: 'file' as const,
      url: imageUrl,
      name: `capture-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
    };

    const { parts, textContexts, totalProcessed, totalSkipped } =
      await axiomMultimodalService.processAttachments([attachment]);

    const imageSummary = axiomMultimodalService.buildAttachmentSummary(textContexts);
    const userNote = text?.trim() ? `\nUser's note: ${text.trim()}` : '';
    const fullPrompt = `${CAPTURE_PROMPT}\n\n${imageSummary}${userNote}`;

    let analysis: string;
    if (parts.length > 0) {
      analysis = await aiCoachingService.runMultimodal(fullPrompt, parts, { compressed: false });
    } else {
      analysis = await aiCoachingService.runWithFallback(fullPrompt);
    }

    const detectedDomain = extractDomain(analysis, domainHint);
    const detectedTags = extractTags(analysis);

    const { data: notebookEntry, error: notebookError } = await supabase
      .from('notebook_entries')
      .insert({
        user_id: userId,
        entry_type: 'observation',
        title: text?.trim() || `Axiom capture — ${new Date().toLocaleDateString()}`,
        content: analysis,
        attachments: [{ type: 'file', url: imageUrl, name: `capture-${Date.now()}.jpg`, mimeType: 'image/jpeg' }],
        tags: detectedTags,
        domain: detectedDomain,
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notebookError) {
      logger.error('[AxiomCapture] Failed to create notebook entry:', notebookError);
      throw notebookError;
    }

    let diaryEntry = null;
    try {
      const { data: de } = await supabase
        .from('diary_entries')
        .insert({
          user_id: userId,
          entry_type: 'observation',
          title: `Axiom capture — ${new Date().toLocaleDateString()}`,
          content: analysis,
          source_table: 'notebook_entries',
          source_id: notebookEntry.id,
          tags: detectedTags,
          is_private: true,
          occurred_at: new Date().toISOString(),
        })
        .select()
        .single();
      diaryEntry = de;
    } catch (err: any) {
      logger.warn('[AxiomCapture] Diary entry creation failed (non-fatal):', err.message);
    }

    await supabase.from('messages').insert({
      sender_id: userId,
      receiver_id: userId,
      content: `Axiom capture: ${analysis}`,
      message_type: 'text',
      is_ai: true,
      metadata: { type: 'axiom_capture', imageUrl, text: text?.trim() || null },
    });

    res.status(201).json({
      success: true,
      analysis,
      domain: detectedDomain,
      tags: detectedTags,
      notebookEntry,
      diaryEntry,
    });
  } catch (err: any) {
    logger.error('[AxiomCapture] Failed:', err.message);
    res.status(500).json({
      error: 'CAPTURE_FAILED',
      message: 'Axiom could not analyze this capture. Please try again.',
    });
  }
});

function extractDomain(analysis: string, hint?: string): string {
  const domainMatch = analysis.match(/Domain:\s*(\w+)/i);
  if (domainMatch) return domainMatch[1];
  if (hint) return hint;
  return 'General';
}

function extractTags(analysis: string): string[] {
  const tagMatch = analysis.match(/Tag[s]?:\s*(.+)/i);
  if (tagMatch) {
    return tagMatch[1].split(/[,;]/).map(t => t.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}
