import { describe, expect, it } from 'vitest';
import { addDays, diffDays, doseInstant, formatLocalTime, localToUtc, patientDay, weekdayOf } from '../src';

const TZ = 'Europe/Rome';

describe('fuso orario e ora legale', () => {
  it('08:30 resta 08:30 locale in inverno e in estate', () => {
    expect(formatLocalTime(localToUtc('2026-01-15', '08:30', TZ), TZ)).toBe('08:30');
    expect(formatLocalTime(localToUtc('2026-07-15', '08:30', TZ), TZ)).toBe('08:30');
    expect(localToUtc('2026-01-15', '08:30', TZ)).toBe(Date.UTC(2026, 0, 15, 7, 30));
    expect(localToUtc('2026-07-15', '08:30', TZ)).toBe(Date.UTC(2026, 6, 15, 6, 30));
  });

  it("l'ora che non esiste (29 marzo 2026, 02:30) slitta alle 03:00", () => {
    const t = localToUtc('2026-03-29', '02:30', TZ);
    expect(formatLocalTime(t, TZ)).toBe('03:00');
  });

  it("nell'ora doppia di ottobre (25 ottobre 2026, 02:30) la dose è una sola, alla prima occorrenza", () => {
    const t = localToUtc('2026-10-25', '02:30', TZ);
    expect(t).toBe(Date.UTC(2026, 9, 25, 0, 30)); // 02:30 CEST = 00:30 UTC
  });

  it('la giornata del paziente va dalle 04:00 alle 03:59', () => {
    const lateNight = Date.UTC(2026, 10, 9, 23, 30); // 10/11 00:30 locale
    expect(patientDay(lateNight, TZ)).toBe('2026-11-09');
    const morning = Date.UTC(2026, 10, 10, 3, 0); // 04:00 locale
    expect(patientDay(morning, TZ)).toBe('2026-11-10');
    const justBefore = Date.UTC(2026, 10, 10, 2, 59);
    expect(patientDay(justBefore, TZ)).toBe('2026-11-09');
  });

  it('una dose delle 00:30 appartiene al giorno precedente ma cade dopo mezzanotte', () => {
    const t = doseInstant('2026-11-09', '00:30', TZ);
    expect(t).toBe(Date.UTC(2026, 10, 9, 23, 30));
    expect(patientDay(t, TZ)).toBe('2026-11-09');
  });

  it('aritmetica dei giorni', () => {
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
    expect(diffDays('2026-11-09', '2026-11-16')).toBe(7);
    expect(weekdayOf('2026-11-09')).toBe(0); // lunedì
    expect(weekdayOf('2026-11-15')).toBe(6); // domenica
  });
});
