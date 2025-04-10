//creates a doughnut chart of the candidate scores
export function createDoughnut(uniqueId, candidateScore, location){
  
    let color = "#000000";
    if(candidateScore <= 35){
        color = "#FF0000";
    }
    else if(candidateScore > 35 && candidateScore <= 70){
        color = "#E9C362";
    }
    else{
        color = "#43B02A";
    }

    let font_size = 16;
    if(location=="report"){
        font_size = 20;
    }
    else if(location=="compare"){
        font_size = 24;
    }
    else{
        font_size = 16;
    }
    
    new Chart(document.getElementById(`${uniqueId}`), {
    type: "doughnut",
    data: {
        datasets: [{
            data: [candidateScore, 100-candidateScore],
            backgroundColor: [color, "#000000"],
            borderWidth: 0.5
        }]
    },
    options: {
        responsive: true,
        cutoutPercentage: 80
    },
    plugins: {
        tooltip: {
            enabled: false // Disable tooltip if needed
        },
        // Custom plugin to draw text at the center
        legend: {
            display: false // Disable legend if needed
        },
        datalabels: {
            display: false // Optionally disable datalabels plugin if not needed
        },
        // Custom text in the center of the doughnut
        beforeDraw: function(chart) {
            const ctx = chart.ctx;
            const width = chart.width;
            const height = chart.height;
            const fontSize = font_size; // You can adjust this size
            ctx.restore();
            ctx.font = fontSize + "px Arial";
            ctx.fillStyle = "#000000"; // Black color for text
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const text = `${candidateScore}`; // Replace with your value
            ctx.fillText(text, width / 2, (height / 2) + 6); // Positioning the text in the center
            ctx.save();
        }
    },
    font: {
    size: 16,
    weight: "bold",
    color: "#000000"
    }
  })
}

//Radar chart code
export function createRadarChart(uniqueId, data){
const myRadarChart = new Chart(document.getElementById(`${uniqueId}`), {
    type: 'radar',
    data: {
        labels: ["Education", "Soft Skills", "Interview Behavior", "Experience", "Technical Skills"],
        datasets: [{
            "data": data,
            "backgroundColor": "rgba(0, 123, 255, 0.6)"
        }]
    },
    options: {
        responsive: false,
        scale: {
            ticks: {
                min: 0,
                max: 5,
                stepSize: 1,
                display: false
            },
            pointLabels:{
            fontColor: "#FFFFFF",
            },
            gridLines: {
            color: '#FFFFFF'
            },
            angleLines: {
            color: '#FFFFFF'
            }
        },
        legend:{
        display: false,
        },
    },
});
}