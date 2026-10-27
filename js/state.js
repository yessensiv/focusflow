/* State model & mutation boundary. */
(function (F) {
  F.defaults = () => ({
    version: 1,
    seeded: false,
    demo: false,
    tasks: [],
    habits: [],
    sessions: [],
    days: {},
    parking: [],
    settings: {
      focus: 25,
      short: 5,
      long: 15,
      theme: "dark",
      sound: true,
      ambient: false,
      notifications: false,
      weeklyGoal: 600,
    },
    timer: null,
  });
  F.state = F.defaults();
  F.today = () =>
    (F.state.days[F.day()] ??= {
      energy: "medium",
      goal: null,
      word: "",
      closed: false,
    });
  F.change = (fn) => {
    fn(F.state);
    F.save?.();
    F.render();
    F.emit("change");
  };
  F.color = (i) => ["lime", "coral", "blue"][Math.abs(i) % 3];
  F.totalMinutes = (sessions = F.state.sessions) =>
    sessions.reduce((n, s) => n + s.minutes, 0);
})(FF);
