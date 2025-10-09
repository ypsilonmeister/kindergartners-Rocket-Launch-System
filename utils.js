// utils.js
// テストしやすいユーティリティ関数

function getModeByHour(hour) {
    return hour < 12 ? 'morning' : 'after';
}

function isHolidayByDay(day) {
    return day === 0 || day === 6;
}

module.exports = { getModeByHour, isHolidayByDay };
