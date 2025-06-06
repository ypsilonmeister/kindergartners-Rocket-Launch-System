google.charts.load("current", { packages: ["timeline", "corechart"] });
google.charts.setOnLoadCallback(loadSettings);
let dataTable;
let dataTable2;
const timelineOptions = {
    animation: {
        startup: true,
        duration: 1000,
    },
    alternatingRowStyle: false,
    avoidOverlappingGridLines: false,
    timeline: {
        rowLabelStyle: { fontSize: 24 },
        barLabelStyle: { fontSize: 24 },
        howRowLabels: false,
    },
};
let chart;
let c;
let position = 0;
let voicesJa;
let voicesEn;
let timeId;
let timeId2;
let countUp = 0;
const pieOption = {
    pieSliceText: "value",
    pieHole: 0.4,
    height: "100%",
    width: "100%",
};
let pie;

let holiday;
const morningSequence = [
    { ja: "ごはん", en: "breakfast" },
    { ja: "はみがき", en: "dental brushing" },
    { ja: "おきがえ", en: "change of clothes" },
    { ja: "もちもの", en: "Preparation of belongings" },
];
const afterSequence = [
    { ja: "かばんをおく", en: "Put down bag" },
    { ja: "てあらい", en: "Hand wash" },
    { ja: "しゅくだい", en: "Homework" },
    { ja: "もちもの", en: "Check belongings" },
];
let sequences = [...morningSequence];

let startTime = new Date(); // シーケンス開始時刻
let goalTime = new Date(startTime);
goalTime.setHours(8, 0, 0, 0);

function updateTimelineInfo() {
    // 時刻表示
    document.getElementById("startTime").textContent =
        startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    document.getElementById("goalTime").textContent = goalTime.toLocaleTimeString(
        [],
        { hour: "2-digit", minute: "2-digit" }
    );

    // 現在時刻表示
    const now = new Date();
    document.getElementById("currentTime").textContent = now.toLocaleTimeString(
        [],
        { hour: "2-digit", minute: "2-digit", second: "2-digit" }
    );

    // インジケーター位置計算
    const total = goalTime - startTime;
    const elapsed = now - startTime;
    let percent = Math.max(0, Math.min(1, elapsed / total));
    document.getElementById("time-indicator").style.left = percent * 100 + "%";
}

function loadSettings() {
    const settings = JSON.parse(localStorage.getItem("settings"));
    holiday = settings?.holiday;
    if (settings?.goalTime) {
        goalTime = new Date(startTime);
        const [hh, mm] = settings.goalTime.split(":");
        goalTime.setHours(Number(hh), Number(mm), 0, 0);
    }
    if (settings) {
        for (const setting in settings) {
            if (
                document.querySelector(`#${setting}`).getAttribute("type") ===
                "checkbox"
            ) {
                if (settings[setting]) {
                    document
                        .querySelector(`#${setting}`)
                        .setAttribute("checked", settings[setting]);
                } else {
                    document.querySelector(`#${setting}`).removeAttribute("checked");
                }
            }
        }
    }
    if (holiday) {
        sequences.splice(-1);
    } else {
        sequences = [...morningSequence];
    }
    drawChart();
}

function appendVoices() {
    voicesJa = speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.match("ja"));
    voicesEn = speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.match("en"));
}

appendVoices();

speechSynthesis.onvoiceschanged = (_e) => {
    appendVoices();
};
function speech(text, eng) {
    let msg = new SpeechSynthesisUtterance(text);
    msg.pitch = 1; // From 0 to 2
    msg.voice = voicesJa[Math.floor(Math.random() * voicesJa.length + 1)];
    msg.rate = 1.5;
    speechSynthesis.speak(msg);
    if (!eng) {
        return;
    }
    let msg2 = new SpeechSynthesisUtterance(eng);
    msg2.pitch = 1; // From 0 to 2
    msg2.lang = "en";
    msg2.rate = 1;
    msg2.voice = voicesEn[Math.floor(Math.random() * voicesEn.length + 1)];
    speechSynthesis.speak(msg2);
}

function drawChart() {
    let container = document.getElementById("timeline");
    chart = new google.visualization.Timeline(container);
    dataTable = new google.visualization.DataTable();
    dataTable.addColumn({ type: "string", id: "Role" });
    dataTable.addColumn({ type: "string", id: "Name" });
    dataTable.addColumn({ type: "datetime", id: "Start" });
    dataTable.addColumn({ type: "datetime", id: "End" });

    dataTable2 = new google.visualization.DataTable();
    dataTable2.addColumn("string", "名前");
    dataTable2.addColumn("number", "秒");

    let nowDate = new Date();
    // モードによってラベルを切り替え
    let modeDraw = document.getElementById("sequenceMode")?.value || "morning";
    const label = modeDraw === "morning" ? "あさ" : "帰宅";
    dataTable.addRows(
        sequences.map((s, i) => {
            return [
                label,
                s.ja,
                new Date(nowDate.getTime() + i),
                new Date(nowDate.getTime() + i + 1),
            ];
        })
    );

    chart.draw(dataTable, timelineOptions);

    pie = new google.visualization.PieChart(document.getElementById("piechart"));
    pie.draw(dataTable2, pieOption);

    document.getElementById("current").innerHTML = dataTable.getValue(0, 1);

    // timeline-infoの表示/非表示もここで念のため制御
    if (modeDraw === "morning") {
        document.getElementById("timeline-info").style.visibility = "visible";
    } else {
        document.getElementById("timeline-info").style.visibility = "hidden";
    }
    // ボタン類は常に表示
    document.querySelector(".nav-controls").style.display = "";
    document.querySelector(".action-controls").style.display = "";
}

function nextChart() {
    document.getElementById("nextButton").disabled = true;
    document.getElementById("prevButton").disabled = false; // Enable previous button

    countUp = 0;
    let nowDate = new Date();
    const org = dataTable.getValue(position, 2);
    dataTable.setValue(position, 3, new Date(nowDate.getTime() - 10));
    const sec = Math.round((dataTable.getValue(position, 3) - org) / 1000);
    dataTable2.addRow([
        dataTable.getValue(position, 1).split(":")[0],
        { v: sec, f: `${sec}秒` },
    ]);
    pie.draw(dataTable2, pieOption);
    position += 1;
    if (dataTable.getNumberOfRows() === position) {
        clearInterval(timeId);
        clearInterval(timeId2);
        timeid = undefined;
        timeId2 = undefined;
        const currentTimes = [];
        for (let i = 0; i < dataTable2.getNumberOfRows(); i++) {
            currentTimes.push(dataTable2.getValue(i, 1));
        }
        saveHistory(currentTimes);
        showCompare(currentTimes);
        if (holiday) {
            speech(
                "全てのシーケンスが終了しました。お休みを楽しんでください。",
                "All sequences have been completed. Enjoy your holiday!"
            );
        } else {
            speech(
                "全てのシーケンスが終了しました。登校時間まで自由時間を開始してください",
                "All sequences have been completed. Please start your free time until school time"
            );
        }
        document.getElementById("nextButton").disabled = true;
        document.getElementById("prevButton").disabled = false; // Still allow going back
        pie.draw(dataTable2, pieOption);
        return;
    }
    setTimeout(() => {
        document.getElementById("nextButton").disabled = false;
    }, 1000);
    const nextAction = dataTable.getValue(position, 1);
    document.getElementById("current").innerHTML = nextAction;
    speech(
        `次のシーケンスは、「${nextAction}」 です。すみやかに移行してください。`,
        `The next sequence is “${sequences.find((s) => s.ja === nextAction).en
        }”. Please execute the transition as soon as possible.`
    );
}

function prevChart() {
    if (position === 0) return;
    position -= 1;
    countUp = 0;

    // Remove the last row from the pie chart data if possible
    if (dataTable2.getNumberOfRows() > 0) {
        dataTable2.removeRow(dataTable2.getNumberOfRows() - 1);
        pie.draw(dataTable2, pieOption);
    }

    // Reset the end time for the current sequence
    let nowDate = new Date();
    dataTable.setValue(position, 3, new Date(nowDate.getTime() + 1));

    // Update the current action display
    const prevAction = dataTable.getValue(position, 1).split(":")[0];
    document.getElementById("current").innerHTML = prevAction;

    // Speak the previous action
    speech(
        `前のシーケンスに戻りました。「${prevAction}」を再開してください。`,
        `Returned to the previous sequence. Please resume "${sequences.find((s) => s.ja === prevAction).en
        }".`
    );

    // Enable/disable buttons as needed
    document.getElementById("nextButton").disabled = false;
    if (position === 0) {
        document.getElementById("prevButton").disabled = true;
    }
    if (!timeId) {
        timeId = setInterval(updateChart, 10);
        timeId2 = setInterval(updateTimelineInfo, 1000);
    }
}

function start() {
    document.getElementById("startButton").disabled = true;
    document.getElementById("nextButton").disabled = false;
    document.getElementById("prevButton").disabled = true; // Disable previous at start
    document.getElementById("settingButton").disabled = true;
    document.getElementById("sequenceMode").disabled = true; // モード切替を無効化
    const nextAction = dataTable.getValue(0, 1);
    const mode = document.getElementById("sequenceMode")?.value || "morning";
    if (holiday) {
        if (mode === "morning") {
            speech(
                `休みの朝のおしたくを開始しましょう！。最初のシーケンス、${nextAction} を開始してください。`,
                `Start the preparation for the morning of the vacation!. Start the first sequence, ${sequences.find((s) => s.ja === nextAction).en
                }.`
            );
        } else {
            speech(
                `休みの帰宅後のおしたくを開始しましょう！。最初のシーケンス、${nextAction} を開始してください。`,
                `Start the preparation for after school on the vacation!. Start the first sequence, ${sequences.find((s) => s.ja === nextAction).en
                }.`
            );
        }
    } else {
        if (mode === "morning") {
            speech(
                `登校準備を開始します。最初のシーケンス、${nextAction} を開始してください。`,
                `Start the preparation for elementary school attendance. Start the first sequence, ${sequences.find((s) => s.ja === nextAction).en
                }.`
            );
        } else {
            speech(
                `帰宅後のおしたくを開始します。最初のシーケンス、${nextAction} を開始してください。`,
                `Start the preparation for after school. Start the first sequence, ${sequences.find((s) => s.ja === nextAction).en
                }.`
            );
        }
    }

    let nowDate = new Date();
    startTime = new Date();
    dataTable.setValue(0, 2, new Date(nowDate.getTime()));
    timeId = setInterval(updateChart, 10);

    timeId2 = setInterval(updateTimelineInfo, 1000);
    updateTimelineInfo();
    document.getElementById("compareArea").innerHTML = "";
}

function updateChart() {
    if (!dataTable) {
        return;
    }
    let nowDate = new Date();
    for (let i = position + 1; i < dataTable.getNumberOfRows(); i++) {
        dataTable.setValue(i, 2, new Date(nowDate.getTime()));
    }
    for (i = position; i < dataTable.getNumberOfRows(); i++) {
        dataTable.setValue(i, 3, new Date(nowDate.getTime() + 1));
    }

    const start = dataTable.getValue(position, 2);
    const diff = nowDate - start;

    const min = Math.floor(diff / 1000 / 60);
    if (countUp !== min) {
        countUp = min;
        speech(
            `${countUp} 分、経過しました。`,
            `${countUp} minute${countUp === 1 ? "" : "s"} elapsed.`
        );
    }

    const name = dataTable.getValue(position, 1);
    const split = name.split(":");
    dataTable.setValue(position, 1, `${split[0]}:${(diff / 1000).toFixed(3)}`);
    chart.draw(dataTable, timelineOptions);
}

function openSettings() {
    const dialog = document.querySelector("dialog");
    const goalTimeInput = document.getElementById("goalTimeInput");
    if (goalTimeInput && goalTime) {
        // goalTimeをinput[type="time"]の値に変換
        const hh = String(goalTime.getHours()).padStart(2, "0");
        const mm = String(goalTime.getMinutes()).padStart(2, "0");
        goalTimeInput.value = `${hh}:${mm}`;
    }
    dialog.showModal();
}

function closeSettings() {
    const dialog = document.querySelector("dialog");
    dialog.close();
}

function saveSettings() {
    const inputs = document.querySelectorAll("#settingContent input");
    let settings = {};
    inputs.forEach((a) => {
        const setting = a.getAttribute("id");
        if (a.getAttribute("type") === "checkbox") {
            settings[setting] = a.checked;
        }
    });
    const goalTimeInput = document.getElementById("goalTimeInput");
    if (goalTimeInput && goalTimeInput.value) {
        settings.goalTime = goalTimeInput.value;
    }
    window.localStorage.setItem("settings", JSON.stringify(settings));
    loadSettings();
    const dialog = document.querySelector("dialog");
    dialog.close();
}

function saveHistory(currentTimes) {
    const mode = document.getElementById("sequenceMode")?.value || "morning";
    let allHistory = JSON.parse(localStorage.getItem("sequenceHistory") || "{}");
    if (typeof allHistory !== "object" || Array.isArray(allHistory))
        allHistory = {};
    if (!allHistory[mode]) allHistory[mode] = [];
    allHistory[mode].push(currentTimes);
    // 履歴は直近20件だけ保存
    if (allHistory[mode].length > 20)
        allHistory[mode] = allHistory[mode].slice(-20);
    localStorage.setItem("sequenceHistory", JSON.stringify(allHistory));
}

function getHistory() {
    const mode = document.getElementById("sequenceMode")?.value || "morning";
    let allHistory = JSON.parse(localStorage.getItem("sequenceHistory") || "{}");
    if (typeof allHistory !== "object" || Array.isArray(allHistory))
        allHistory = {};
    return allHistory[mode] || [];
}

function calcAverage(history) {
    if (history.length === 0) return [];
    const len = history[0].length;
    const avg = Array(len).fill(0);
    history.forEach((times) => {
        for (let i = 0; i < len; i++) {
            avg[i] += times[i];
        }
    });
    return avg.map((t) => Math.round(t / history.length));
}

function showCompare(currentTimes) {
    const history = getHistory();
    const prev = history.length > 1 ? history[history.length - 2] : null;
    const avg = calcAverage(history.slice(0, history.length - 1)); // 今回を除く平均

    // --- Google BarChart 表示 ---
    // データテーブル作成
    let barData = new google.visualization.DataTable();
    barData.addColumn("string", "シーケンス");
    barData.addColumn("number", "今回");
    if (prev) barData.addColumn("number", "前回");
    if (avg.length) barData.addColumn("number", "平均");

    for (let i = 0; i < sequences.length; i++) {
        let row = [sequences[i].ja, currentTimes[i] || 0];
        if (prev) row.push(prev[i] || 0);
        if (avg.length) row.push(avg[i] || 0);
        barData.addRow(row);
    }

    let barOptions = {
        width: "100%",
        height: "100%",
        legend: { position: "top" },
        hAxis: { title: "秒", minValue: 0 },
        vAxis: { title: "シーケンス" },
        chartArea: { left: 80, width: "70%", height: "70%" },
        colors: ["#0176d3", "#ffb300", "#888"],
        isStacked: false,
    };

    let barChart = new google.visualization.BarChart(
        document.getElementById("barchart")
    );
    barChart.draw(barData, barOptions);
}

function changeSequenceMode() {
    const mode = document.getElementById("sequenceMode").value;
    if (mode === "morning") {
        sequences = [...morningSequence];
        timelineOptions.timeline.rowLabelStyle = { fontSize: 24 };
        timelineOptions.timeline.barLabelStyle = { fontSize: 24 };
        timelineOptions.timeline.label = "あさ";
        document.getElementById("timeline-info").style.visibility = "visible";
    } else {
        sequences = [...afterSequence];
        timelineOptions.timeline.rowLabelStyle = { fontSize: 24 };
        timelineOptions.timeline.barLabelStyle = { fontSize: 24 };
        timelineOptions.timeline.label = "帰宅";
        document.getElementById("timeline-info").style.visibility = "hidden";
    }
    position = 0;
    drawChart();
    updateTimelineInfo();
}

function clearHistory() {
    if (window.confirm("本当に履歴を全て削除しますか？")) {
        localStorage.removeItem("sequenceHistory");
        document.getElementById("compareArea").innerHTML = "";
        alert("履歴を削除しました。");
    }
}

// テストしやすいようにユーティリティ関数をutils.jsに移動
document.addEventListener("DOMContentLoaded", () => {
    const now = new Date();
    const hour = now.getHours();
    const modeSelect = document.getElementById("sequenceMode");
    // 土日なら自動的にholiday
    const day = now.getDay(); // 0:日, 6:土
    if (day === 0 || day === 6) {
        holiday = true;
        const holidayCheckbox = document.getElementById("holiday");
        if (holidayCheckbox) holidayCheckbox.checked = true;
    }
    if (modeSelect) {
        if (hour < 12) {
            modeSelect.value = "morning";
        } else {
            modeSelect.value = "after";
        }
        changeSequenceMode();
    }
});
