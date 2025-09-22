const express = require('express');
const OpenAI = require('openai');
const path = require('path');
const app = express();
app.use(express.json());

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.error('Error: OPENAI_API_KEY environment variable is not set.');
  process.exit(1);
}

// Read HeyGen API key for server-side proxying
const heygenApiKey = process.env.HEYGEN_API_KEY;
if (!heygenApiKey) {
  console.warn('Warning: HEYGEN_API_KEY environment variable is not set. HeyGen API calls will fail unless a key is provided.');
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
  defaultHeaders: { 'OpenAI-Beta': 'assistants=v2' }
});

const assistantId = 'asst_inOoj1HGJrQ0Bp0GH3DsKBek';

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

// 全局變數來儲存 thread ID，確保整個對話使用同一個 thread
let globalThreadId = null;

app.post('/openai/complete', async (req, res) => {
  try {
    // 如果沒有全局 thread ID，創建一個新的
    if (!globalThreadId) {
      const myThread = await openai.beta.threads.create();
      globalThreadId = myThread.id;
      console.log("New thread created with ID:", globalThreadId);
    } else {
      console.log("Using existing thread ID:", globalThreadId);
    }

    // 確保 globalThreadId 存在
    if (!globalThreadId) {
      throw new Error("Failed to get or create thread ID");
    }

    const myThreadMessage = await openai.beta.threads.messages.create(globalThreadId, {
      role: "user",
      content: req.body.prompt,
    });

    const myRun = await openai.beta.threads.runs.create(globalThreadId, {
      assistant_id: assistantId,
    });

    console.log("Run created:", myRun.id, "Status:", myRun.status);
    console.log("Thread ID:", globalThreadId, "Run ID:", myRun.id);

    // 驗證必要的參數
    if (!myRun || !myRun.id) {
      throw new Error("Failed to create run - no run ID returned");
    }

    // 輪詢直到完成或超時
    let attempts = 0;
    let run;
    while (attempts < 60) {
      if (!globalThreadId || !myRun.id) {
        throw new Error(`Missing required parameters: threadId=${globalThreadId}, runId=${myRun.id}`);
      }

      try {
        run = await openai.beta.threads.runs.retrieve(globalThreadId, myRun.id);
      } catch (retrieveError) {
        console.error("Error retrieving run:", retrieveError);
        throw retrieveError;
      }
      
      console.log(`Run status: ${run.status} (attempt ${attempts + 1})`);

      if (run.status === "completed") break;
      if (run.status === "failed") {
        console.error("Run failed:", run.last_error);
        throw new Error("Assistant run failed");
      }
      if (run.status === "cancelled") throw new Error("Assistant run cancelled");

      attempts++;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (attempts >= 60) throw new Error("Assistant run timed out");

    // 取得最新訊息
    const allMessages = await openai.beta.threads.messages.list(globalThreadId);
    const latest = allMessages.data
      .filter(m => m.role === "assistant")
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (!latest) {
      throw new Error("No assistant response found");
    }

    console.log("Assistant response:", latest.content[0].text.value);
    res.json({ threadId: globalThreadId, text: latest.content[0].text.value });
  } catch (error) {
    console.error("Error in /openai/complete:", error);
    res.status(500).json({ error: error.message });
  }
});

// 新增一個端點來重置對話（創建新的 thread）
app.post('/openai/reset', async (req, res) => {
  try {
    const myThread = await openai.beta.threads.create();
    globalThreadId = myThread.id;
    console.log("New conversation started with thread ID:", globalThreadId);
    res.json({ threadId: globalThreadId, message: "New conversation started" });
  } catch (error) {
    console.error("Error resetting conversation:", error);
    res.status(500).json({ error: error.message });
  }
});

//does the database things

//code about connecting to the database
const sqlite = require('sqlite3'); //adds sqlite functionality to code. Requires installation (npm install sqlite3)
const db = new sqlite.Database('./data.sqlite');

//creates all the tables in the database
db.serialize(() => {
  //creates table that stores individual candidate information
  db.run(`CREATE TABLE IF NOT EXISTS candidates (
    candidate_id CHAR(255) PRIMARY KEY, 
    candidate_name TEXT,
    applying_for TEXT,
    application_date DATETIME,
    candidate_score INTEGER
    )`);

  //creates table that stores each candidate's report information
  db.run(`CREATE TABLE IF NOT EXISTS reports (
    report_id CHAR(255) PRIMARY KEY,
    candidate_id CHAR(255),
    technical_skills TEXT,
    work_experience TEXT,
    soft_skills TEXT,
    education TEXT,
    behavior TEXT,
    summary TEXT,
    strengths TEXT,
    weaknesses TEXT,
    fit TEXT,
    FOREIGN KEY (candidate_id) REFERENCES candidates (candidate_id)
    )`);

  //creates table that stores the individual scores of each individual report section
  db.run(`CREATE TABLE IF NOT EXISTS score_reports (
    report_id CHAR(255) PRIMARY KEY,
    candidate_id CHAR(255),
    tech_score INTEGER,
    work_score INTEGER,
    soft_score INTEGER,
    edu_score INTEGER,
    behav_score INTEGER,
    FOREIGN KEY (candidate_id) REFERENCES candidates (candidate_id)
    )`);
});

//saves candidate data into sqlite database and returns a unique candidate id
app.post("/api/candidates", (req, res) => {
  const { candidateName, applyingFor, applicationDate, candidateScore } = req.body;
  db.serialize(() => {

    let candidate_id = "C" + (new Date().getTime() + Math.floor(Math.random())).toString();

    db.run(`INSERT INTO candidates VALUES (?, ?, ?, ?, ?)`, [candidate_id, candidateName, applyingFor, applicationDate, candidateScore], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to create candidate', details: err });
      res.status(201).json({ candidate_id });
    });

    return candidate_id;

  });

});

//saves report (text) of the candidate skills into the database
app.post("/api/reports", (req, res) => {
  const { candidate_id, technical, work, soft, education, behavior, summary, strengths, weaknesses, fit } = req.body;
  db.serialize(() => {

    let report_id = "R" + (new Date().getTime() + Math.floor(Math.random())).toString();

    db.run(`INSERT INTO reports VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [report_id, candidate_id, technical, work, soft, education, behavior, summary, strengths, weaknesses, fit], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to create report', details: err });
      res.status(201).json({ report_id });
    });

  });
});

//saves report (scores) of the candidate skills into the database
app.post("/api/scores", (req, res) => {
  const { candidate_id, tech_score, work_score, soft_score, edu_score, behav_score } = req.body;
  db.serialize(() => {

    let report_id = "S" + (new Date().getTime() + Math.floor(Math.random())).toString();

    db.run(`INSERT into score_reports VALUES (?, ?, ?, ?, ?, ?, ?)`, [report_id, candidate_id, tech_score, work_score, soft_score, edu_score, behav_score], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to create score report', details: err });
      res.status(201).json({ report_id });
    });

  });
});

//look for all candidates
app.get("/api/candidates", (req, res) => {
  db.serialize(() => {
    db.all('SELECT * FROM candidates', [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching data: ' + err.message });
      } else {
        res.json(rows); // Directly send the rows as JSON response
      }
    });
  })
});

//look for pre-existing candidates in database
app.get("/api/candidates/:id", (req, res) => {
  const candidate_id = req.params.id;
  db.serialize(() => {
    db.all('SELECT * FROM candidates WHERE candidate_id = ?', [candidate_id], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching data: ' + err.message });
      } else {
        res.json(rows); // Directly send the rows as JSON response
      }
    });
  })
});

//look for report from specific candidate
app.get("/api/reports", (req, res) => {
  const { candidate_id } = req.query;
  db.serialize(() => {
    db.all(`SELECT * FROM reports WHERE candidate_id=?`, [candidate_id], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching data: ' + err.message });
      } else {
        res.json(rows); // Directly send the rows as JSON response
      }
    });
  })
});

//look for scores from the reports
app.get("/api/scores", (req, res) => {
  const { candidate_id } = req.query;
  db.serialize(() => {
    db.all(`SELECT * FROM score_reports WHERE candidate_id=?`, [candidate_id], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error fetching data: ' + err.message });
      } else {
        res.json(rows); // Directly send the rows as JSON response
      }
    });
  })
});

//deletes a candidate from the database
app.post("/api/delete", (req, res) => {
  const { candidate_id } = req.body;
  db.serialize(() => {
    db.run(`DELETE FROM candidates WHERE candidate_id = ?`, [candidate_id], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to delete candidate', details: err });
      db.run(`DELETE FROM reports WHERE candidate_id = ?`, [candidate_id], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to delete reports', details: err });
        db.run(`DELETE FROM score_reports WHERE candidate_id = ?`, [candidate_id], function (err) {
          if (err) return res.status(500).json({ error: 'Failed to delete score reports', details: err });
          res.status(201).json({ message: "Candidate deleted", candidate_id });
        });
      });
    });
  });
});

app.listen(3000, function () {
  console.log('App is listening on port 3000!');
});