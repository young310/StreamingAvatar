const express = require('express');
const OpenAI = require('openai')
const path = require('path');
const app = express();
app.use(express.json());
var threadId;
var threadByUser;
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
// const threadId = createThread().then(thread => {return thread.id;});
const model='gpt-4o-mini';
const thread = openai.beta.threads.create()
const assistantId = 'asst_5VWcFrAbaPmgul37WDRPvrKi';
let pollingInterval;
const systemSetup = "you are a recruiter from 勤業眾信, \
we are looking for a software engineer to join our team. \
Please introduce yourself and tell me about your experience and skills. \"";

// Set up a Thread
async function createThread() {
    console.log('Creating a new thread...');
    const thread = await openai.beta.threads.create();
    return thread;
}

async function addMessage(threadId, message) {
    console.log('Adding a new message to thread: ' + threadId);
    const response = await openai.beta.threads.messages.create(
        threadId,
        {
            role: "user",
            content: message
        }
    );
    return response;
}

async function runAssistant(threadId) {
    console.log('Running assistant for thread: ' + threadId)
    const response = await openai.beta.threads.runs.create(
        threadId,
        { 
          assistant_id: assistantId
          // Make sure to not overwrite the original instruction, unless you want to
        }
      );

    console.log(response)

    return response;
}

async function checkingStatus(res, threadId, runId) {
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
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
    });

    // Pass through status and content-type
    const contentType = response.headers.get('content-type') || 'application/json';
    res.status(response.status);
    res.set('content-type', contentType);
    const text = await response.text();
    res.send(text);
  } catch (err) {
    console.error('Error proxying HeyGen request:', err);
    res.status(502).json({ error: 'Bad gateway to HeyGen' });
  }
});

// app.post('/openai/complete', async (req, res) => {
//   try {
//     const prompt = req.body.prompt;
//     const chatCompletion = await openai.chat.completions.create({
//       messages: [
//         { role: 'system', content: systemSetup},
//         { role: 'user', content: prompt }
//       ],
//       model: 'gpt-4o',
//     });
//     res.json({ text: chatCompletion.choices[0].message.content });
//   } catch (error) {
//     console.error('Error calling OpenAI:', error);
//     res.status(500).send('Error processing your request');
//   }
// });

app.post('/openai/complete', async (req, res) => {
    // Create a new thread if it's the user's first message
  if (!threadByUser) {
    try {
      const myThread = await openai.beta.threads.create();
      console.log("New thread created with ID: ", myThread.id, "\n");
      threadByUser = myThread.id; // Store the thread ID for this user
    } catch (error) {
      console.error("Error creating thread:", error);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  }

  const userMessage = req.body.prompt;

  // Add a Message to the Thread
  try {
    const myThreadMessage = await openai.beta.threads.messages.create(
      threadByUser, // Use the stored thread ID for this user
      {
        role: "user",
        content: userMessage,
      }
    );
    console.log("This is the message object: ", myThreadMessage, "\n");

    // Run the Assistant
    const myRun = await openai.beta.threads.runs.create(
      threadByUser, // Use the stored thread ID for this user
      {
        assistant_id: assistantId,
      }
    );
    console.log("This is the run object: ", myRun, "\n");

    // Periodically retrieve the Run to check on its status
    const retrieveRun = async () => {
      let keepRetrievingRun;

      while (myRun.status !== "completed") {
        keepRetrievingRun = await openai.beta.threads.runs.retrieve(
          threadByUser, // Use the stored thread ID for this user
          myRun.id
        );

        console.log(`Run status: ${keepRetrievingRun.status}`);

        if (keepRetrievingRun.status === "completed") {
          console.log("\n");
          break;
        }
      }
    };
    retrieveRun();

    // Retrieve the Messages added by the Assistant to the Thread
    const waitForAssistantMessage = async () => {
      await retrieveRun();

      const allMessages = await openai.beta.threads.messages.list(
        threadByUser // Use the stored thread ID for this user
      );

      let AI_Response = allMessages.data[0].content[0].text.value;
      let User_Response = myThreadMessage.content[0].text.value;

      // Send the response back to the front end
      //   res.status(200).json({
      //     response: allMessages.data[0].content[0].text.value,
      //   });
      res.json({ text: AI_Response });
      console.log("------------------------------------------------------------ \n");
      console.log("User: ", User_Response);
      console.log("Assistant: ", AI_Response);

    };
    waitForAssistantMessage();
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});




//does the database things


//code about connecting to the database
const sqlite = require('sqlite3'); //adds sqlite functionality to code. Requires installation (npm install sqlite3)
const db = new sqlite.Database('./data.sqlite');

//creates all the tables in the database
db.serialize(()=>{
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

    db.run(`INSERT INTO candidates VALUES (?, ?, ?, ?, ?)`, [candidate_id, candidateName, applyingFor, applicationDate, candidateScore], function(err){
      if (err) return res.status(500).json({ error: 'Failed to create candidate', details: err });
      res.status(201).json({ candidate_id });
    });

    return candidate_id;
    
  });

});

//saves report (text) of the candidate skills into the database
app.post("/api/reports", (req, res) =>{
  const { candidate_id, technical, work, soft, education, behavior, summary, strengths, weaknesses, fit } = req.body;
  db.serialize(() => {

    let report_id = "R" + (new Date().getTime() + Math.floor(Math.random())).toString();

    db.run(`INSERT INTO reports VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [report_id, candidate_id, technical, work, soft, education, behavior, summary, strengths, weaknesses, fit], function(err){
      if (err) return res.status(500).json({ error: 'Failed to create report', details: err });
      res.status(201).json({ report_id });
    });
  
  });
});

//saves report (scores) of the candidate skills into the database
app.post("/api/scores", (req, res) =>{
  const { candidate_id, tech_score, work_score, soft_score, edu_score, behav_score } = req.body;
  db.serialize(()=>{

    let report_id = "S" + (new Date().getTime() + Math.floor(Math.random())).toString();
    
    db.run(`INSERT into score_reports VALUES (?, ?, ?, ?, ?, ?, ?)`, [report_id, candidate_id, tech_score, work_score, soft_score, edu_score, behav_score], function(err){
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
  db.serialize(()=>{
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
  db.serialize(()=>{
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
app.post("/api/delete", (req, res) =>{
  const {candidate_id} = req.body;
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
