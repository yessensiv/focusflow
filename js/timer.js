/* Timestamp engine: interval only paints, never measures elapsed time. */
(function (F) {
  F.modeNames = { focus: "Фокус", short: "Выдох", long: "Длинный отдых" };
  F.freshTimer = (mode = "focus") => ({
    id: F.uid(),
    mode,
    duration: F.state.settings[mode] * 60000,
    remaining: F.state.settings[mode] * 60000,
    endsAt: null,
    running: false,
    intention: "",
    taskId: null,
    habitId: null,
  });
  F.timeLeft = () => {
    const t = F.state.timer;
    return t ? Math.max(0, t.running ? t.endsAt - Date.now() : t.remaining) : 0;
  };
  F.timerText = () => {
    const s = Math.ceil(F.timeLeft() / 1000);
    return (
      String(Math.floor(s / 60)).padStart(2, "0") +
      ":" +
      String(s % 60).padStart(2, "0")
    );
  };
  F.timerToggle = () => {
    const t = F.state.timer;
    // A delayed click may arrive after the deadline but before the paint tick.
    if (t.running && F.timeLeft() === 0) {
      F.finishTimer();
      return;
    }
    if (t.running) {
      t.remaining = F.timeLeft();
      t.running = false;
      t.endsAt = null;
    } else {
      t.endsAt = Date.now() + t.remaining;
      t.running = true;
    }
    F.save();
    F.paintTimer();
    F.emit("timer-toggle", t.running);
  };
  F.resetTimer = () => {
    const t = F.state.timer;
    if (
      (t.running || F.timeLeft() < t.duration) &&
      !confirm("Сбросить сессию? Незавершённое время не попадёт в колбу.")
    )
      return;
    F.state.timer = F.freshTimer(t.mode);
    F.save();
    F.render();
  };
  F.skipTimer = () => {
    if (!confirm("Пропустить сессию без записи времени?")) return;
    F.state.timer = F.freshTimer(
      F.state.timer.mode === "focus" ? "short" : "focus",
    );
    F.save();
    F.render();
  };
  F.finishTimer = () => {
    const t = F.state.timer;
    if (!t.running) return;
    let session = null;
    if (t.mode === "focus" && !F.state.sessions.some((s) => s.id === t.id)) {
      session = {
        id: t.id,
        day: F.day(new Date(t.endsAt)),
        minutes: t.duration / 60000,
        finishedAt: t.endsAt,
        color: "lime",
        title: t.intention || "Чистый фокус",
        intention: t.intention,
        taskId: t.taskId,
        habitId: t.habitId,
        demo: false,
      };
      F.state.sessions.push(session);
    }
    const count = F.state.sessions.filter((s) => !s.demo).length;
    F.state.timer = F.freshTimer(
      t.mode === "focus" ? (count % 4 === 0 ? "long" : "short") : "focus",
    );
    F.save();
    F.render();
    if (session) F.emit("session-complete", session);
    F.emit("timer-complete", t.mode);
    F.toast("Сессия завершена. Ещё одна порция внимания сохранена.");
  };
  F.paintTimer = () => {
    const t = F.state.timer;
    if (!t) return;
    document.documentElement.dataset.mode = t.mode;
    const digits = F.$("#timer-digits");
    if (digits) {
      const text = F.timerText();
      if (digits.dataset.time !== text) {
        digits.innerHTML = [...text]
          .map(
            (c, i) =>
              '<span class="digit ' +
              (digits.dataset.time?.[i] !== c ? "digit-change" : "") +
              '">' +
              c +
              "</span>",
          )
          .join("");
        digits.dataset.time = text;
      }
    }
    document.title = t.running
      ? F.timerText() + " · FocusFlow"
      : "FocusFlow — лаборатория фокуса";
    const button = F.$("#timer-start");
    if (button) {
      button.innerHTML =
        F.icon(t.running ? "pause" : "play") +
        " " +
        (t.running
          ? "Пауза"
          : F.timeLeft() < t.duration
            ? "Продолжить"
            : "Начать");
      button.setAttribute(
        "aria-label",
        t.running ? "Пауза таймера" : "Запустить таймер",
      );
    }
    F.$(".timer-vessel")?.style.setProperty(
      "--fill",
      100 * (1 - F.timeLeft() / t.duration) + "%",
    );
    document.body.classList.toggle("timer-paused", !t.running);
    const live = F.$(".live-pour");
    if (live) {
      const elapsed =
        t.mode === "focus" ? (t.duration - F.timeLeft()) / 60000 : 0;
      const base = Math.min(
        100,
        (F.totalMinutes(F.sessionsFor(F.day())) / 240) * 100,
      );
      live.style.bottom = base + "%";
      live.style.height = Math.min(100 - base, (elapsed / 240) * 100) + "%";
      live.title = "Текущая сессия ещё не сохранена";
    }
  };
  F.timerBindings = () =>
    '<label class="timer-binding">Задача<select id="timer-task"><option value="">Свободный фокус</option>' +
    F.state.tasks
      .filter((t) => !t.done || t.id === F.state.timer.taskId)
      .map(
        (t) =>
          '<option value="' +
          F.esc(t.id) +
          '" ' +
          (F.state.timer.taskId === t.id ? "selected" : "") +
          ">" +
          F.esc(t.title) +
          "</option>",
      )
      .join("") +
    '</select></label><label class="timer-binding">Привычка<select id="timer-habit"><option value="">Без привычки</option>' +
    F.state.habits
      .map(
        (h) =>
          '<option value="' +
          F.esc(h.id) +
          '" ' +
          (F.state.timer.habitId === h.id ? "selected" : "") +
          ">" +
          F.esc(h.title) +
          "</option>",
      )
      .join("") +
    "</select></label>";
  F.timerModes = () =>
    '<div class="mode-tabs" role="group" aria-label="Режим таймера">' +
    Object.entries(F.modeNames)
      .map(
        ([k, n]) =>
          '<button data-mode="' +
          k +
          '" aria-pressed="' +
          (F.state.timer.mode === k) +
          '">' +
          n +
          "</button>",
      )
      .join("") +
    "</div>";
  F.timerVisual = () =>
    '<div class="timer-vessel glass"><div class="measure-lines" aria-hidden="true"><span>100</span><span>75</span><span>50</span><span>25</span></div><div class="vessel-liquid" aria-hidden="true"><i class="bubble b1"></i><i class="bubble b2"></i><i class="bubble b3"></i><svg class="wave wave-back" viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0 20Q50 0 100 20T200 20T300 20T400 20V40H0Z"/></svg><svg class="wave wave-front" viewBox="0 0 400 40" preserveAspectRatio="none"><path d="M0 20Q50 0 100 20T200 20T300 20T400 20V40H0Z"/></svg></div><div class="vessel-time"><span class="mono">' +
    F.modeNames[F.state.timer.mode] +
    '</span><div id="timer-digits" role="timer" aria-label="Осталось времени">' +
    F.timerText() +
    '</div><span class="mono">Минута за минутой</span></div></div>';
  F.views.timer = () =>
    '<div class="screen-header"><div><p class="mono muted">Время принимает форму</p><h1>Глубже<br><em>в момент.</em></h1></div><p class="muted">Одна задача. Один сосуд.<br>Ничего лишнего.</p></div><div class="timer-stage"><div class="timer-side"><p class="mono">' +
    F.modeNames[F.state.timer.mode] +
    '</p><p id="intention-display">' +
    F.esc(F.state.timer.intention || "Оставьте место для одной важной мысли.") +
    "</p>" +
    F.timerBindings() +
    '</div><div class="timer-center">' +
    F.timerModes() +
    F.timerVisual() +
    '<div class="timer-controls"><button id="timer-start" class="accent">Начать</button><button id="timer-reset" aria-label="Сбросить таймер">Сброс</button><button id="timer-skip" aria-label="Пропустить сессию">Пропустить</button></div></div><div class="timer-note"><span class="mono">Ваше внимание<br>имеет вес</span><p>Каждая сессия —<br>новый слой<br><em>вашего дня.</em></p><button id="immerse">Погружение</button></div></div>';
  F.on("init", () => {
    F.state.timer ??= F.freshTimer();
    setInterval(() => {
      if (F.state.timer.running && F.timeLeft() === 0) F.finishTimer();
      else F.paintTimer();
    }, 250);
  });
  F.on("render", (v) => {
    if (v !== "timer") return;
    F.$("#timer-start").onclick = () => {
      if (
        F.beforeTimerStart &&
        !F.state.timer.running &&
        F.timeLeft() === F.state.timer.duration
      )
        F.beforeTimerStart();
      else F.timerToggle();
    };
    F.$("#timer-reset").onclick = F.resetTimer;
    F.$("#timer-skip").onclick = F.skipTimer;
    F.paintTimer();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && F.state.timer?.running && F.timeLeft() === 0)
      F.finishTimer();
  });
})(FF);

/* Mode changes discard only with explicit acknowledgement. */
(function (F) {
  F.on("render", (v) => {
    if (v !== "timer") return;
    document.querySelectorAll("[data-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          const t = F.state.timer;
          if (t.mode === b.dataset.mode) return;
          if (
            (t.running || F.timeLeft() < t.duration) &&
            !confirm("Сменить режим и сбросить незавершённую сессию?")
          )
            return;
          F.state.timer = F.freshTimer(b.dataset.mode);
          F.save();
          F.render();
        }),
    );
  });
})(FF);

/* Immersion hides surrounding UI but preserves a visible exit. */
(function (F) {
  F.immersion = (on) => {
    if (on && F.view !== "timer") {
      F.pendingImmersion = true;
      location.hash = "timer";
      return;
    }
    document.body.classList.toggle("immersed", on);
    let exit = F.$("#exit-immersion");
    if (on && !exit) {
      exit = document.createElement("button");
      exit.id = "exit-immersion";
      exit.textContent = "Выйти · Esc";
      exit.onclick = () => F.immersion(false);
      document.body.append(exit);
      exit.focus();
    }
    if (!on) {
      exit?.remove();
      F.$("#immerse")?.focus();
    }
  };
  F.on("render", (v) => {
    if (v === "timer") {
      F.$("#immerse").onclick = () => F.immersion(true);
      if (F.pendingImmersion) {
        F.pendingImmersion = false;
        F.immersion(true);
      }
    } else F.immersion(false);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") F.immersion(false);
  });
})(FF);

/* Keyboard controls do not steal typing, dialogs or native button activation. */
(function (F) {
  F.typing = (target) =>
    !!target.closest('input,textarea,select,[contenteditable="true"],dialog');
  addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || F.typing(e.target))
      return;
    const k = e.key.toLowerCase();
    if (k === " ") {
      if (e.target.closest("button,a")) return;
      e.preventDefault();
      if (
        F.beforeTimerStart &&
        !F.state.timer.running &&
        F.timeLeft() === F.state.timer.duration
      )
        F.beforeTimerStart();
      else F.timerToggle();
    }
    if (k === "r") F.resetTimer();
    if (k === "f") {
      if (F.view === "timer")
        F.immersion(!document.body.classList.contains("immersed"));
      else F.immersion(true);
    }
  });
  F.on("render", (v) => {
    if (v !== "timer") return;
    const button = F.$("#timer-start");
    if (
      matchMedia("(pointer:fine) and (prefers-reduced-motion:no-preference)")
        .matches
    ) {
      button.onpointermove = (e) => {
        const r = button.getBoundingClientRect();
        button.style.transform =
          "translate(" +
          (e.clientX - r.left - r.width / 2) * 0.08 +
          "px," +
          (e.clientY - r.top - r.height / 2) * 0.12 +
          "px)";
      };
      button.onpointerleave = () => (button.style.transform = "");
    }
    F.$(".timer-controls").insertAdjacentHTML(
      "afterend",
      '<p class="mono muted hotkey-hint">Пробел — пауза · R — сброс · F — погружение</p>',
    );
  });
})(FF);

/* Snapshots keep historical labels/colors meaningful after task edits. */
(function (F) {
  F.on("render", (v) => {
    if (v !== "timer") return;
    for (const [id, key] of [
      ["timer-task", "taskId"],
      ["timer-habit", "habitId"],
    ]) {
      const el = F.$("#" + id);
      el.disabled =
        F.state.timer.running || F.timeLeft() < F.state.timer.duration;
      el.onchange = () => {
        F.state.timer[key] = el.value || null;
        F.save();
      };
    }
  });
  F.on("session-complete", (session) => {
    const task = F.state.tasks.find((t) => t.id === session.taskId),
      habit = F.state.habits.find((h) => h.id === session.habitId);
    if (task) {
      task.completed = (task.completed || 0) + 1;
      session.title = task.title;
      session.color = task.color;
    }
    if (habit) {
      if (F.habitScheduled(habit, session.day))
        habit.checks[session.day] = Math.min(
          habit.target,
          (Number(habit.checks[session.day]) || 0) + 1,
        );
      if (!task) {
        session.title = habit.title;
        session.color = habit.color;
      }
    }
    F.save();
    F.render();
  });
})(FF);
