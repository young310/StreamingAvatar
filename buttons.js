// Whisper language codes mapped from dropdown values
const LANG_MAP = {
  Chinese: 'zh',
  English: 'en',
  Japanese: 'ja',
  German: 'de',
  French: 'fr',
  Italian: 'it',
  Spanish: 'es',
};

const selector = document.getElementById('languageDrop');
const startButton = document.getElementById('speachBtn');
const taskInput = document.getElementById('taskInput');
const talkBtn = document.getElementById('talkBtn');
const endBtn = document.getElementById('endSpeech');

// Update placeholder when language changes
selector.addEventListener('change', function () {
  const lang = this.value;
  const placeholders = {
    English: 'What would you like to know about Elvis?',
    Chinese: '想了解 Elvis 什麼呢？',
    Japanese: 'Elvisについて何を知りたいですか？',
    German: 'Was möchten Sie über Elvis erfahren?',
    French: 'Que souhaitez-vous savoir sur Elvis ?',
    Italian: 'Cosa vorresti sapere su Elvis?',
    Spanish: '¿Qué te gustaría saber sobre Elvis?',
  };
  taskInput.placeholder = placeholders[lang] || placeholders.Chinese;
});

// ---- MediaRecorder + Whisper ----
let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let isRecording = false;

async function startRecording() {
  if (isRecording) return;
  try {
    audioChunks = [];
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(audioStream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.start();
    isRecording = true;
    console.log('Recording started');
  } catch (err) {
    console.error('Failed to start recording:', err);
  }
}

async function stopRecordingAndTranscribe() {
  if (!isRecording || !mediaRecorder || mediaRecorder.state === 'inactive') return;

  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      // Release microphone
      if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
      isRecording = false;

      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      if (audioBlob.size === 0) { resolve(); return; }

      // Send to Whisper
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', LANG_MAP[selector.value] || 'zh');

      try {
        const resp = await fetch('/openai/transcribe', { method: 'POST', body: formData });
        const data = await resp.json();
        if (data.text && data.text.trim()) {
          taskInput.value = data.text;
          talkBtn.click(); // auto-send
        }
      } catch (err) {
        console.error('Whisper transcription error:', err);
      }
      resolve();
    };
    mediaRecorder.stop();
    console.log('Recording stopped, transcribing…');
  });
}

// Mic button: start recording
startButton.addEventListener('click', () => {
  startRecording();
  endBtn.style.display = 'initial';
  startButton.style.display = 'none';
});

// Stop button: stop recording & transcribe
endBtn.addEventListener('click', () => {
  stopRecordingAndTranscribe();
  endBtn.style.display = 'none';
  startButton.style.display = 'initial';
});

// ---- Keyboard shortcuts ----
let typing = false;

addEventListener('keydown', function (e) {
  // Skip shortcuts when typing in input
  const active = document.activeElement;
  const inInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

  if (!inInput) {
    if (e.key === '1') startButton.click();
    if (e.key === '2') endBtn.click();
    if (e.key === '3') {
      const statusBlock = document.getElementById('statusBlock');
      statusBlock.style.display = statusBlock.style.display !== 'none' ? 'none' : 'flex';
    }
  }

  // Enter to send when typing
  if (typing && e.key === 'Enter') {
    talkBtn.click();
    taskInput.value = '';
    talkBtn.style.display = 'none';
    startButton.style.display = 'initial';
    typing = false;
  }
});

// Toggle send / mic button based on input content
taskInput.addEventListener('input', () => {
  if (taskInput.value === '') {
    talkBtn.style.display = 'none';
    startButton.style.display = 'initial';
    typing = false;
  } else {
    talkBtn.style.display = 'initial';
    startButton.style.display = 'none';
    typing = true;
  }
});

// Loading animation when "Start Chat" is pressed
document.getElementById('newBtn').addEventListener('click', () => {
  const btn = document.getElementById('newBtn');
  btn.textContent = 'Starting Up';
  const loader = document.createElement('div');
  loader.id = 'loader';
  loader.style.display = 'initial';
  btn.appendChild(loader);
});
