require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const multer = require('multer');
const path = require('path');
const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const openaiApiKey = process.env.OPENAI_API_KEY;
const azureOpenaiKey = process.env.AZURE_OPENAI_KEY;
const azureOpenaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const azureOpenaiApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
const llmModel = process.env.LLM_MODEL || 'gpt-4.1-mini';

// Determine which OpenAI client to use (Azure or standard)
let openai;
let useAzure = false;

if (azureOpenaiKey && azureOpenaiEndpoint) {
  openai = new OpenAI({
    apiKey: azureOpenaiKey,
    baseURL: `${azureOpenaiEndpoint.replace(/\/$/, '')}/openai/deployments/${llmModel}`,
    defaultQuery: { 'api-version': azureOpenaiApiVersion },
    defaultHeaders: { 'api-key': azureOpenaiKey },
  });
  useAzure = true;
  console.log(`Using Azure OpenAI: ${azureOpenaiEndpoint} with model ${llmModel}`);
} else if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
  console.log(`Using OpenAI API with model ${llmModel}`);
} else {
  console.error('Error: No OpenAI API key configured. Set OPENAI_API_KEY or AZURE_OPENAI_KEY + AZURE_OPENAI_ENDPOINT.');
  process.exit(1);
}

// Whisper client (Azure deployment or standard OpenAI fallback)
const whisperModel = process.env.WHISPER_MODEL || 'whisper-1';
let whisperClient;
if (azureOpenaiKey && azureOpenaiEndpoint) {
  whisperClient = new OpenAI({
    apiKey: azureOpenaiKey,
    baseURL: `${azureOpenaiEndpoint.replace(/\/$/, '')}/openai/deployments/${whisperModel}`,
    defaultQuery: { 'api-version': azureOpenaiApiVersion },
    defaultHeaders: { 'api-key': azureOpenaiKey },
  });
  console.log(`Using Azure Whisper: deployment=${whisperModel}`);
} else if (openaiApiKey) {
  whisperClient = new OpenAI({ apiKey: openaiApiKey });
  console.log('Using standard OpenAI for Whisper');
}

// Read HeyGen API key for server-side proxying
const heygenApiKey = process.env.HEYGEN_API_KEY;
if (!heygenApiKey) {
  console.warn('Warning: HEYGEN_API_KEY environment variable is not set. HeyGen API calls will fail unless a key is provided.');
}

app.use(express.static(path.join(__dirname, '.')));

// Proxy HeyGen API through the server so the browser does not need the key
app.all('/heygen/*', async (req, res) => {
  try {
    if (!heygenApiKey) {
      res.status(500).json({ error: 'HEYGEN_API_KEY not configured on server' });
      return;
    }

    const upstreamBase = 'https://api.heygen.com';
    const upstreamPath = req.originalUrl.replace(/^\/heygen/, '');
    const targetUrl = upstreamBase + upstreamPath;

    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key': heygenApiKey,
    };

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

    // Add timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Pass through status and content-type
    const contentType = response.headers.get('content-type') || 'application/json';
    res.status(response.status);
    res.set('content-type', contentType);
    const text = await response.text();
    res.send(text);
  } catch (err) {
    console.error('Error proxying HeyGen request:', err);

    if (err.name === 'AbortError') {
      res.status(408).json({ error: 'Request timeout to HeyGen API' });
    } else if (err.code === 'UND_ERR_CONNECT_TIMEOUT') {
      res.status(504).json({ error: 'Connection timeout to HeyGen API' });
    } else {
      res.status(502).json({ error: 'Bad gateway to HeyGen' });
    }
  }
});

// System prompt: Alex, Elvis's colleague
const SYSTEM_PROMPT = `You are Alex, a long-time colleague and close friend of Elvis Chuang. You have worked alongside Elvis for years and know him very well, both professionally and personally. You speak naturally, professionally yet warmly, like a trusted colleague would when introducing someone they genuinely respect and admire.

You support both Chinese (Traditional) and English conversations. Respond in the same language the user uses.

IMPORTANT: Keep your responses concise and conversational - aim for 2-3 sentences per response. This is a spoken conversation through an avatar, so long paragraphs don't work well. Be natural and brief, like a real conversation.

Here is what you know about Elvis:

## Professional Background
- Elvis Chuang is an AI & Data leader with deep expertise in enterprise AI transformation
- He has extensive experience at Deloitte, one of the Big Four consulting firms, where he led AI and data analytics initiatives
- He specializes in bridging the gap between cutting-edge AI technology and real business value

## Technical Expertise
- Strong background in AI/ML, including LLM applications, computer vision, and NLP
- Experienced with cloud platforms (Azure, AWS, GCP) and enterprise data architectures
- Skilled in Python, SQL, and modern AI frameworks
- Deep understanding of data engineering, ETL pipelines, and data governance

## Leadership & Management Style
- Elvis is known for his ability to communicate complex technical concepts to non-technical stakeholders
- He fosters a collaborative team culture and mentors junior team members
- He takes a pragmatic, results-oriented approach to project delivery
- He balances innovation with practical business needs

## Key Projects & Achievements
- Led multiple enterprise AI transformation projects for major clients
- Implemented AI-powered document processing and analysis solutions
- Built and managed cross-functional data science teams
- Delivered measurable business impact through data-driven solutions

## Personal Qualities
- Elvis is thoughtful, detail-oriented, and always eager to learn new things
- He has a great sense of humor and makes the workplace enjoyable
- He is reliable, trustworthy, and someone you can always count on
- He values work-life balance and encourages his team to do the same

When answering questions:
- Share specific anecdotes and personal observations when possible
- Be honest and balanced - mention areas of growth alongside strengths
- If asked something you don't know about Elvis, say so honestly rather than making things up
- Express genuine enthusiasm when talking about Elvis's accomplishments
- Keep answers focused and relevant to what the visitor is asking about`;

// Conversation memory: system prompt + all messages
let conversationHistory = [
  { role: 'system', content: SYSTEM_PROMPT }
];

// Whisper speech-to-text
app.post('/openai/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!whisperClient) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured for Whisper' });
    }
    const audioFile = await OpenAI.toFile(req.file.buffer, 'audio.webm');
    const language = req.body.language || undefined;
    const transcription = await whisperClient.audio.transcriptions.create({
      file: audioFile,
      model: whisperModel,
      language,
    });
    console.log('Whisper transcription:', transcription.text);
    res.json({ text: transcription.text });
  } catch (error) {
    console.error('Error in /openai/transcribe:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/openai/complete', async (req, res) => {
  try {
    // Add user message to history
    conversationHistory.push({ role: 'user', content: req.body.prompt });

    const params = {
      model: useAzure ? undefined : llmModel,
      messages: conversationHistory,
      max_tokens: 300,
      temperature: 0.7,
    };
    // Azure deployment already has model in URL, so omit model param
    if (useAzure) delete params.model;

    const completion = await openai.chat.completions.create(params);

    const assistantMessage = completion.choices[0].message.content;
    console.log('Assistant response:', assistantMessage);

    // Add assistant response to history
    conversationHistory.push({ role: 'assistant', content: assistantMessage });

    res.json({ text: assistantMessage });
  } catch (error) {
    console.error('Error in /openai/complete:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset conversation (keep only system prompt)
app.post('/openai/reset', (req, res) => {
  conversationHistory = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];
  console.log('Conversation reset');
  res.json({ message: 'Conversation reset' });
});

app.listen(3000, function () {
  console.log('App is listening on port 3000!');
});
