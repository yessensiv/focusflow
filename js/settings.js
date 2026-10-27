/* Settings, schema validation and safe data ownership. */
(function (F) {
  const text = (v, max = 160) => (typeof v === "string" ? v.slice(0, max) : "");
  const date = (v) =>
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    F.day(new Date(v + "T12:00:00")) === v;
  const colors = ["lime", "coral", "blue"],
    priorities = ["low", "medium", "high"];
  const number = (v, min, max, fallback) =>
    Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  F.normalize = (raw) => {
    if (!F.valid(raw))
      throw Error("Это не файл FocusFlow лаборатории версии 1.");
    if (
      raw.tasks.length > 2000 ||
      raw.habits.length > 200 ||
      raw.sessions.length > 10000 ||
      raw.parking.length > 2000
    )
      throw Error("В файле слишком много записей.");
    const s = F.defaults(),
      ids = new Set();
    const id = (v) => {
      if (typeof v !== "string" || !v || v.length > 100 || ids.has(v))
        throw Error("Некорректные или повторяющиеся идентификаторы.");
      ids.add(v);
      return v;
    };
    s.seeded = true;
    s.demo = raw.demo === true;
    s.tasks = raw.tasks.map((t) => {
      if (!t || !text(t.title).trim()) throw Error("У задачи нет названия.");
      return {
        id: id(t.id),
        title: text(t.title),
        tag: text(t.tag, 30) || "личное",
        priority: priorities.includes(t.priority) ? t.priority : "medium",
        color: colors.includes(t.color) ? t.color : "lime",
        estimate: Math.round(number(t.estimate, 1, 20, 1)),
        completed: Math.round(number(t.completed, 0, 10000, 0)),
        date: date(t.date) ? t.date : F.day(),
        done: t.done === true,
      };
    });
    s.habits = raw.habits.map((h) => {
      if (
        !h ||
        !text(h.title, 80).trim() ||
        !h.checks ||
        typeof h.checks !== "object" ||
        Array.isArray(h.checks)
      )
        throw Error("Некорректная привычка.");
      const checks = {};
      for (const [day, value] of Object.entries(h.checks)) {
        if (
          date(day) &&
          (value === "mini" ||
            (Number.isFinite(value) && value >= 0 && value <= 20))
        )
          checks[day] = value;
      }
      return {
        id: id(h.id),
        title: text(h.title, 80),
        emoji: text(h.emoji, 8),
        color: colors.includes(h.color) ? h.color : "lime",
        target: Math.round(number(h.target, 1, 20, 1)),
        frequency: h.frequency === "weekdays" ? "weekdays" : "daily",
        after: text(h.after, 100) || null,
        checks,
      };
    });
    s.habits.forEach((h, i) => {
      if (!s.habits.slice(0, i).some((p) => p.id === h.after)) h.after = null;
    });
    s.sessions = raw.sessions.map((v) => {
      if (
        !v ||
        !date(v.day) ||
        !Number.isFinite(v.minutes) ||
        v.minutes <= 0 ||
        v.minutes > 120 ||
        !Number.isFinite(v.finishedAt)
      )
        throw Error("Некорректная сессия.");
      return {
        id: id(v.id),
        day: v.day,
        minutes: v.minutes,
        finishedAt: v.finishedAt,
        title: text(v.title) || "Чистый фокус",
        color: colors.includes(v.color) ? v.color : "lime",
        taskId: text(v.taskId, 100) || null,
        habitId: text(v.habitId, 100) || null,
        intention: text(v.intention, 180),
        rating: Math.round(number(v.rating, 1, 5, 0)),
        mood: text(v.mood, 40),
        demo: v.demo === true,
      };
    });
    for (const [day, value] of Object.entries(raw.days)) {
      if (date(day) && value && typeof value === "object")
        s.days[day] = {
          energy: priorities.includes(value.energy) ? value.energy : "medium",
          goal: s.tasks.some((t) => t.id === value.goal) ? value.goal : null,
          word: text(value.word, 24),
          closed: value.closed === true,
        };
    }
    s.parking = raw.parking.map((v) => {
      if (!v || !text(v.text, 500).trim()) throw Error("Некорректная мысль.");
      return {
        id: id(v.id),
        text: text(v.text, 500),
        day: date(v.day) ? v.day : F.day(),
        resolved: ["task", "archived"].includes(v.resolved)
          ? v.resolved
          : false,
      };
    });
    for (const key of ["focus", "short", "long"])
      s.settings[key] = Math.round(
        number(
          raw.settings[key],
          1,
          key === "focus" ? 120 : 60,
          s.settings[key],
        ),
      );
    s.settings.weeklyGoal = Math.round(
      number(raw.settings.weeklyGoal, 25, 10080, 600),
    );
    s.settings.theme = ["dark", "light", "auto"].includes(raw.settings.theme)
      ? raw.settings.theme
      : "dark";
    for (const key of ["sound", "ambient", "notifications"])
      s.settings[key] = raw.settings[key] === true;
    if (raw.timer) {
      const t = raw.timer;
      if (
        !["focus", "short", "long"].includes(t.mode) ||
        !Number.isFinite(t.duration) ||
        t.duration < 60000 ||
        t.duration > 7200000 ||
        !Number.isFinite(t.remaining) ||
        t.remaining < 0 ||
        t.remaining > t.duration ||
        (t.running && (!Number.isFinite(t.endsAt) || t.endsAt <= 0))
      )
        throw Error("Некорректный таймер.");
      s.timer = {
        id: text(t.id, 100) || F.uid(),
        mode: t.mode,
        duration: t.duration,
        remaining: t.remaining,
        running: t.running === true,
        endsAt: t.running ? t.endsAt : null,
        intention: text(t.intention, 180),
        taskId: s.tasks.some((x) => x.id === t.taskId) ? t.taskId : null,
        habitId: s.habits.some((x) => x.id === t.habitId) ? t.habitId : null,
      };
    }
    return s;
  };
  const systemTheme = matchMedia("(prefers-color-scheme:light)");
  F.applyTheme = () => {
    document.documentElement.dataset.theme =
      F.state.settings.theme === "auto"
        ? systemTheme.matches
          ? "light"
          : "dark"
        : F.state.settings.theme;
    const hour = new Date().getHours();
    document.documentElement.dataset.period =
      hour >= 6 && hour < 17 ? "day" : "night";
  };
  systemTheme.addEventListener("change", () => {
    if (F.state.settings.theme === "auto") F.applyTheme();
  });
  F.exportData = () => {
    const blob = new Blob([JSON.stringify(F.state, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "focusflow-lab-" + F.day() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    F.toast("Копия данных экспортирована.");
  };
  F.views.settings = () =>
    '<div class="screen-header"><div><p class="mono muted">Лаборатория под вас</p><h1>Ваш<br><em>собственный ритм.</em></h1></div></div><div class="settings-grid"><form id="settings-form" class="stack"><h3>Время и пространство</h3><div class="duration-settings">' +
    [
      ["focus", "Фокус", 120],
      ["short", "Короткий отдых", 60],
      ["long", "Длинный отдых", 60],
    ]
      .map(
        ([k, n, max]) =>
          "<label>" +
          n +
          '<span class="mono muted">Минуты</span><input name="' +
          k +
          '" type="number" min="1" max="' +
          max +
          '" value="' +
          F.state.settings[k] +
          '" required></label>',
      )
      .join("") +
    '</div><label>Недельная цель, минут<input name="weeklyGoal" type="number" min="25" max="10080" value="' +
    F.state.settings.weeklyGoal +
    '" required></label><label>Тема<select name="theme"><option value="dark" ' +
    (F.state.settings.theme === "dark" ? "selected" : "") +
    '>Чернильная</option><option value="light" ' +
    (F.state.settings.theme === "light" ? "selected" : "") +
    '>Тёплая бумага</option><option value="auto" ' +
    (F.state.settings.theme === "auto" ? "selected" : "") +
    '>Как в системе</option></select></label><label class="check-line"><input type="checkbox" name="sound" ' +
    (F.state.settings.sound ? "checked" : "") +
    '>Капельный звук завершения</label><label class="check-line"><input type="checkbox" name="ambient" ' +
    (F.state.settings.ambient ? "checked" : "") +
    '>Тихий фон во время сессии</label><button class="accent">Сохранить настройки</button></form><section class="settings-data stack"><h3>То, что принадлежит вам</h3><p class="muted">Данные остаются в этом браузере. Сделайте копию перед переносом на другой компьютер.</p><button id="export-data">Экспорт JSON</button><label class="file-label">Импорт JSON<input id="import-data" type="file" accept=".json,application/json"></label><p id="import-status" role="status" class="muted"></p><button id="notify-permission">' +
    (F.state.settings.notifications
      ? "Отключить уведомления"
      : "Включить уведомления браузера") +
    '</button><small class="muted">На file:// поддержка уведомлений зависит от браузера. Сигнал в приложении работает без разрешения.</small><div class="rule"><h3>Чистый лист</h3><p class="muted">Удалит задачи, привычки, демоисторию и личные сессии. Сначала экспортируйте нужное.</p><button id="clear-data" class="danger">Очистить все данные</button></div></section></div>';
  F.on("render", (v) => {
    if (v !== "settings") return;
    F.$("#settings-form").onsubmit = (e) => {
      e.preventDefault();
      const data = new FormData(e.target),
        settings = { ...F.state.settings };
      for (const k of ["focus", "short", "long", "weeklyGoal"])
        settings[k] = Number(data.get(k));
      const changed = ["focus", "short", "long"].some(
        (k) => settings[k] !== F.state.settings[k],
      );
      if (
        changed &&
        (F.state.timer.running || F.timeLeft() < F.state.timer.duration)
      ) {
        F.toast(
          "Сначала завершите или сбросьте текущую сессию, затем измените длительность.",
        );
        return;
      }
      settings.theme = data.get("theme");
      settings.sound = data.has("sound");
      settings.ambient = data.has("ambient");
      F.state.settings = settings;
      if (changed) F.state.timer = F.freshTimer(F.state.timer.mode);
      F.save();
      F.applyTheme();
      F.ambientAudio();
      F.toast("Настройки сохранены.");
    };
    F.$("#export-data").onclick = F.exportData;
    F.$("#import-data").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        if (file.size > 2 * 1024 * 1024)
          throw Error("Размер файла превышает 2 МБ.");
        const next = F.normalize(JSON.parse(await file.text()));
        if (
          !confirm(
            "Заменить текущую лабораторию данными из файла? Экспортируйте текущие данные, если они нужны.",
          )
        )
          return;
        F.state = next;
        F.state.timer ??= F.freshTimer();
        F.storageBlocked = false;
        F.save();
        F.applyTheme();
        F.ambientAudio();
        F.render();
        F.toast("Лаборатория восстановлена.");
      } catch (error) {
        F.$("#import-status").textContent =
          "Импорт не выполнен: " + error.message;
      } finally {
        const input = F.$("#import-data");
        if (input) input.value = "";
      }
    };
    F.$("#clear-data").onclick = () => {
      if (
        !confirm(
          "Удалить все данные этой лаборатории? Отменить удаление можно только импортом своей копии.",
        )
      )
        return;
      F.state = F.defaults();
      F.state.seeded = true;
      F.state.timer = F.freshTimer();
      F.storageBlocked = false;
      try {
        localStorage.removeItem(F.storageKey);
      } catch (e) {
        F.storageBlocked = true;
        F.toast("Хранилище недоступно: очищена только текущая сессия.");
      }
      F.save();
      F.applyTheme();
      F.ambientAudio();
      F.render();
    };
    F.$("#notify-permission").onclick = async () => {
      if (F.state.settings.notifications) {
        F.state.settings.notifications = false;
        F.save();
        F.render();
        return;
      }
      if (!("Notification" in window)) {
        F.toast("Этот браузер не поддерживает уведомления.");
        return;
      }
      try {
        const permission = await Notification.requestPermission();
        F.state.settings.notifications = permission === "granted";
        F.save();
        F.render();
        if (permission !== "granted")
          F.toast(
            "Разрешение не получено. Сигнал останется внутри приложения.",
          );
      } catch (e) {
        F.toast("Уведомления здесь недоступны.");
      }
    };
  });
  F.on("init", F.applyTheme);
  /* Command palette: native dialog focus trap plus arrow-key navigation. */
  F.commands = () => [
    ...Object.entries(F.names).map(([view, label]) => ({
      label: "Открыть: " + label,
      run: () => (location.hash = view),
    })),
    {
      label: "Таймер: начать / пауза",
      run: () => {
        if (
          F.beforeTimerStart &&
          !F.state.timer.running &&
          F.timeLeft() === F.state.timer.duration
        )
          F.beforeTimerStart();
        else F.timerToggle();
      },
    },
    { label: "Записать мысль", run: F.parkThought },
    { label: "Экспортировать данные", run: F.exportData },
    { label: "Закрыть день", run: F.closeDay },
  ];
  F.commandPalette = () => {
    const d = F.modal(
        "Что хотите сделать?",
        '<label><span class="sr-only">Найти команду</span><input id="command-search" placeholder="Начните вводить команду…" autocomplete="off"></label><div id="commands" class="command-list"></div>',
      ),
      input = d.querySelector("input");
    const paint = () => {
      const found = F.commands().filter((c) =>
        c.label.toLowerCase().includes(input.value.toLowerCase()),
      );
      d.querySelector("#commands").innerHTML = found.length
        ? found
            .map(
              (c, i) =>
                '<button data-command="' +
                i +
                '">' +
                F.esc(c.label) +
                F.icon("arrow") +
                "</button>",
            )
            .join("")
        : '<p class="muted">Такая команда не найдена.</p>';
      d.querySelectorAll("[data-command]").forEach(
        (b) =>
          (b.onclick = () => {
            const command = found[Number(b.dataset.command)];
            d.close();
            command.run();
          }),
      );
    };
    input.oninput = paint;
    d.addEventListener("keydown", (e) => {
      const buttons = [...d.querySelectorAll("[data-command]")];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const i = buttons.indexOf(document.activeElement),
          next = e.key === "ArrowDown" ? i + 1 : i - 1;
        buttons[(next + buttons.length) % buttons.length]?.focus();
      }
      if (e.key === "Enter" && e.target === input) {
        e.preventDefault();
        buttons[0]?.click();
      }
    });
    paint();
    input.focus();
  };
  addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      F.commandPalette();
    }
  });
  F.on("init", () => {
    const button = F.$("#palette-open");
    button.hidden = false;
    button.onclick = F.commandPalette;
  });
  /* Soft cursor is decorative; the native pointer remains as a precision aid. */
  F.on("init", () => {
    if (
      !matchMedia("(pointer:fine) and (prefers-reduced-motion:no-preference)")
        .matches
    )
      return;
    const cursor = document.createElement("div");
    cursor.className = "cursor-drop";
    cursor.setAttribute("aria-hidden", "true");
    document.body.append(cursor);
    let x = -100,
      y = -100,
      tx = -100,
      ty = -100,
      frame = 0;
    const animate = () => {
      const dx = tx - x,
        dy = ty - y;
      x += dx * 0.2;
      y += dy * 0.2;
      const speed = Math.min(Math.hypot(dx, dy) / 90, 0.6);
      cursor.style.transform =
        "translate(" +
        x +
        "px," +
        y +
        "px) rotate(" +
        Math.atan2(dy, dx) +
        "rad) scale(" +
        (1 + speed) +
        "," +
        (1 - speed * 0.35) +
        ")";
      if (Math.abs(dx) + Math.abs(dy) > 0.2)
        frame = requestAnimationFrame(animate);
      else frame = 0;
    };
    addEventListener("pointermove", (e) => {
      tx = e.clientX;
      ty = e.clientY;
      cursor.classList.toggle(
        "cursor-ring",
        !!e.target.closest("button,a,input,select,textarea"),
      );
      if (!frame) frame = requestAnimationFrame(animate);
    });
    document.addEventListener("mouseleave", () => (cursor.style.opacity = "0"));
    document.addEventListener("mouseenter", () => (cursor.style.opacity = ""));
  });
  /* Refresh local calendar boundaries without losing stored work. */
  let lastDay = F.day();
  F.on("init", () =>
    setInterval(() => {
      if (F.day() !== lastDay) {
        lastDay = F.day();
        F.applyTheme();
        F.render();
      }
    }, 30000),
  );
})(FF);
