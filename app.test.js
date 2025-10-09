const { getModeByHour, isHolidayByDay } = require('./utils');

describe('getModeByHour', () => {
  test('午前ならmorning', () => {
    expect(getModeByHour(8)).toBe('morning');
    expect(getModeByHour(0)).toBe('morning');
    expect(getModeByHour(11)).toBe('morning');
  });
  test('午後ならafter', () => {
    expect(getModeByHour(12)).toBe('after');
    expect(getModeByHour(15)).toBe('after');
    expect(getModeByHour(23)).toBe('after');
  });
});

describe('isHolidayByDay', () => {
  test('日曜はholiday', () => {
    expect(isHolidayByDay(0)).toBe(true);
  });
  test('土曜はholiday', () => {
    expect(isHolidayByDay(6)).toBe(true);
  });
  test('平日はholidayでない', () => {
    for (let d = 1; d <= 5; d++) {
      expect(isHolidayByDay(d)).toBe(false);
    }
  });
});
