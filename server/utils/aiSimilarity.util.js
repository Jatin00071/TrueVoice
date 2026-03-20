const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function areTextsSemanticallyDuplicate(text1, text2) {
  if (!text1 || !text2) return false;

  if (text1.trim().toLowerCase() === text2.trim().toLowerCase()) {
    return true;
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    return false;
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `You are a content duplicate detector for a social media platform.

Compare these two social media posts and determine if Post B is a
duplicate or deliberate copy of Post A, or if they just happen to
say something similar independently.

Post A: "${text1}"
Post B: "${text2}"

Rules:
- Common phrases like "Good morning", "Happy birthday", "Have a nice day"
  are NOT duplicates - people say these independently all the time
- Short generic sentences under 10 words are NOT duplicates
- If the posts convey the same unique idea, story, joke, or opinion
  with similar or paraphrased wording, they ARE duplicates
- Coincidental similarity is NOT duplication

Reply with ONLY one word: DUPLICATE or UNIQUE`
        }
      ]
    });

    const firstBlock = Array.isArray(response.content) ? response.content[0] : null;
    const answer = firstBlock && firstBlock.text ? firstBlock.text.trim().toUpperCase() : '';
    return answer === 'DUPLICATE';
  } catch (error) {
    console.error('AI similarity check failed:', error.message);
    return false;
  }
}

module.exports = { areTextsSemanticallyDuplicate };
