const fetch = require('node-fetch');

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const HF_MODEL_URL = 'https://router.huggingface.co/hf-inference/models/unitary/multilingual-toxic-xlm-roberta';
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
  // Step 1 - aggressive normalization
  let normalized = String(text || '').toLowerCase();

  // Remove spaces between letters of same word
  // catches "f u c k", "f.u.c.k", "f-u-c-k"
  normalized = normalized.replace(/(\w)\s+(\w)/g, '$1$2');
  normalized = normalized.replace(/(\w)[.\-_,]+(\w)/g, '$1$2');

  // Leetspeak substitutions
  normalized = normalized
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[!1|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[uüú]/g, 'u')
    .replace(/[+]/g, 't')
    .replace(/[\/\\]/g, 'i')
    .replace(/[*]/g, '')
    .replace(/[^a-z\s]/g, '');

  // Step 2 - collapse repeated characters
  // catches "fuuuck", "shhiiit", "aaasshole"
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

  // Step 3 - remove all spaces for compound check
  const compact = normalized.replace(/\s+/g, '');

  console.log('[Moderation] Normalized text:', normalized.slice(0, 60));

  // Step 4 - check word list against BOTH
  // normalized (with spaces) and compact (no spaces)
  const toxicPatterns = [
    // -- English base words --
    'fuck',
    'fuk',
    'fck',
    'phuck',
    'fvck',
    'fuc',
    'shit',
    'sht',
    'shyt',
    'shiit',
    'bitch',
    'biitch',
    'btch',
    'b1tch',
    'bastard',
    'bstrd',
    'asshole',
    'ahole',
    'ashole',
    'cunt',
    'cnt',
    'whore',
    'whor',
    'slut',
    'sloot',
    'dick',
    'dik',
    'dck',
    'cock',
    'cok',
    'pussy',
    'pusi',
    'pussi',
    'nigga',
    'nigger',
    'niga',
    'kys',
    'killyourself',
    'kill yourself',
    'retard',
    'rtard',
    'idiot',
    'moron',

    // -- Hindi base words --
    'bhenchod',
    'bhen chod',
    'bhenchod',
    'bhencho',
    'bnchd',
    'bc',
    'madarchod',
    'madar chod',
    'mdrchd',
    'mc',
    'chutiya',
    'chutia',
    'chutiye',
    'chotiya',
    'gaandu',
    'gandu',
    'gaand',
    'randi',
    'raand',
    'haraami',
    'harami',
    'haraami',
    'kamina',
    'kamine',
    'bsdk',
    'bsdke',
    'lodu',
    'lund',
    'lavda',
    'chut',
    'chodna',
    'chodne',
    'saala',
    'sala',
    'ullu',
    'gadha',
    'gadhe',
    'kutte',
    'kutta',
    'kutti',
    'maderchod',
    'mkc',
    'bkl',

    // -- Punjabi --
    'teri maa',
    'teri bhen',
    'tere maa',
    'suar',
    'suaar',
    'panche',
    'pendu',
    'kamine',
    'kameene',
    'tatti',
    'taati',
    'veshya',

    // -- Common Hinglish abbreviations --
    ' bc ',
    ' mc ',
    ' bk ',
    ' bkl ',
    'mkl',
    'mklc',
    'bhk'
  ];

  // Check both normalized and compact versions
  for (const pattern of toxicPatterns) {
    const cleanPattern = pattern.toLowerCase().replace(/\s+/g, '');

    // Check in compact (catches "f u c k" -> "fuck")
    if (compact.includes(cleanPattern)) {
      console.log(`[Moderation] Keyword blocked (compact): "${pattern}"`);
      return {
        isToxic: true,
        score: 9,
        category: 'abuse',
        reason: 'Abusive language detected'
      };
    }

    // Check in normalized (catches normal spacing)
    if (normalized.includes(pattern.toLowerCase())) {
      console.log(`[Moderation] Keyword blocked (normal): "${pattern}"`);
      return {
        isToxic: true,
        score: 9,
        category: 'abuse',
        reason: 'Abusive language detected'
      };
    }
  }

  // Step 5 - regex patterns for common bypass attempts
  const regexPatterns = [
    /f+u+c+k+/i, // fuuuck, fck, fcuk
    /f[\W_]*u[\W_]*c[\W_]*k/i, // f*u*c*k, f.u.c.k
    /s+h+i+t+/i, // shiit, shiiit
    /b+i+t+c+h+/i, // biitch
    /a+s+s+h+o+l+e+/i, // aasshole
    /c+u+n+t+/i,
    /d+i+c+k+/i,
    /c+o+c+k+/i,
    /b+[h]?[e3]+n+[c]+h+[o0]+d+/i, // bhenchod variations
    /m+[a@]+d+[a@]+r+[c]+h+[o0]+d+/i, // madarchod variations
    /ch+[u]+t+[i]+[y]+[a@]+/i, // chutiya variations
    /g+[a@]+[a@]+n+d+[u]+/i, // gaandu variations
    /r+[a@]+n+d+[i1]+/i, // randi variations
    /l+[o0]+d+[u]+/i // lodu variations
  ];

  for (const regex of regexPatterns) {
    if (regex.test(text) || regex.test(normalized) || regex.test(compact)) {
      console.log(`[Moderation] Regex pattern blocked: ${regex}`);
      return {
        isToxic: true,
        score: 9,
        category: 'abuse',
        reason: 'Abusive language detected'
      };
    }
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
