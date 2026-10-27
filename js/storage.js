/* All storage access is guarded, including malformed JSON. */
(function (F) {
  F.storageKey = "focusflow.lab.v1";
  F.storageBlocked = false;
  F.valid = (s) =>
    s &&
    s.version === 1 &&
    ["tasks", "habits", "sessions", "parking"].every((k) =>
      Array.isArray(s[k]),
    ) &&
    s.days &&
    typeof s.days === "object" &&
    !Array.isArray(s.days) &&
    s.settings &&
    typeof s.settings === "object";
  F.load = () => {
    try {
      const raw = localStorage.getItem(F.storageKey);
      if (raw) {
        const value = F.normalize
          ? F.normalize(JSON.parse(raw))
          : JSON.parse(raw);
        if (!F.valid(value)) throw Error("Неверный формат");
        F.state = {
          ...F.defaults(),
          ...value,
          settings: { ...F.defaults().settings, ...value.settings },
        };
      }
    } catch (e) {
      F.storageBlocked = true;
      F.toast(
        "Хранилище недоступно или повреждено. Работа продолжается в памяти; экспортируйте данные.",
      );
    }
  };
  F.save = () => {
    if (F.storageBlocked) return;
    try {
      localStorage.setItem(F.storageKey, JSON.stringify(F.state));
    } catch (e) {
      F.storageBlocked = true;
      F.toast("Не удалось сохранить. Экспортируйте данные перед закрытием.");
    }
  };
  F.on("init", F.load);
})(FF);
