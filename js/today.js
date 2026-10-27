/* Daily editorial overview. Widgets are added by their own modules. */
(function (F) {
  F.todayWidgets = {};
  F.greeting = () => {
    const h = new Date().getHours();
    return h < 5
      ? ["Тихой", "ночи."]
      : h < 12
        ? ["Доброе", "утро."]
        : h < 18
          ? ["Добрый", "день."]
          : ["Добрый", "вечер."];
  };
  F.views.today = () => {
    const g = F.greeting(),
      sessions = F.state.sessions.filter((s) => s.day === F.day()),
      minutes = F.totalMinutes(sessions);
    return (
      '<div class="today-heading"><div><p class="mono muted">' +
      new Date().toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        weekday: "long",
      }) +
      " / ваша лаборатория</p><h1>" +
      g[0] +
      "<br><em>" +
      g[1] +
      '</em></h1><p class="intro">Не успеть всё.<br>А быть <strong>здесь</strong> — целиком.</p></div><div id="day-vessel-slot">' +
      (F.todayVessel?.() ||
        '<div class="outline-flask"><span class="mono">Сосуд дня</span><span class="big-number">' +
          minutes +
          "</span><small>минут внимания</small></div>") +
      "</div></div>" +
      (F.state.demo
        ? '<div class="demo-note mono">Демонстрационная лаборатория · история за 3 недели · очистка в настройках</div>'
        : "") +
      '<div class="ticker" aria-label="Статистика сегодня"><div>' +
      sessions.length +
      " сессий <b>·</b> " +
      minutes +
      " минут фокуса <b>·</b> " +
      F.state.tasks.filter((t) => t.done).length +
      ' задач завершено <b>·</b> внимание имеет значение</div><button id="ticker-toggle" aria-pressed="false">Пауза строки</button></div><div class="today-body">' +
      Object.values(F.todayWidgets)
        .map((fn) => fn())
        .join("") +
      "</div>"
    );
  };
  F.on("render", (v) => {
    if (v !== "today") return;
    F.$("#ticker-toggle").onclick = (e) => {
      const t = e.target.closest("button"),
        paused = t.getAttribute("aria-pressed") !== "true";
      t.setAttribute("aria-pressed", paused);
      t.textContent = paused ? "Продолжить строку" : "Пауза строки";
      F.$(".ticker").classList.toggle("paused", paused);
    };
  });
})(FF);

/* Energy suggests work; daily main goal remains an explicit choice. */
(function (F) {
  F.todayWidgets.energy = () =>
    '<section class="energy-panel"><div><span class="mono muted">Начните с себя</span><h3>Какой сегодня заряд?</h3></div><div class="energy-options">' +
    [
      ["low", "Низкий"],
      ["medium", "Средний"],
      ["high", "Высокий"],
    ]
      .map(
        ([k, v]) =>
          '<button data-energy="' +
          k +
          '" aria-pressed="' +
          (F.today().energy === k) +
          '">' +
          v +
          "</button>",
      )
      .join("") +
    "</div></section>";
  F.todayWidgets.goal = () => {
    const day = F.today(),
      tasks = F.state.tasks,
      goal = tasks.find((t) => t.id === day.goal),
      percent = goal
        ? goal.done
          ? 100
          : Math.min(100, ((goal.completed || 0) / (goal.estimate || 1)) * 100)
        : 0;
    return (
      '<section class="goal-section"><p class="mono muted">Один важный результат</p><div class="goal-card"><div><h3>Главная<br><em>цель дня.</em></h3><label><span class="sr-only">Главная цель дня</span><select id="day-goal"><option value="">Выберите главное</option>' +
      tasks
        .map(
          (t) =>
            '<option value="' +
            F.esc(t.id) +
            '" ' +
            (goal?.id === t.id ? "selected" : "") +
            ">" +
            F.esc(t.title) +
            "</option>",
        )
        .join("") +
      '</select></label><p class="mono muted">' +
      Math.round(percent) +
      '% наполнено</p></div><div class="mini-flask" aria-hidden="true"><div class="mini-liquid" style="height:' +
      percent +
      '%"></div></div></div></section>'
    );
  };
  F.on("render", (v) => {
    if (v !== "today") return;
    const day = F.today();
    document
      .querySelectorAll("[data-energy]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            F.change(() => (F.today().energy = b.dataset.energy))),
      );
    F.$("#day-goal").onchange = (e) =>
      F.change(() => (F.today().goal = e.target.value || null));
    document.querySelectorAll("[data-task]").forEach((el) => {
      const t = F.state.tasks.find((t) => t.id === el.dataset.task);
      el.classList.toggle("recommended", !t.done && t.priority === day.energy);
    });
  });
})(FF);
