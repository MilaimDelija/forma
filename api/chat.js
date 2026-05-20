export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, system } = req.body;
  if (!messages) return res.status(400).json({ error: 'Missing messages' });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'GROQ_API_KEY not set in Vercel environment variables' });

  // Try models in order
  const models = ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768'];

  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            ...messages
          ]
        })
      });

      if (response.status === 429 || response.status === 503) continue; // try next model

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: `Groq error (${model}): ${err.error?.message || response.statusText}`
        });
      }

      const data = await response.json();
      return res.status(200).json({ content: data.choices[0].message.content });

    } catch (e) {
      continue; // try next model
    }
  }

  return res.status(503).json({ error: 'All Groq models unavailable. Check your GROQ_API_KEY in Vercel settings.' });
}
