import * as chartmaker from './chartmaker.js';

export const createCandidateData = async (candidateName, applyingFor, applicationDate, candidateScore) => {
    try {
      const response = await fetch('http://localhost:3000/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateName, applyingFor, applicationDate, candidateScore })
      });
  
      const data = await response.json();
      console.log('Candidate created with ID:', data.candidate_id);

      return data.candidate_id;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  };

export const updateCandidateReport = async (candidate_id, technical, work, soft, education, behavior, summary, strengths, weaknesses, fit) => {
    try {
        const response = await fetch('http://localhost:3000/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id, technical, work, soft, education, behavior, summary, strengths, weaknesses, fit })
        });

        const data = await response.json();
        console.log('Candidate created with ID:', data.candidate_id);
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

export const updateScoreReport = async (candidate_id, tech_score, work_score, soft_score, edu_score, behav_score) => {
    try {
        const response = await fetch('http://localhost:3000/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_id, tech_score, work_score, soft_score, edu_score, behav_score })
        });

        const data = await response.json();
        console.log('Candidate created with ID:', data.candidate_id);
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

export const fetchCandidateData = async (search, variable) => {
    try {
        const response = await fetch(`http://localhost:3000/api/candidates?search=${encodeURIComponent(search)}&variable=${encodeURIComponent(variable)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();
        console.log('Candidate data:', data);
        return data;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

export const fetchReportData = async (candidate_id) => {
    try {
        const response = await fetch(`http://localhost:3000/api/reports?candidate_id=${encodeURIComponent(candidate_id)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();
        console.log('Candidate data:', data);
        return data;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

export const fetchReportScores = async (candidate_id) => {
    try {
        const response = await fetch(`http://localhost:3000/api/scores?candidate_id=${encodeURIComponent(candidate_id)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json();
        console.log('Candidate data:', data);
        return data;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

//creates a new candidate row on the candidate list
export function createCandidateRow(candidateName, applyingFor, applicationDate, score, candidate_id){
    let newRow = document.createElement("div");
    newRow.classList.add("candidateRow");
    newRow.setAttribute("id", candidate_id);
  
    let rowFront = document.createElement("div");
    rowFront.classList.add("tableFront");
    let rowBack = document.createElement("div");
    rowBack.classList.add("tableBack");
  
    let name = document.createElement("p");
    name.innerHTML = candidateName;
    let applying = document.createElement("p");
    applying.innerHTML = applyingFor;
    let oneWordClass = applyingFor.replace(/\s+/g, '');
    applying.classList.add(oneWordClass);
    let date = document.createElement("p");
    date.innerHTML = applicationDate;
    let scoreGraph = document.createElement("canvas");
    scoreGraph.setAttribute("id", "list" + candidate_id);
    scoreGraph.style.width = "33%";
    scoreGraph.style.maxWidth = "9vw";
  
    rowFront.appendChild(name);
    rowFront.appendChild(applying);
    rowBack.appendChild(date);
    rowBack.appendChild(scoreGraph);
    newRow.appendChild(rowFront);
    newRow.appendChild(rowBack);
    document.getElementById("candidateTable").appendChild(newRow);
  
    chartmaker.createDoughnut("list" + candidate_id, score, "list");
  }
  
//sorts all candidates based on their score
export function sortCandidates(allCandidates){
let sorted = allCandidates.sort((a, b) => b.candidate_score - a.candidate_score);
return sorted;
}

export function createReportSummary(name, applyingFor, strengths, weaknesses, fit){
    document.getElementById("candidateName").innerHTML = name;
    document.getElementById("role").innerHTML = "Applying For: " + applyingFor;
    document.getElementById("strengths").innerHTML = strengths;
    document.getElementById("weaknesses").innerHTML = weaknesses
    document.getElementById("fit").innerHTML = fit;
}

export function createReportDetails(technical, work, soft, education, behavior, summary){
    document.getElementById("technical").innerHTML = technical;
    document.getElementById("work").innerHTML = work;
    document.getElementById("soft").innerHTML = soft;
    document.getElementById("education").innerHTML = education;
    document.getElementById("behavior").innerHTML = behavior;
    document.getElementById("summary").innerHTML = summary;
}

export function createReportCharts(data, score){
    chartmaker.createRadarChart('myRadarChart', data);
    chartmaker.createDoughnut('reportDoughnut', score, "report");
}