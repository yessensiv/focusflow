/* Opening ritual: a clear intention, never a mandatory interruption. */
(function (F) {
  F.beforeTimerStart = () => {
    if (F.state.timer.mode !== "focus") {
      F.timerToggle();
      return;
    }
    const minutes = F.state.timer.duration / 60000;
    const d = F.modal(
      "Одна ясная мысль.",
      '<p class="muted">Что должно получиться за ' +
        minutes +
        ' минут?</p><form id="intention-form"><label>Ваше намерение<textarea name="intention" rows="3" maxlength="180" placeholder="Когда время закончится, я…"></textarea></label><div class="row"><button class="accent">Начать с намерением</button><button type="button" id="skip-intention">Пропустить</button></div></form>',
    );
    const begin = (text) => {
      F.state.timer.intention = text;
      d.close();
      F.timerToggle();
      F.render();
    };
    d.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      begin(new FormData(e.target).get("intention").trim());
    };
    d.querySelector("#skip-intention").onclick = () => begin("");
  };
})(FF);

/* Closing ritual and an optional, evidence-based next session length. */
(function (F) {
  F.smartLength = () => {
    const rated = F.state.sessions.filter((s) => !s.demo && s.rating).slice(-3);
    return rated.length === 3 && rated.every((s) => s.rating >= 4) ? 50 : 25;
  };
  F.on("session-complete", (session) => {
    const d = F.modal(
      "Как прошло?",
      '<p class="muted">Оцените качество внимания. Эта оценка — для вас.</p><form id="rating-form"><fieldset><legend>От одной до пяти капель</legend><div class="rating-drops">' +
        [1, 2, 3, 4, 5]
          .map(
            (n) =>
              '<label><input type="radio" name="rating" value="' +
              n +
              '" required><span>' +
              F.icon("habits") +
              n +
              "</span></label>",
          )
          .join("") +
        '</div></fieldset><label>Настроение<select name="mood"><option>спокойно</option><option>ясно</option><option>усталость</option><option>вдохновение</option></select></label><button class="accent">Сохранить ощущение</button></form>',
    );
    d.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const data = new FormData(e.target);
      session.rating = Number(data.get("rating"));
      session.mood = data.get("mood");
      F.save();
      d.close();
      F.render();
      F.toast(
        F.smartLength() === 50
          ? "Три сильные сессии подряд. Можно попробовать 50 минут."
          : "Оценка сохранена. Следующий шаг — в вашем темпе.",
      );
    };
  });
  F.on("render", (v) => {
    if (v !== "timer") return;
    const length = F.smartLength(),
      rated = F.state.sessions.filter((s) => !s.demo && s.rating).length;
    F.$(".timer-side").insertAdjacentHTML(
      "beforeend",
      '<div class="smart-length"><p class="mono muted">' +
        (rated ? "По вашим оценкам" : "Мягкий старт") +
        '</p><button id="smart-length">Попробовать ' +
        length +
        " минут</button></div>",
    );
    F.$("#smart-length").onclick = () => {
      if (F.state.timer.running || F.timeLeft() < F.state.timer.duration) {
        F.toast("Сначала завершите или сбросьте текущую сессию.");
        return;
      }
      F.state.settings.focus = length;
      F.state.timer = F.freshTimer("focus");
      F.save();
      F.render();
    };
  });
})(FF);

/* Closing a day is reversible; carrying tasks forward never deletes them. */
(function (F) {
  F.closeDay = () => {
    if (F.state.timer.running) {
      F.toast("Завершите или приостановите сессию перед закрытием дня.");
      return;
    }
    const tasks = F.state.tasks.filter((t) => !t.done && t.date <= F.day()),
      notes = F.state.parking.filter((p) => !p.resolved);
    const d = F.modal(
      "Закроем этот день.",
      '<form id="close-day-form"><fieldset><legend>Перенести на завтра</legend>' +
        tasks
          .map(
            (t) =>
              '<label class="check-line"><input type="checkbox" name="carry" value="' +
              F.esc(t.id) +
              '" checked><span>' +
              F.esc(t.title) +
              "</span></label>",
          )
          .join("") +
        (tasks.length ? "" : '<p class="muted">Незавершённых задач нет.</p>') +
        "</fieldset><fieldset><legend>Разобрать копилку</legend>" +
        notes
          .map(
            (p) =>
              '<label class="parking-resolve">' +
              F.esc(p.text) +
              '<select name="note-' +
              F.esc(p.id) +
              '"><option value="keep">Оставить в копилке</option><option value="task">В задачу на завтра</option><option value="archive">Отпустить</option></select></label>',
          )
          .join("") +
        '</fieldset><label>Одно слово об этом дне<input name="word" required maxlength="24" placeholder="Например, ясность"></label><button class="accent">Запечатать колбу</button></form>',
    );
    d.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const data = new FormData(e.target),
        word = data.get("word").trim();
      if (!word) return;
      const carry = new Set(data.getAll("carry"));
      F.state.tasks.forEach((t) => {
        if (carry.has(t.id)) t.date = F.dateOffset(1);
      });
      for (const note of notes) {
        const action = data.get("note-" + note.id);
        if (action === "task") {
          F.state.tasks.push({
            id: F.uid(),
            title: note.text.slice(0, 160),
            done: false,
            tag: "копилка",
            priority: "medium",
            estimate: 1,
            completed: 0,
            date: F.dateOffset(1),
            color: "blue",
          });
          note.resolved = "task";
        } else if (action === "archive") note.resolved = "archived";
      }
      F.today().word = word;
      F.today().closed = true;
      F.save();
      d.close();
      F.render();
      F.toast("День сохранён. Завтра будет новый сосуд.");
    };
  };
  F.todayWidgets.closing = () =>
    '<section class="close-day rule"><div><p class="mono muted">' +
    (new Date().getHours() >= 18 ? "Вечерний ритуал" : "Когда будете готовы") +
    "</p><h3>" +
    (F.today().closed
      ? "Слово дня — «" + F.esc(F.today().word) + "»."
      : "Оставить день <em>в прошлом.</em>") +
    '</h3><p class="muted">' +
    F.state.tasks.filter((t) => !t.done && t.date > F.day()).length +
    ' задач отложено на завтра.</p></div><button id="close-day">' +
    (F.today().closed ? "Открыть день снова" : "Закрыть день") +
    "</button></section>";
  F.on("render", (v) => {
    if (v === "today")
      F.$("#close-day").onclick = () => {
        if (F.today().closed)
          F.change(() => {
            F.today().closed = false;
            F.today().word = "";
          });
        else F.closeDay();
      };
  });
})(FF);
