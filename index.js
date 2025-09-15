'use strict';
import * as cand from './candidate.js';
import * as chartmaker from './chartmaker.js';

const heygen_API = {
  // Use server-side proxy; no API key in browser
  serverUrl: '/heygen',
};
const statusElement = document.querySelector('#status');
const SERVER_URL = heygen_API.serverUrl;

let sessionInfo = null;
let peerConnection = null;

//create global array to store all the assistant's responses
var responseArray = [];
var responseCount = 0;
// let subSentences = [];

//keeps track of all the candidates in the database
let preCand = await cand.fetchAllCandidates();
if(preCand.length != 0){
  for(let i = 0; i < preCand.length; i++){
    //creates rows on the table based on pre-existing candidate data
    cand.createCandidateRow(preCand[i].candidate_name, preCand[i].applying_for, preCand[i].application_date, preCand[i].candidate_score, preCand[i].candidate_id);
  }
}

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
  document.getElementById("startBtn").click();
}

// Start session and display audio and video when clicking the "Start" button
async function startAndDisplaySession() {
  console.log("hello");

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

  
  document.getElementById("main").style.display = "initial";
  document.getElementById("startup").style.display = "none";
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

  updateStatus(statusElement, 'Talking to LLM... please wait');

  try {
    const text = await talkToOpenAI(prompt)

    //checks if the text contains JSON, and forcefully ends if the connection
    for(let i = 0; i < text.length; i++){
      if (text.charAt(i) == "{"){
        closeConnectionHandler();
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
    

  } catch (error) {
    console.error('Error talking to AI:', error);
    updateStatus(statusElement, 'Error talking to AI');
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

    //checks if the text contains JSON and chops it up to put it in the array
    let newText = data.text;
    for(let i = 0; i < data.text.length; i++){
      if (data.text.charAt(i) == "{"){
        let htmlStart = data.text.indexOf("{");
        let htmlEnd = data.text.lastIndexOf("}");
        newText = data.text.substring(htmlStart, htmlEnd+1);
      }
    }

    responseArray.push(newText);
    responseCount = responseCount + 1;
    console.log(newText);

    return data.text;
  }
}

// repeat the text
async function repeat(session_id, text) {
  const response = await fetch(`${SERVER_URL}/v1/streaming.task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

let renderID = 0;

const mediaElement = document.querySelector('#mediaElement');
let mediaCanPlay = false;
mediaElement.onloadedmetadata = () => {
  mediaCanPlay = true;
  mediaElement.play();

  // showElement(bgCheckboxWrap);
};

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

  //code for creating the results page starts here

  //hide original interface
  document.getElementById("main").style.display="none";
  document.getElementById("results").style.display="initial";
  // document.getElementById("subs").innerHTML = "";

  console.log(responseArray[responseCount-1]);

  //extracts the data from the JSON
  let responseJSON = JSON.parse(responseArray[responseCount-1]);

  let name = responseJSON.candidate_profile.name;
  let applyingFor = responseJSON.candidate_profile.applying_for;
  let strengths = responseJSON.report.strengths;
  let weaknesses = responseJSON.report.weaknesses;
  let fit = responseJSON.report.fit_description;
  let score = responseJSON.report.overall_score;
    
  let technical = responseJSON.report.scores.technical_skills.description;
  let work = responseJSON.report.scores.work_or_project_experience.description;
  let soft = responseJSON.report.scores.soft_skills.description;
  let education = responseJSON.report.scores.educational_background.description;
  let behavior = responseJSON.report.scores.interview_behavior.description;
  let summary = responseJSON.report.summary;

  let techscore = responseJSON.report.scores.technical_skills.score;
  let workscore = responseJSON.report.scores.work_or_project_experience.score;
  let softscore = responseJSON.report.scores.soft_skills.score;
  let eduscore = responseJSON.report.scores.educational_background.score;
  let bescore = responseJSON.report.scores.interview_behavior.score;

  //updates the SQL databases
  let currentDate = new Date();
  let formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

  let candidate_id = await cand.createCandidateData(name, applyingFor, formattedDate, score);
  await cand.updateCandidateReport(candidate_id, technical, work, soft, education, behavior, summary, strengths, weaknesses, fit);
  await cand.updateScoreReport(candidate_id, techscore, workscore, softscore, eduscore, bescore);

  //creates report for the candidate
  cand.createReportSummary(candidate_id, name, applyingFor, strengths, weaknesses, fit);
  cand.createReportDetails(technical, work, soft, education, behavior, summary);
  cand.createReportCharts([eduscore, softscore, bescore, workscore, techscore], score);

  //creates the candidate in the list
  cand.createCandidateRow(name, applyingFor, formattedDate, score, candidate_id);

  //updates the preCand array
  preCand = await cand.fetchAllCandidates();

  //adds the ranking to the report
  let sortFiltered = cand.filterCandidates(preCand, applyingFor);
  let rank = 0;
  for(let i = 0; i < sortFiltered.length; i++){
    if (sortFiltered[i].candidate_id == candidate_id){
      rank = i+1;
    }
  }
  document.getElementById("resultsRank").innerHTML = `<i>ranked #${rank} in ${applyingFor}</i>`;
}


//moves to individual candidate report page when you click on a candidate row
document.getElementById("candidateTable").addEventListener("click", (event)=>{
  const listRow = event.target.closest(".candidateRow");
  if(listRow){
    let rowId = listRow.id;
    let pcand;
    let prep;
    let pscore;
    cand.fetchCandidate(rowId).then(result => {
      pcand = result[0];
      // Optionally chain further actions here after this async operation completes
      return cand.fetchReportData(rowId);
    }).then(result => {
      prep = result[0];
      // Now you can call the next one
      return cand.fetchReportScores (rowId);
    }).then(result => {
      pscore = result[0];

      let sortFiltered = cand.filterCandidates(preCand, pcand.applying_for);
      let rank = 0;
      for(let i = 0; i < sortFiltered.length; i++){
        if (sortFiltered[i].candidate_id == rowId){
          rank = i+1;
        }
      }
      document.getElementById("resultsRank").innerHTML = `<i>ranked #${rank} in ${pcand.applying_for}</i>`
      cand.createReportSummary(pcand.candidate_id, pcand.candidate_name, pcand.applying_for, prep.strengths, prep.weaknesses, prep.fit);
      cand.createReportDetails(prep.technical_skills, prep.work_experience, prep.soft_skills, prep.education, prep.behavior, prep.summary);
      cand.createReportCharts([pscore.edu_score, pscore.soft_score, pscore.behav_score, pscore.work_score, pscore.tech_score], pcand.candidate_score);
    })
    document.getElementById("results").style.display = "initial";
    document.getElementById("list").style.display = "none";
  }
});
