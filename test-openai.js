require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: { 'OpenAI-Beta': 'assistants=v2' }
});

const assistantId = 'asst_PZKZ4PBkWQVIoNSPoFJ5QtC5';

async function testOpenAI() {
  try {
    console.log("Creating thread...");
    const thread = await openai.beta.threads.create();
    console.log("Thread created:", thread.id);

    console.log("Creating message...");
    const message = await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: "Hello, test message"
    });
    console.log("Message created:", message.id);

    console.log("Creating run...");
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId
    });
    console.log("Run created:", run.id, "Status:", run.status);

    console.log("Retrieving run...");
    const retrievedRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    console.log("Run retrieved successfully:", retrievedRun.id, "Status:", retrievedRun.status);

  } catch (error) {
    console.error("Error:", error);
  }
}

testOpenAI();