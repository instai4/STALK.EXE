// api/stalk.js
// STALK.exe — GitHub Psychological Profiler AI
// Grok → Groq → Gemini fallback
//
// Env vars: XAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { profileData } = req.body || {};
    if (!profileData) return res.status(400).json({ error: 'No profile data provided.' });

    const {
      username, name, bio, location, company,
      publicRepos, followers, following, createdAt,
      topLanguages, topRepos, totalStars
    } = profileData;

    const accountAge = Math.floor((Date.now() - new Date(createdAt)) / (1000*60*60*24*365));
    const langsText = topLanguages.map(l => `${l.lang} (${l.pct}%)`).join(', ');
    const reposText = topRepos.map(r => `"${r.name}" — ${r.desc||'no description'} (${r.stars} stars, ${r.lang||'unknown lang'})`).join('\n');

    const systemPrompt = `You are STALK.exe, a brutally honest AI that builds psychological profiles of GitHub developers.
You are witty, insightful, and occasionally savage. You analyze coding patterns and developer behavior like a forensic psychologist.
Never be generic. Make specific observations based on the actual data provided.
Always respond ONLY with valid JSON, no markdown, no explanation outside the JSON.`;

    const userMsg = `Analyze this GitHub developer and build a full psychological profile.

SUBJECT: @${username} (${name || username})
Bio: ${bio || 'none'}
Location: ${location || 'unknown'}
Company: ${company || 'none'}
Account age: ${accountAge} years
Public repos: ${publicRepos}
Followers: ${followers} | Following: ${following}
Total stars: ${totalStars}
Top languages: ${langsText || 'none'}
Top repos:
${reposText || 'none'}

Respond ONLY with this exact JSON (no markdown, no extra keys):
{
  "traits": [
    {"name":"Trait Name","score":7,"desc":"One sentence observation specific to this developer."},
    {"name":"Trait Name","score":4,"desc":"One sentence observation specific to this developer."},
    {"name":"Trait Name","score":9,"desc":"One sentence observation specific to this developer."},
    {"name":"Trait Name","score":6,"desc":"One sentence observation specific to this developer."},
    {"name":"Trait Name","score":8,"desc":"One sentence observation specific to this developer."},
    {"name":"Trait Name","score":3,"desc":"One sentence observation specific to this developer."}
  ],
  "personality": "3-4 paragraph psychological assessment of this developer's personality based on their coding habits, language choices, repo patterns, follower/following ratio, and bio. Be specific and insightful. Reference actual data.",
  "darkside": "2-3 paragraphs revealing their hidden behavioral patterns, potential red flags, what their commit history or repo naming says about their psyche. Be creative and sharp.",
  "dangerScore": 6,
  "threat": "One paragraph threat assessment. How dangerous is this developer to society? Reference their tech stack and projects.",
  "stackAnalysis": "2-3 paragraphs analyzing what their language choices and tech stack reveal about their personality type. What does a Python-heavy dev vs JavaScript dev vs Java dev say about someone?",
  "prediction": "2-3 paragraphs predicting where this developer will be in 5 years based on their current trajectory, language trends, and project patterns.",
  "alternate": "1-2 paragraphs — if this developer had chosen a completely different path (non-technical), what would they be? A detective? A chef? A cult leader? Be creative and justify it with their coding style.",
  "verdictStamp": "SINGLE WORD VERDICT (e.g. DANGEROUS, CHAOTIC, LEGENDARY, MYSTERIOUS)",
  "verdictTitle": "4-6 word punchy verdict title",
  "verdictText": "2-3 sentence final verdict summarizing this developer's entire existence as a programmer."
}`;

    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg }
    ];

    // ── Grok ──
    const XKEY = process.env.XAI_API_KEY;
    if (XKEY) {
      try {
        const r = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${XKEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'grok-3-mini',
            messages: openAiMessages,
            max_tokens: 2000,
            temperature: 0.85,
            response_format: { type: 'json_object' }
          })
        });
        const d = await r.json();
        if (r.ok) {
          const text = d?.choices?.[0]?.message?.content;
          if (text) {
            const parsed = safeParseJSON(text);
            if (parsed) return res.status(200).json(parsed);
          }
        } else { console.log('[STALK] Grok failed:', r.status, d?.error?.message); }
      } catch(e) { console.log('[STALK] Grok error:', e.message); }
    }

    // ── Groq ──
    const GQKEY = process.env.GROQ_API_KEY;
    if (GQKEY) {
      const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
      for (const model of models) {
        try {
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GQKEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: openAiMessages,
              max_tokens: 2000,
              temperature: 0.85,
              response_format: { type: 'json_object' }
            })
          });
          const d = await r.json();
          if (r.ok) {
            const text = d?.choices?.[0]?.message?.content;
            if (text) {
              const parsed = safeParseJSON(text);
              if (parsed) return res.status(200).json(parsed);
            }
          } else { console.log(`[STALK] Groq ${model} failed:`, r.status); }
        } catch(e) { console.log(`[STALK] Groq ${model} error:`, e.message); }
      }
    }

    // ── Gemini ──
    const GKEY = process.env.GEMINI_API_KEY;
    if (GKEY) {
      const models = ['gemini-2.0-flash-lite', 'gemini-1.5-flash-8b', 'gemini-2.5-flash'];
      for (const model of models) {
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GKEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: userMsg }] }],
                systemInstruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                  maxOutputTokens: 2000,
                  temperature: 0.85,
                  responseMimeType: 'application/json'
                }
              })
            }
          );
          const d = await r.json();
          if (r.ok) {
            const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = safeParseJSON(text);
              if (parsed) return res.status(200).json(parsed);
            }
          } else { console.log(`[STALK] Gemini ${model} failed:`, r.status); }
        } catch(e) { console.log(`[STALK] Gemini ${model} error:`, e.message); }
      }
    }

    return res.status(500).json({ error: 'All AI providers failed. Check your API keys.' });

  } catch(e) {
    console.error('[STALK] Handler error:', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
}

function safeParseJSON(text) {
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch { return null; }
}