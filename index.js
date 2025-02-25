'use strict';

const heygen_API = {
  apiKey: '',
  serverUrl: 'https://api.heygen.com',
};

const statusElement = document.querySelector('#status');
const apiKey = heygen_API.apiKey;
const SERVER_URL = heygen_API.serverUrl;

if (apiKey === 'YourApiKey' || SERVER_URL === '') {
  alert('Please enter your API key and server URL in the api.json file');
}

let sessionInfo = null;
let peerConnection = null;

// let subSentences = [];
var userTrans = [];
var compTrans = [];
//create global array to store all the assistant's responses
var responseArray = [];
var responseCount = 0;

function updateStatus(statusElement, message) {
  //statusElement.innerHTML += message + '<br>';
  statusElement.innerHTML = message;
  statusElement.scrollTop = statusElement.scrollHeight;
}

updateStatus(statusElement, 'Please click the new button to create the stream first.');

function onMessage(event) {
  const message = event.data;
  console.log('Received message:', message);
}

// Create a new WebRTC session when clicking the "New" button
async function createNewSession() {
  updateStatus(statusElement, 'Creating new session... please wait');

  const avatar = avatarID.value;
  const voice = voiceID.value;

  // call the new interface to get the server's offer SDP and ICE server to create a new RTCPeerConnection
  sessionInfo = await newSession('high', avatar, voice);
  const { sdp: serverSdp, ice_servers2: iceServers } = sessionInfo;

  // Create a new RTCPeerConnection
  peerConnection = new RTCPeerConnection({ iceServers: iceServers });

  // When audio and video streams are received, display them in the video element
  peerConnection.ontrack = (event) => {
    console.log('Received the track');
    if (event.track.kind === 'audio' || event.track.kind === 'video') {
      mediaElement.srcObject = event.streams[0];
    }
  };

  // When receiving a message, display it in the status element
  peerConnection.ondatachannel = (event) => {
    const dataChannel = event.channel;
    dataChannel.onmessage = onMessage;
  };

  // Set server's SDP as remote description
  const remoteDescription = new RTCSessionDescription(serverSdp);
  await peerConnection.setRemoteDescription(remoteDescription);

  updateStatus(statusElement, 'Session creation completed');
  updateStatus(statusElement, 'Now. You can click the start button to start the stream');
}

// Start session and display audio and video when clicking the "Start" button
async function startAndDisplaySession() {

  document.getElementById("badcode").innerHTML = "playing";

  if (!sessionInfo) {
    updateStatus(statusElement, 'Please create a connection first');
    return;
  }

  updateStatus(statusElement, 'Starting session... please wait');

  // Create and set local SDP description
  const localDescription = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(localDescription);

 // When ICE candidate is available, send to the server
  peerConnection.onicecandidate = ({ candidate }) => {
    console.log('Received ICE candidate:', candidate);
    if (candidate) {
      handleICE(sessionInfo.session_id, candidate.toJSON());
    }
  };

  // When ICE connection state changes, display the new state
  peerConnection.oniceconnectionstatechange = (event) => {
    updateStatus(
      statusElement,
      `ICE connection state changed to: ${peerConnection.iceConnectionState}`,
    );
  };



  // Start session
  await startSession(sessionInfo.session_id, localDescription);

  var receivers = peerConnection.getReceivers();
  
  receivers.forEach((receiver) => {
    receiver.jitterBufferTarget = 500
  });

   updateStatus(statusElement, 'Session started successfully');
}

const taskInput = document.querySelector('#taskInput');

// When clicking the "Send Task" button, get the content from the input field, then send the task
async function repeatHandler() {
  if (!sessionInfo) {
    updateStatus(statusElement, 'Please create a connection first');

    return;
  }
  updateStatus(statusElement, 'Sending task... please wait');
  const text = taskInput.value;
  if (text.trim() === '') {
    alert('Please enter a task');
    return;
  }

  const resp = await repeat(sessionInfo.session_id, text);

  updateStatus(statusElement, 'Task sent successfully');
}

async function talkHandler() {
  if (!sessionInfo) {
    updateStatus(statusElement, 'Please create a connection first');
    return;
  }
  const prompt = taskInput.value; // Using the same input for simplicity
  if (prompt.trim() === '') {
    alert('Please enter a prompt for the LLM');
    return;
  }

  //adds the first user prompt into the user transcription array
  if(userTrans.length == 0){
    userTrans.push(prompt);
  }

  updateStatus(statusElement, 'Talking to LLM... please wait');

  try {
    const text = await talkToOpenAI(prompt)

    //checks if any part of the text is JSON, and forcefully ends if the connection
    for(let i = 0; i < text.length; i++){
      if (text.charAt(i) == "{"){
        closeConnectionHandler();
        let jsonStart = text.indexOf("{");
        let jsonEnd = text.lastIndexOf("}");
        responseArray[responseCount-1] = text.substring(jsonStart, jsonEnd+1);
        return;
      }
    }

    if (text) {
      // Send the AI's response to Heygen's streaming.task API
      const resp = await repeat(sessionInfo.session_id, text);
      updateStatus(statusElement, 'LLM response sent successfully');
    } else {
      updateStatus(statusElement, 'Failed to get a response from AI');
    }

    // displays subtitles and changes sentences based on sentence length
    // let subs = document.getElementById("subs");
    
    // let timeCounter = 0;
    // for(let i = 0; i < subSentences.length; i++){

    //   if(i == 0){
    //     timeCounter += 0;
    //   }
    //   else{
    //     let lang = document.getElementById("languageDrop").value;
    //     let wordCounter =[];
    //     if (lang == "Chinese" || lang == "Japanese"){
    //       wordCounter = subSentences[i-1].split("");
    //     }
    //     else{
    //       wordCounter = subSentences[i-1].split(" ");
    //     }

    //     console.log(wordCounter)
        
    //     if (wordCounter.length <= 2){
    //       timeCounter += 1000;
    //     }
    //     else if (wordCounter.length > 2 && wordCounter.length <= 10){
    //       timeCounter += 3000;
    //     }
    //     else if (wordCounter.length > 10 && wordCounter.length <= 18){
    //       timeCounter += 6000;
    //     }
    //     else if (wordCounter.length > 18 && wordCounter.length <= 26){
    //       timeCounter += 9000;
    //     }
    //     else if (wordCounter.length > 26 && wordCounter.length <= 34){
    //       timeCounter += 12000;
    //     }
    //     else{
    //       timeCounter += 15000;
    //     }
    //   }

    //   setTimeout(() =>{
    //     subs.innerHTML = subSentences[i];
    //   }, timeCounter)
    // }
    // subs.innerHTML = "";
    

  } catch (error) {
    console.error('Error talking to AI:', error);
    updateStatus(statusElement, 'Error talking to AI');
  }
}


// when clicking the "Close" button, close the connection
async function closeConnectionHandler() {

  document.getElementById("badcode").innerHTML = "not playing";

  if (!sessionInfo) {
    updateStatus(statusElement, 'Please create a connection first');
    return;
  }

  renderID++;
  // hideElement(canvasElement);
  // hideElement(bgCheckboxWrap);
  mediaCanPlay = false;

  updateStatus(statusElement, 'Closing connection... please wait');
  try {
    // Close local connection
    peerConnection.close();
    // Call the close interface
    const resp = await stopSession(sessionInfo.session_id);

    console.log(resp);
  } catch (err) {
    console.error('Failed to close the connection:', err);
  }
  updateStatus(statusElement, 'Connection closed successfully');


  // document.getElementById("subs").innerHTML = "";

  
  //stores the transcript into arrays
  //let transcript = responseJSON.conversation.transcription.split("\n");

  // for(let i = 0; i < transcript.length; i++){
  //   if (transcript[i].substring(0, 9) == "Assistant"){
  //     compTrans.push(transcript[i]);
  //   }
  //   else{
  //     userTrans.push(transcript[i]);
  //   }
  // }

  //gets deletes thread and uploads folder
  const response = await fetch(`http://localhost:3000/openai/destroy`, {
    method: 'POST',
  });

  if (response.status === 500) {
    console.error('Server error');
    updateStatus(
      statusElement,
      'Server Error. Please make sure to set the openai api key',
    );
    throw new Error('Server error');
  }
  else{
    console.log("deleted successfully!");
  }

}

document.querySelector('#newBtn').addEventListener('click', createNewSession);
document.querySelector('#startBtn').addEventListener('click', startAndDisplaySession);
document.querySelector('#repeatBtn').addEventListener('click', repeatHandler);
document.querySelector('#closeBtn').addEventListener('click', closeConnectionHandler);
document.querySelector('#talkBtn').addEventListener('click', talkHandler);


// new session
async function newSession(quality, avatar_name, voice_id) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.new`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      quality,
      avatar_name,
      voice: {
        voice_id: voice_id,
      },
    }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(
      statusElement,
      'Server Error. Please ask the staff if the service has been turned on',
    );

    throw new Error('Server error');
  } else {
    const data = await response.json();
    console.log(data.data);
    return data.data;
  }
}

// start the session
async function startSession(session_id, sdp) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ session_id, sdp }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(
      statusElement,
      'Server Error. Please ask the staff if the service has been turned on',
    );
    throw new Error('Server error');
  } else {
    const data = await response.json();
    return data.data;
  }
}

// submit the ICE candidate
async function handleICE(session_id, candidate) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.ice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ session_id, candidate }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(
      statusElement,
      'Server Error. Please ask the staff if the service has been turned on',
    );
    throw new Error('Server error');
  } else {
    const data = await response.json();
    return data;
  }
}

async function talkToOpenAI(prompt) {
  const response = await fetch(`http://localhost:3000/openai/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(
      statusElement,
      'Server Error. Please make sure to set the openai api key',
    );
    throw new Error('Server error');
  } else {
    const data = await response.json();

    //puts all the responses into an array I can use elsewhere
    responseArray.push(data.text);
    responseCount = responseCount + 1;
    console.log(data.text);

    //does subtitle stuff
    // subSentences = [];
    // let cutoff = 0;
    // for(let i = 0; i < data.text.length; i++){
    //   if (data.text.charAt(i) == "!" || data.text.charAt(i) == "." || data.text.charAt(i) == "?" || data.text.charAt(i) =="！" || data.text.charAt(i) == "？" || data.text.charAt(i) == "。" ){
    //     subSentences.push(data.text.substring(cutoff, i));
    //     cutoff = i+1;
    //   }
    // }

    return data.text;
  }
}

// repeat the text
async function repeat(session_id, text) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ session_id, text }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(
      statusElement,
      'Server Error. Please ask the staff if the service has been turned on',
    );
    throw new Error('Server error');
  } else {
    const data = await response.json();
    return data.data;
  }
}

// stop session
async function stopSession(session_id) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.stop`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ session_id }),
  });
  if (response.status === 500) {
    console.error('Server error');
    updateStatus(statusElement, 'Server Error. Please ask the staff for help');
    throw new Error('Server error');
  } else {
    const data = await response.json();
    return data.data;
  }
}

/*
const removeBGCheckbox = document.querySelector('#removeBGCheckbox');
removeBGCheckbox.addEventListener('click', () => {
  const isChecked = removeBGCheckbox.checked; // status after click

  if (isChecked && !sessionInfo) {
    updateStatus(statusElement, 'Please create a connection first');
    removeBGCheckbox.checked = false;
    return;
  }

  if (isChecked && !mediaCanPlay) {
    updateStatus(statusElement, 'Please wait for the video to load');
    removeBGCheckbox.checked = false;
    return;
  }

  if (isChecked) {
    hideElement(mediaElement);
    showElement(canvasElement);

    renderCanvas();
  } else {
    hideElement(canvasElement);
    showElement(mediaElement);

    renderID++;
  }
});
*/

let renderID = 0;
function renderCanvas() {
  if (!removeBGCheckbox.checked) return;
  hideElement(mediaElement);
  showElement(canvasElement);

  canvasElement.classList.add('show');

  const curRenderID = Math.trunc(Math.random() * 1000000000);
  renderID = curRenderID;

  const ctx = canvasElement.getContext('2d', { willReadFrequently: true });

  if (bgInput.value) {
    canvasElement.parentElement.style.background = bgInput.value?.trim();
  }

  function processFrame() {
    if (!removeBGCheckbox.checked) return;
    if (curRenderID !== renderID) return;

    canvasElement.width = mediaElement.videoWidth;
    canvasElement.height = mediaElement.videoHeight;

    ctx.drawImage(mediaElement, 0, 0, canvasElement.width, canvasElement.height);
    ctx.getContextAttributes().willReadFrequently = true;
    const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const red = data[i];
      const green = data[i + 1];
      const blue = data[i + 2];

      // You can implement your own logic here
      if (isCloseToGreen([red, green, blue])) {
        // if (isCloseToGray([red, green, blue])) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    requestAnimationFrame(processFrame);
  }

  processFrame();
}

function isCloseToGreen(color) {
  const [red, green, blue] = color;
  return green > 90 && red < 90 && blue < 90;
}

function hideElement(element) {
  element.classList.add('hide');
  element.classList.remove('show');
}
function showElement(element) {
  element.classList.add('show');
  element.classList.remove('hide');
}

const mediaElement = document.querySelector('#mediaElement');
let mediaCanPlay = false;
mediaElement.onloadedmetadata = () => {
  mediaCanPlay = true;
  mediaElement.play();

  // showElement(bgCheckboxWrap);
};





//upload button functionality

// Set workerSrc for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

document.getElementById("uploadBtn").addEventListener("click", ()=>{
  document.getElementById("uploadBlock").style.display = "flex";
});

document.getElementById("uploadBlock").addEventListener("submit", function (e) {
  e.preventDefault(); // Prevents default form submission
  updateStatus(statusElement, "Uploading File...");

  const formData = new FormData(this); // Creates FormData object with form data
  const fileInput = document.getElementById("formatfile");

  if (fileInput.files.length === 0) {
    alert("Please select a file!");
    return;
  }

  fetch("/openai/upload", {
    method: "POST",
    body: formData, // Sends the formData (file) to the server
  })
  .then(response => response.json())
  .then(data => {
    console.log("Success:", data);
    updateStatus(statusElement, "Upload Successful!");
  })
  .catch(error => {
    console.error("Error:", error);
  });
  
});


//pdf display
const fileInput = document.getElementById('formatfile');
const pdfContainer = document.getElementById('pdfContainer');

// Handle the file input change event
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();

    // When the file is read, render the PDF pages
    reader.onload = function(e) {
      const pdfData = new Uint8Array(e.target.result);

      pdfContainer.innerHTML = '';

      // Use PDF.js to render the PDF
      pdfjsLib.getDocument(pdfData).promise.then(function(pdf) {
        // Loop through each page and render it
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          pdf.getPage(pageNum).then(function(page) {
            const scale = window.innerWidth/1500; // Adjust scale for better visibility
            const viewport = page.getViewport({ scale: scale });

            // Create a canvas element to render the page
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Append the canvas to the container
            pdfContainer.appendChild(canvas);

            // Get the rendering context
            const context = canvas.getContext('2d');

            // Render the page on the canvas
            page.render({
              canvasContext: context,
              viewport: viewport
            });
          });
        }
      });
    };

    // Read the PDF file as binary string
    reader.readAsArrayBuffer(file);
  }
});









//stuff about the the buttons on the html
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
        
//determines recognition language based on dropdown selection
var selector = document.getElementById("languageDrop");
var selectedLang = selector.value;
recognition.lang = "en-US";
var speechStarted = false;
recognition.continuous = true;
var transStore = [];

selector.addEventListener("change", function(){
  var selectedLang = this.value;
  console.log(selectedLang);
  if (selectedLang == "English"){
    recognition.lang = "en-US";
  }
  if (selectedLang == "Chinese"){
    recognition.lang = "zh-TW";
  }
  if (selectedLang == "Japanese"){
    recognition.lang = "ja";
  }
  if (selectedLang == "German"){
    recognition.lang = "de";
  }
  if (selectedLang == "French"){
    recognition.lang = "fr";
  }
  if (selectedLang == "Italian"){
    recognition.lang = "it";
  }
  if (selectedLang == "Spanish"){
    recognition.lang = "es";
  }
});



const startButton = document.getElementById('speachBtn');
const outputDiv = document.getElementById('output');
const talkBtn = document.getElementById('talkBtn');
const endBtn = document.getElementById('endSpeech');
const closeUpload = document.getElementById('closeUpload');
recognition.onstart = () => {
    startButton.textContent = 'Listening...';
};

recognition.onresult = (event) => {
    const transcript = event.results[event.resultIndex][0].transcript;
    transStore.push(transcript);
    // outputDiv.textContent = transcript;
};

recognition.onend = () =>{
  startButton.textContent = 'Start Voice Input';
  let allTrans = "";
  for(let i = 0; i < transStore.length; i++){
    allTrans += transStore[i];
  }
  taskInput.value = allTrans;
  talkBtn.click();
  console.log(allTrans);
  transStore = []
};

startButton.addEventListener('click', () =>{
  recognition.start();
  endBtn.style.display = "initial";
});

endBtn.addEventListener('click', ()=>{
  recognition.stop();
  endBtn.style.display = "none";
});

closeUpload.addEventListener('click', ()=>{
  document.getElementById('uploadBlock').style.display = "none";
})


//shortcut buttons
addEventListener("keydown", function(e){;

  //checks if Wayne is on screen
  if(document.getElementById("badcode").innerHTML=="playing"){
    //lets user start talking by pressing the "1" key
    if(e.key == "1"){
      startButton.click();
    }

    if(e.key == "2"){
      endBtn.click();
    }

    //lets user hide the status bar by pressing the "3" key
    if(e.key == "3"){
    var statusBlock = document.getElementById("statusBlock");
    var leftButtons = document.getElementById("leftButtons");
    if (statusBlock.style.display !="none" && leftButtons.style.display !="none"){
      statusBlock.style.display = "none";
      leftButtons.style.display = "none";
    }
    else{
      statusBlock.style.display = "flex";
      leftButtons.style.display = "initial";
    }
  }
  };
});