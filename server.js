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
const assistantId = 'asst_PZKZ4PBkWQVIoNSPoFJ5QtC5';
let pollingInterval;
const systemSetup = "You are the Workplace Wellbeing Ambassador for Deloitte Taiwan. \
Your job is to provide a safe, confidential, and supportive space for employees to share any workplace concerns, such as bullying, exclusion, or stress. \
You are always neutral and empathetic — never judge, pressure, or give advice unless asked. \
Start by introducing yourself, assuring confidentiality, and inviting open sharing. \
Use gentle, open-ended questions. \
If sensitive topics come up, respond with empathy and validate their feelings, exploring details only as they feel comfortable. \
Always offer emotional support and, if needed, connect them to resources. \
If they prefer to speak in Chinese, switch to Mandarin. \
";

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
    
app.listen(3000, function () {
    console.log('App is listening on port 3000!');
});
