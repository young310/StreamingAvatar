import * as cand from './candidate.js';
import * as chartmaker from './chartmaker.js';

let allCandidates = await cand.fetchAllCandidates();

//stuff about the buttons on the html
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
        
//determines recognition language based on dropdown selection
var selector = document.getElementById("languageDrop");
var selectedLang = selector.value;
recognition.lang = "en-US";

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
recognition.onstart = () => {
    startButton.textContent = 'Listening...';
};

recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    taskInput.value = transcript;
    talkBtn.click();
    // outputDiv.textContent = transcript;
};

recognition.onend = () =>{
  startButton.textContent = 'Start Voice Input';
};

startButton.addEventListener('click', () =>{
  recognition.start();
});

addEventListener("keydown", function(e){;

  //checks if Wayne is on screen
  if(document.getElementById("badcode").innerHTML=="playing"){
    //lets user start talking by pressing the "s" key
    if(e.key == "1"){
      recognition.start();
    }

    //lets user hide the status bar by pressing the "h" key
    if(e.key == "2"){
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



// document.getElementById("changepage").addEventListener("click", function(){
//   if(document.getElementById("main").style.display != "none"){
//     document.getElementById("main").style.display="none";
//     document.getElementById("results").style.display="initial";
//   }
//   else{
//     document.getElementById("main").style.display="initial";
//     document.getElementById("results").style.display="none";
    
//   }
// });



//stuff on the compare page
let selected = false; //checks if a user is currently selecting a comparison target
document.getElementById("compareContainer").addEventListener("click", (event)=>{

  //checks which side is currently being worked
  let workedSide = event.target.closest(".compareBox");
  let listCreated = false; //checks if the list has been created within the clicked comparison box
  let selectedList; //grabs the comparison list of the side the user is currently working on
  for(let i = 0; i < workedSide.children.length; i++){ //checks if the list has been created beforehand
    if(workedSide.children[i].classList.contains("compareList")){
      listCreated = true;
    }
  }

  //creates the comparison screen if user clicks on the comparison list
  if(listCreated){
    for(let i = 0; i < workedSide.children.length; i++){
      if(workedSide.children[i].classList.contains("compareList")){
        selectedList = workedSide.children[i]; //marks down the list of the side the user is working on
      }
    }
    let chosenCandidate = event.target.closest(".compareSelection"); //ensures user can only click on the candidate options
    if(selectedList.style.display != "none" && chosenCandidate){
      let candidateid = event.target.closest(".compareSelection").lastChild.innerHTML; //grabs the candidate id from the hidden div
      let candidateJSON;
      cand.fetchCandidate(candidateid).then(result => {
        candidateJSON = result;
        return cand.fetchReportScores(candidateid);
      }).then(result =>{
        let scoreJSON = result;
        let returnButton = document.createElement("p");
        returnButton.innerHTML = "&#129136";
        returnButton.classList.add("returnToList");
        let name = document.createElement("h2");
        name.innerHTML = candidateJSON[0].candidate_name;
        let rank = document.createElement("p");

        let sortedCandidates = cand.filterCandidates(allCandidates, candidateJSON[0].applying_for);
        for(let i = 0; i < sortedCandidates.length; i++){
          if(sortedCandidates[i].candidate_id == candidateid){
            rank.innerHTML = "<i>ranked #" + (i+1) + " applying for " + sortedCandidates[i].applying_for +"</i>";
          }
        }

        let graph = document.createElement("canvas");
        graph.setAttribute("id", "compare" + candidateJSON[0].candidate_id);
        graph.style.width = "50%";
        graph.style.maxWidth = "16vw";

        let changeView = document.createElement("p");
        changeView.classList.add("changeCompareView");
        changeView.innerHTML = "Change View";

        let scorebox = document.createElement("div");
        scorebox.classList.add("scoreBox");
        let scoreTitles = document.createElement("div");
        scoreTitles.classList.add("scoreTitles");
        let technical = document.createElement("p");
        technical.innerHTML = "Technical Ability";
        let work = document.createElement("p");
        work.innerHTML = "Work Experience";
        let education = document.createElement("p");
        education.innerHTML = "Education";
        let soft = document.createElement("p");
        soft.innerHTML = "Soft Skills";
        let behavior = document.createElement("p");
        behavior.innerHTML = "Interview Behavior";

        let scoreBars = document.createElement("div");
        scoreBars.classList.add("scoreBars");
        let techBar = document.createElement("div");
        techBar.classList.add("techBar");
        techBar.style.width = (scoreJSON[0].tech_score / 5)*100 + "%"; //adds the width of the score bars
        let workBar = document.createElement("div");
        workBar.classList.add("workBar");
        workBar.style.width = `${(scoreJSON[0].work_score / 5)*100}%`;
        let eduBar = document.createElement("div");
        eduBar.classList.add("eduBar");
        eduBar.style.width = `${(scoreJSON[0].edu_score / 5)*100}%`
        let softBar = document.createElement("div");
        softBar.classList.add("softBar");
        softBar.style.width = `${(scoreJSON[0].soft_score / 5)*100}%`;
        let beBar = document.createElement("div");
        beBar.classList.add("beBar");
        beBar.style.width = `${(scoreJSON[0].behav_score / 5)*100}%`;

        //creates another hidden div to store the candidate id
        let hidden = document.createElement("p");
        hidden.innerHTML = candidateid;
        hidden.style.display = "none";

        scoreTitles.appendChild(technical);
        scoreTitles.appendChild(work);
        scoreTitles.appendChild(education);
        scoreTitles.appendChild(soft);
        scoreTitles.appendChild(behavior);
        scoreBars.appendChild(techBar);
        scoreBars.appendChild(workBar);
        scoreBars.appendChild(eduBar);
        scoreBars.appendChild(softBar);
        scoreBars.appendChild(beBar);
        scorebox.appendChild(scoreTitles);
        scorebox.appendChild(scoreBars);

        let parentBox = event.target.closest(".compareBox");
        
        let selectedList = event.target.closest(".compareList");
        selectedList.style.display = "none";

        parentBox.appendChild(returnButton);
        parentBox.appendChild(name);
        parentBox.appendChild(rank);
        parentBox.appendChild(graph);
        parentBox.appendChild(changeView);
        parentBox.appendChild(scorebox);
        parentBox.appendChild(hidden);

        chartmaker.createDoughnut("compare" + candidateJSON[0].candidate_id, candidateJSON[0].candidate_score, "compare");
        selected = false;
      });
    }

  }

  //functionality for the return to list button
  if(event.target.classList.contains("returnToList") && !selected){
    let newList = selectedList;
    while(workedSide.children.length > 1){ //removes everything within the list
      workedSide.removeChild(workedSide.lastElementChild);
    }
    selected = true;
    let otherSide;
    if(workedSide.id == "compareLeft"){
      otherSide = document.getElementById("compareRight");
    }
    else if(workedSide.id == "compareRight"){
      otherSide = document.getElementById("compareLeft");
    }
    if (otherSide.firstElementChild.tagName != "BUTTON"){
      for(let i = 1; i < newList.children.length; i++){
        let cbox = newList.children[i];
        if(cbox.style.pointerEvents == "none"){
          cbox.style.backgroundColor = "#FFFFFF";
          cbox.style.pointerEvents = "auto";
        }
        if(cbox.children[1].children[0].innerHTML == otherSide.children[4].innerHTML){
          cbox.style.backgroundColor = "#D9D9D9";
          cbox.style.pointerEvents = "none";
        }
        //removes candidate from list if they applied for a different position
        if(otherSide.children[5].textContent.substring(otherSide.children[5].textContent.indexOf("applying for ") + "applying for ".length) != newList.children[i].children[1].children[1].innerHTML){
          newList.removeChild(newList.children[i]);
        }
      }
    }
    workedSide.appendChild(newList); //adds the list back in
    newList.style.display = "initial";
  }

  //Creates a list if a list hadn't been created for the comparison side
  if(!listCreated && !selected && event.target.tagName == "BUTTON"){
    selected = true;
    event.target.style.display = "none"; //hides button
    cand.fetchAllCandidates().then(
      result =>{
        let candidateJSON = result;
        let list = document.createElement("div");
        list.classList.add("compareList");
        let title = document.createElement("h3");
        title.innerHTML = "Select Candidate";
        event.target.closest(".compareBox").appendChild(list);
        list.appendChild(title);
  
        for (let i = 0; i < candidateJSON.length; i++){
          let newRow = document.createElement("div");
          newRow.classList.add("compareSelection");
      
          let rowFront = document.createElement("div");
          let name = document.createElement("p");
          name.style.fontWeight = 550;
          name.innerHTML = candidateJSON[i].candidate_name;
          let applying = document.createElement("p");
          applying.innerHTML = candidateJSON[i].applying_for;
          
          // let score = document.createElement("p");
          // score.innerHTML = "Score: " + candidateJSON[i].candidate_score;
          let score = document.createElement("canvas");
          score.setAttribute("id", workedSide.id + candidateJSON[i].candidate_id);
          score.style.maxWidth = "9vw";
  
          let hidden = document.createElement("p");
          hidden.innerHTML = candidateJSON[i].candidate_id;
          hidden.style.display = "none";
  
          //greys out candidate if they've been selected on the other 
          let otherSide;
          if(workedSide.id == "compareLeft"){
            otherSide = document.getElementById("compareRight");
          }
          else if(workedSide.id == "compareRight"){
            otherSide = document.getElementById("compareLeft");
          }
  
          rowFront.appendChild(name);
          rowFront.appendChild(applying);
          newRow.appendChild(rowFront);
          newRow.appendChild(score);
          newRow.appendChild(hidden);
          list.appendChild(newRow);
          chartmaker.createDoughnut(workedSide.id+candidateJSON[i].candidate_id, candidateJSON[i].candidate_score);
  
          //checks if the other side already has a candidate selected
          if (otherSide.firstElementChild.tagName != "BUTTON"){
            //only create row if the other side is applying for the same position
            if(otherSide.children[5].textContent.substring(otherSide.children[5].textContent.indexOf("applying for ") + "applying for ".length) != candidateJSON[i].applying_for){
              list.removeChild(list.lastElementChild);
            }
            //colors the row if the other candidate is the same candidate and makes it unclickable
            if(name.innerHTML == otherSide.children[4].innerHTML){
              newRow.style.backgroundColor = "#D9D9D9";
              newRow.style.pointerEvents = "none";
            }
          }
          listCreated = true;
        }
      }
    );   
  }


  //functionality for the change display button
  if(event.target.classList.contains("changeCompareView")){
    let container = event.target.closest(".compareBox");
    
    if (container.classList.contains("barDisplay")){
      let textexists = false; //checks if the detailed text report has been rendered already

      //hides the bar graphs and shows the text
      for (let child of container.children){
        
        if(child.classList.contains("scoreBox")){
          child.style.display = "none";
        }
        if(child.classList.contains("compareText")){
          child.style.display = "initial";
          textexists = true;
        }
      }

      //renders the detailed text report if it has not been rendered before
      if(!textexists){
        
        let candidateid = container.lastElementChild.innerHTML;
        cand.fetchReportData(candidateid).then(result=>{
          let reportJSON = result;
          let compareText = document.createElement("div");
          compareText.classList.add("compareText");
          let tech = document.createElement("h3");
          tech.innerHTML = "Technical Ability";
          tech.style.color = "#243F59";
          let tech_text = document.createElement("p");
          tech_text.innerHTML = reportJSON[0].technical_skills;

          let work = document.createElement("h3");
          work.innerHTML = "Work Experience";
          work.style.color = "#CB5919";
          let work_text = document.createElement("p");
          work_text.innerHTML = reportJSON[0].work_experience;


          let edu = document.createElement("h3");
          edu.innerHTML = "Education";
          edu.style.color = "#256221";
          let edu_text = document.createElement("p");
          edu_text.innerHTML = reportJSON[0].education;


          let soft = document.createElement("h3");
          soft.innerHTML = "Soft Skills";
          soft.style.color = "#80623E";
          let soft_text = document.createElement("p");
          soft_text.innerHTML = reportJSON[0].soft_skills;


          let behav = document.createElement("h3");
          behav.innerHTML = "Interview Behavior";
          behav.style.color = "#80623E";
          let behav_text = document.createElement("p");
          behav_text.innerHTML = reportJSON[0].behavior;

          compareText.appendChild(tech);
          compareText.appendChild(tech_text);
          compareText.appendChild(work);
          compareText.appendChild(work_text);
          compareText.appendChild(edu);
          compareText.appendChild(edu_text);
          compareText.appendChild(soft);
          compareText.appendChild(soft_text);
          compareText.appendChild(behav);
          compareText.appendChild(behav_text);
          container.appendChild(compareText);

          textexists = true;
        })            
      }
      //swaps the class of the container for the if statement
      container.classList.remove("barDisplay");
      container.classList.add("textDisplay");
    }
    else{
      
      for (let child of container.children){
        if(child.classList.contains("scoreBox")){
          child.style.display = "flex";
        }
        if(child.classList.contains("compareText")){
          child.style.display = "none";
        }
      }
      
      container.classList.remove("textDisplay");
      container.classList.add("barDisplay");
      
    }
  }
  
});

//buttons for the header links
document.querySelectorAll(".candidateListButton").forEach(element => element.addEventListener("click", ()=>{
  document.getElementById("main").style.display = "none";
  document.getElementById("results").style.display = "none";
  document.getElementById("list").style.display = "initial";
  document.getElementById("comparison").style.display = "none";
}));

document.querySelectorAll(".compareCandsButton").forEach(element => element.addEventListener("click", ()=>{
  document.getElementById("main").style.display = "none";
  document.getElementById("results").style.display = "none";
  document.getElementById("list").style.display = "none";
  document.getElementById("comparison").style.display = "initial";
}));

document.querySelectorAll(".newInterviewButton").forEach(element => element.addEventListener("click", ()=>{
  document.getElementById("main").style.display = "initial";
  document.getElementById("results").style.display = "none";
  document.getElementById("list").style.display = "none";
  document.getElementById("comparison").style.display = "none";
}));