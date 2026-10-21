import test from "node:test";
import assert from "node:assert/strict";
import {
  dayKey,
  lastDays,
  initialState,
  normalizeState,
  filterTasks,
  toggleHabitDay,
  habitStreak,
  remainingSeconds,
  startTimer,
  pauseTimer,
  weeklyFocus,
  escapeHtml,
} from "../model.js";
test("date windows cross month and year boundaries in local time", () => {
  assert.equal(dayKey(new Date(2026, 0, 1)), "2026-01-01");
  assert.deepEqual(lastDays(3, new Date(2026, 0, 1)), [
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
  ]);
});
test("task filters combine search and completion state", () => {
  const tasks = [
    { title: "Write notes", done: false },
    { title: "Read notes", done: true },
  ];
  assert.deepEqual(filterTasks(tasks, "active", "NOTES"), [tasks[0]]);
  assert.deepEqual(filterTasks(tasks, "done", "write"), []);
});
test("habit toggles are reversible and streak allows unfinished today", () => {
  const h = { days: ["2026-10-17", "2026-10-18"] };
  assert.equal(habitStreak(h, new Date(2026, 9, 19)), 2);
  assert.equal(habitStreak(h, new Date(2026, 9, 20)), 0);
  assert.deepEqual(
    toggleHabitDay(toggleHabitDay(h, "2026-10-19"), "2026-10-19"),
    h,
  );
});
test("timer follows wall clock and pause/resume preserves remaining time", () => {
  const timer = startTimer({ remaining: 60, duration: 60 }, 1000);
  assert.equal(remainingSeconds(timer, 31500), 30);
  const paused = pauseTimer(timer, 31500);
  assert.equal(remainingSeconds(paused, 90000), 30);
  assert.equal(remainingSeconds(startTimer(paused, 100000), 130000), 0);
  assert.equal(remainingSeconds(timer, 999999), 0);
});
test("weekly chart excludes old sessions and sums same-day sessions", () => {
  const date = new Date(2026, 9, 21, 12);
  const finishedAt = new Date(2026, 9, 21, 10).toISOString();
  const result = weeklyFocus(
    [
      { minutes: 25, finishedAt },
      { minutes: 10, finishedAt },
      { minutes: 99, finishedAt: new Date(2026, 8, 1).toISOString() },
    ],
    date,
  );
  assert.equal(result.at(-1).minutes, 35);
  assert.equal(
    result.reduce((n, d) => n + d.minutes, 0),
    35,
  );
});
test("corrupt data is rejected and malformed records are filtered", () => {
  assert.throws(() => normalizeState({ version: 2 }));
  const state = initialState();
  state.tasks.push(null);
  state.sessions.push({ id: "bad", minutes: -20, finishedAt: "invalid" });
  state.lengths.focus = -1;
  const clean = normalizeState(state);
  assert.equal(clean.tasks.length, 3);
  assert.equal(clean.sessions.length, 0);
  assert.equal(clean.lengths.focus, 25);
});
test("task and habit content is escaped before rendering", () =>
  assert.equal(
    escapeHtml('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  ));
