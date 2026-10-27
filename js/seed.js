/* Explicit, deterministic demo: never mixed silently with personal progress. */
(function (F) {
  F.seed = () => {
    if (F.state.seeded || F.storageBlocked) return;
    const s = F.state;
    s.seeded = true;
    s.demo = true;
    s.tasks = [
      ["Собрать идею в прототип", "работа", "high", 3],
      ["Прочитать одну главу", "личное", "low", 1],
      ["Оставить место для нового", "жизнь", "medium", 2],
    ].map((a, i) => ({
      id: F.uid(),
      title: a[0],
      tag: a[1],
      priority: a[2],
      estimate: a[3],
      done: false,
      color: F.color(i),
      date: F.day(),
      completed: 0,
    }));
    s.habits = [
      ["Тихое утро", "lime"],
      ["20 минут чтения", "blue"],
      ["Движение каждый день", "coral"],
    ].map(([title, color]) => ({
      id: F.uid(),
      title,
      color,
      emoji: "",
      frequency: "daily",
      target: 1,
      checks: {},
    }));
    s.habits.forEach((h, i) => (h.after = i ? s.habits[i - 1].id : null));
    for (let i = 20; i >= 1; i--) {
      const day = F.dateOffset(-i);
      s.days[day] = {
        energy: "medium",
        goal: null,
        closed: true,
        word: ["тише", "ясность", "ритм", "глубина"][i % 4],
      };
      for (let j = 0; j < (i % 4) + 1; j++) {
        const task = s.tasks[j % 3];
        s.sessions.push({
          id: F.uid(),
          day,
          minutes: 25,
          taskId: task.id,
          habitId: null,
          title: task.title,
          color: task.color,
          rating: 3 + (i % 3),
          mood: "ровно",
          finishedAt: new Date(day + "T12:00:00").getTime(),
          demo: true,
        });
      }
      s.habits.forEach((h, k) => {
        if ((i + k) % 5 !== 0) h.checks[day] = 1;
      });
    }
    F.save();
  };
  F.on("init", F.seed);
})(FF);
