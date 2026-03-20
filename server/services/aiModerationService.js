const fetch = require('node-fetch');

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/unitary/multilingual-toxic-xlm-roberta';
const TOXICITY_THRESHOLD = 0.75;

let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  return anthropicClient;
}

async function analyzeComment(commentText) {
  console.log('[HF] analyzeComment called for:', String(commentText || '').slice(0, 30));

  if (!commentText || commentText.trim().length === 0) {
    return { isToxic: false, category: 'clean', score: 0 };
  }

  try {
    const response = await fetch(HF_MODEL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: commentText })
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 503) {
        console.log('[HF] Model loading, waiting 10s then retrying...');
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return analyzeComment(commentText);
      }

      console.error('[HF API] Error:', response.status, errorText);
      return fallbackKeywordCheck(commentText);
    }

    const data = await response.json();
    const results = Array.isArray(data[0]) ? data[0] : data;

    let toxicScore = 0;
    let category = 'clean';

    for (const item of results) {
      const label = (item.label || '').toLowerCase();
      const score = item.score || 0;

      if (label === 'toxic' && score > toxicScore) {
        toxicScore = score;
        category = 'abuse';
      }
    }

    const keywordResult = fallbackKeywordCheck(commentText);
    if (keywordResult.isToxic && toxicScore < TOXICITY_THRESHOLD) {
      console.log('[Keyword] Punjabi/Hinglish toxic word detected');
      return keywordResult;
    }

    const isToxic = toxicScore >= TOXICITY_THRESHOLD;

    console.log(
      `[HF Moderation] score: ${toxicScore.toFixed(3)},`,
      `toxic: ${isToxic}, category: ${category}`
    );

    return {
      isToxic,
      score: Math.round(toxicScore * 10),
      category: isToxic ? category : 'clean',
      reason: isToxic
        ? `Detected as toxic with confidence ${(toxicScore * 100).toFixed(0)}%`
        : null
    };
  } catch (error) {
    console.error('[HF API] Request failed:', error.message);
    return fallbackKeywordCheck(commentText);
  }
}

function fallbackKeywordCheck(text) {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[@!]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[0]/g, 'o')
    .replace(/[1]/g, 'i')
    .replace(/\*/g, '');

  const toxicWords = [
    'fuck',
    'shit',
    'bastard',
    'bitch',
    'asshole',
    'kill yourself',
    'kys',
    'die loser',
    'idiot',
    'moron',
    'retard',
    'cunt',
    'whore',
    'slut',
    'bhenchod',
    'madarchod',
    'chutiya',
    'gaandu',
    'randi',
    'haraami',
    'kamina',
    'saala',
    'bsdk',
    'lodu',
    'harami',
    'maderchod',
    'bhenchodd',
    'teri maa',
    'teri bhen',
    'kutte',
    'suar',
    'ullu',
    'gadha',
    'gadhe',
    'kutti',
    'gandu',
    'tatti',
    'maa di',
    'panche',
    'kutta',
    'bc',
    'mc ',
    ' mc',
    'bkl',
    'mkl',
    'chut',
    'lund',
    'bur'
  ];

  const found = toxicWords.find((word) => normalized.includes(word.toLowerCase()));

  if (found) {
    console.log(`[Fallback] Toxic word detected: "${found}"`);
    return {
      isToxic: true,
      score: 9,
      category: 'abuse',
      reason: 'Abusive language detected'
    };
  }

  return { isToxic: false, score: 0, category: 'clean', reason: null };
}

async function analyzePost(postContent, mediaUrl) {
  if (!postContent || postContent.trim().length < 10) {
    return { isFlagged: false, reason: null, category: 'clean' };
  }

  if (
    !process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here'
  ) {
    console.log('[Post Screening] Anthropic key not set - skipping');
    return { isFlagged: false, reason: null, category: 'clean' };
  }

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `You are a content policy enforcer for a social media platform.
Analyze this post for serious violations ONLY.
Check for: hate speech, incitement to violence, targeted harassment,
dangerous misinformation, or explicit content.
Do NOT flag opinions, criticism, satire, or edgy content.
Only flag clear, obvious, severe violations.

Post: "${postContent}"

Reply ONLY with this JSON - nothing else:
{
  "isFlagged": true or false,
  "category": "hate_speech" or "violence" or "harassment" or "misinformation" or "explicit" or "clean",
  "reason": "one sentence if flagged, null if clean",
  "severity": "low" or "medium" or "high"
}`
        }
      ]
    });

    const text = response.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return {
      isFlagged: result.isFlagged && result.severity === 'high',
      category: result.category,
      reason: result.reason,
      severity: result.severity
    };
  } catch (error) {
    if (error.message?.includes('credit balance')) {
      console.log('[Post Screening] No Anthropic credits - skipping');
    } else {
      console.error('[Post Screening] Failed:', error.message);
    }
    return { isFlagged: false, reason: null, category: 'clean' };
  }
}

module.exports = { analyzeComment, analyzePost };
