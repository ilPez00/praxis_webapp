import logger from '../utils/logger';

export interface TranslationResult {
  text: string;
  detectedSource?: string;
  provider: string;
}

export class AxiomTranslationService {
  /**
   * Translate text via fallback: DeepL → LibreTranslate → MyMemory
   */
  async translate(text: string, targetLang: string, sourceLang?: string): Promise<TranslationResult | null> {
    // 1. Try DeepL
    const deeplKey = process.env.TRANSLATE_DEEPL_KEY;
    if (deeplKey) {
      try {
        const result = await this.translateDeepL(text, targetLang, sourceLang, deeplKey);
        if (result) return result;
      } catch (err: any) {
        logger.warn('[AxiomTranslate] DeepL failed:', err.message);
      }
    }

    // 2. Try LibreTranslate
    try {
      const endpoint = process.env.TRANSLATE_LIBRE_ENDPOINT || 'https://libretranslate.com/translate';
      const result = await this.translateLibre(text, targetLang, sourceLang, endpoint);
      if (result) return result;
    } catch (err: any) {
      logger.warn('[AxiomTranslate] LibreTranslate failed:', err.message);
    }

    // 3. Try MyMemory
    try {
      const endpoint = process.env.TRANSLATE_MY_MEMORY_ENDPOINT || 'https://api.mymemory.translated.net/get';
      const result = await this.translateMyMemory(text, targetLang, sourceLang, endpoint);
      if (result) return result;
    } catch (err: any) {
      logger.warn('[AxiomTranslate] MyMemory failed:', err.message);
    }

    return null;
  }

  private async translateDeepL(
    text: string, target: string, source: string | undefined, apiKey: string
  ): Promise<TranslationResult | null> {
    const endpoint = process.env.TRANSLATE_DEEPL_ENDPOINT || 'https://api-free.deepl.com/v2/translate';
    const params = new URLSearchParams({ text, target_lang: target.toUpperCase() });
    if (source) params.set('source_lang', source.toUpperCase());

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const translated = data?.translations?.[0]?.text;
    if (!translated) return null;
    return { text: translated, detectedSource: data?.translations?.[0]?.detected_source_language, provider: 'deepl' };
  }

  private async translateLibre(
    text: string, target: string, source: string | undefined, endpoint: string
  ): Promise<TranslationResult | null> {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: source || 'auto',
        target,
        format: 'text',
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.translatedText) return null;
    return { text: data.translatedText, provider: 'libre' };
  }

  private async translateMyMemory(
    text: string, target: string, source: string | undefined, endpoint: string
  ): Promise<TranslationResult | null> {
    const params = new URLSearchParams({ q: text, langpair: `${source || 'auto'}|${target}` });
    const resp = await fetch(`${endpoint}?${params}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.responseData?.translatedText) return null;
    return {
      text: data.responseData.translatedText,
      detectedSource: data.responseData.detectedLanguage || undefined,
      provider: 'mymemory',
    };
  }
}

export const axiomTranslationService = new AxiomTranslationService();
