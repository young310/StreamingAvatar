const express = require('express');
const OpenAI = require('openai')
const path = require('path');
const app = express();
app.use(express.json());
var threadId;
var threadByUser;
const openai = new OpenAI({
  apiKey: "",
  defaultHeaders: { 'OpenAI-Beta': 'assistants=v2' }
});
// const threadId = createThread().then(thread => {return thread.id;});
const model='gpt-4o-mini';
const thread = openai.beta.threads.create()
const assistantId = '';
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

      // Send the response back to the front end
    //   res.status(200).json({
    //     response: allMessages.data[0].content[0].text.value,
    //   });
        res.json({ text: allMessages.data[0].content[0].text.value });
      console.log(
        "------------------------------------------------------------ \n"
      );

      console.log("User: ", myThreadMessage.content[0].text.value);
      console.log("Assistant: ", allMessages.data[0].content[0].text.value);
    };
    waitForAssistantMessage();
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
  


//upload things

const fs = require('fs');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb){

    const uploadDir = 'uploads/';
    if(!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir);
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb){
    cb(null, file.originalname);
  }
})
const upload = multer({storage: storage});

app.post('/openai/upload', upload.single('file'), async (req, res) => {
  try{

    //creates file in local storage first because it's annoying like that


    //creates an openai file
    const pdfFile = await openai.files.create({
      file: fs.createReadStream(req.file.path),
      purpose: "assistants"
    });

    console.log(pdfFile);
    
    //puts file into the thread

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

    const myThreadMessage = await openai.beta.threads.messages.create(
      threadByUser, // Use the stored thread ID for this user
      {
        role: "user",
        content: "  ",
        attachments: [
          {file_id: pdfFile.id, tools: [{ type: 'file_search'}]}
        ]
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

      // Send the response back to the front end
    //   res.status(200).json({
    //     response: allMessages.data[0].content[0].text.value,
    //   });
        res.json({ text: allMessages.data[0].content[0].text.value });
      console.log(
        "------------------------------------------------------------ \n"
      );

      console.log("User: ", myThreadMessage.content[0].text.value);
      console.log("Assistant: ", allMessages.data[0].content[0].text.value);
    };
    waitForAssistantMessage();

  }
  catch (error){
    console.error("Error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

//deletes thread and all uploaded files
app.post('/openai/destroy', async (req, res) => {
  await openai.beta.threads.del(threadByUser);
  const folderPath = path.join(__dirname, 'uploads/'); // path to the folder

  if(fs.existsSync(folderPath)){
    // Use fs.rm for recursive deletion (Node 16+)
    fs.rm(folderPath, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error('Error deleting folder:', err);
      } else {
        console.log('Folder deleted successfully!');
      }
    });
  }
});

app.listen(3000, function () {
  console.log('App is listening on port 3000!');
});