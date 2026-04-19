import { useState, useEffect, useRef } from "react";

type RepeatType = "none" | "daily" | "weekly" | "monthly" | "yearly";

interface Todo {
  id: string;
  date: string;
  time: string;
  text: string;
  completed: boolean;
  repeat: RepeatType;
  reminder: string;
}

const STORAGE_KEY = "todo-calendar-todos";
const SETTINGS_KEY = "todo-calendar-settings";

interface Settings {
  bgOpacity: number;
  cardOpacity: number;
  accentHue: number;
}

const REPEAT_LABELS: Record<RepeatType, string> = {
  none: "",
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年",
};

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff));
  });
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [newTime, setNewTime] = useState("");
  const [newText, setNewText] = useState("");
  const [newRepeat, setNewRepeat] = useState<RepeatType>("none");
  const [newReminder, setNewReminder] = useState("");
  const [settings, setSettings] = useState<Settings>({ bgOpacity: 100, cardOpacity: 95, accentHue: 150 });
  const [showSettings, setShowSettings] = useState(false);
  const [showRepeatSelect, setShowRepeatSelect] = useState<string | null>(null);
  const [colWidth, setColWidth] = useState<number>(100);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const isResizingW = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setTodos(JSON.parse(stored)); } catch { setTodos([]); }
    }
    const settingsStored = localStorage.getItem(SETTINGS_KEY);
    if (settingsStored) {
      try { setSettings(JSON.parse(settingsStored)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const interval = setInterval(() => {
      checkReminders();
    }, 30000);
    return () => clearInterval(interval);
  }, [todos]);

  const checkReminders = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const currentDate = now.toISOString().split("T")[0];

    todos.forEach(todo => {
      if (!todo.completed && todo.reminder && todo.reminder === currentTime && todo.date === currentDate) {
        if (Notification.permission === "granted") {
          new Notification("待办提醒", { body: todo.text, icon: "" });
        }
      }
    });
  };

  const requestNotificationPermission = () => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    isResizingW.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = colWidth;
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizingW.current) return;
    const containerWidth = document.querySelector(".week-grid")?.clientWidth || 700;
    const delta = e.clientX - resizeStartX.current;
    const deltaPercent = (delta / containerWidth) * 100;
    const newWidth = Math.max(50, Math.min(200, resizeStartWidth.current + deltaPercent));
    setColWidth(newWidth);
  };

  const handleResizeEnd = () => {
    isResizingW.current = false;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  const getWeekDays = (start: Date): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const changeWeek = (delta: number) => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + delta * 7);
    setCurrentWeekStart(newStart);
  };

  const goToToday = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(now.setDate(diff)));
  };

  const getNextDate = (dateStr: string, repeat: RepeatType): string => {
    const date = new Date(dateStr + "T12:00:00");
    switch (repeat) {
      case "daily":
        date.setDate(date.getDate() + 1);
        break;
      case "weekly":
        date.setDate(date.getDate() + 7);
        break;
      case "monthly":
        date.setMonth(date.getMonth() + 1);
        break;
      case "yearly":
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return formatDate(date);
  };

  const hasTodos = (date: Date): boolean => {
    return todos.some(t => t.date === formatDate(date));
  };

  const getTodosForDate = (dateStr: string): Todo[] => {
    return todos.filter(t => t.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
  };

  const addTodo = () => {
    if (!selectedDate || !newTime.trim() || !newText.trim()) return;
    const newTodo: Todo = {
      id: Date.now().toString(),
      date: selectedDate,
      time: newTime,
      text: newText.trim(),
      completed: false,
      repeat: newRepeat,
      reminder: newReminder,
    };
    setTodos(prev => [...prev, newTodo]);
    setNewTime("");
    setNewText("");
    setNewRepeat("none");
    setNewReminder("");
    timeInputRef.current?.focus();
    if (newReminder && Notification.permission === "default") {
      requestNotificationPermission();
    }
  };

  const toggleTodo = (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    if (todo.completed && todo.repeat !== "none") {
      const nextDate = getNextDate(todo.date, todo.repeat);
      const nextTodo: Todo = {
        ...todo,
        id: Date.now().toString(),
        date: nextDate,
        completed: false,
      };
      setTodos(prev => [...prev.filter(t => t.id !== id), nextTodo]);
    } else {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    }
  };

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const updateTodoRepeat = (id: string, repeat: RepeatType) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, repeat } : t));
    setShowRepeatSelect(null);
  };

  const updateTodoReminder = (id: string, reminder: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, reminder } : t));
    if (reminder && Notification.permission === "default") {
      requestNotificationPermission();
    }
  };

  const moveTodo = (todoId: string, newDate: string) => {
    setTodos(prev => prev.map(t => t.id === todoId ? { ...t, date: newDate } : t));
  };

  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const today = formatDate(new Date());
  const weekDays = getWeekDays(currentWeekStart);
  const weekDaysZh = ["一", "二", "三", "四", "五", "六", "日"];
  const selectedTodos = selectedDate ? getTodosForDate(selectedDate) : [];

  const weekLabel = currentWeekStart.toLocaleDateString("zh-CN", { month: "long", day: "numeric" }) +
    " - " +
    new Date(currentWeekStart.getTime() + 6 * 86400000).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });

  const isDarkBg = settings.bgOpacity < 50;

  return (
    <div className="app">
      <header className="drag-bar">
        <span className="title">待办</span>
        <div className="drag-actions">
          <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>⚙</button>
          <button className="close-btn" onClick={() => window.close()}>×</button>
        </div>
      </header>

      {showSettings && (
        <div className="settings-panel">
          <div className="setting-item">
            <label>背景透明</label>
            <input type="range" min="0" max="100" value={settings.bgOpacity}
              onChange={e => setSettings(s => ({ ...s, bgOpacity: Number(e.target.value) }))} />
            <span>{settings.bgOpacity}%</span>
          </div>
          <div className="setting-item">
            <label>卡片透明</label>
            <input type="range" min="0" max="100" value={settings.cardOpacity}
              onChange={e => setSettings(s => ({ ...s, cardOpacity: Number(e.target.value) }))} />
            <span>{settings.cardOpacity}%</span>
          </div>
          <div className="setting-item">
            <label>主题色</label>
            <input type="range" min="0" max="360" value={settings.accentHue}
              onChange={e => setSettings(s => ({ ...s, accentHue: Number(e.target.value) }))} />
            <span>{settings.accentHue}°</span>
          </div>
        </div>
      )}

      <div className="resize-handle top" />
      <div className="resize-handle bottom" />
      <div className="resize-handle left" />
      <div className="resize-handle right" />
      <div className="resize-handle corner tl" />
      <div className="resize-handle corner tr" />
      <div className="resize-handle corner bl" />
      <div className="resize-handle corner br" />

      <div className="week-view">
        <div className="week-nav">
          <button onClick={() => changeWeek(-1)}>◀</button>
          <span className="week-label" onClick={goToToday}>{weekLabel}</span>
          <button onClick={() => changeWeek(1)}>▶</button>
          <div className="col-resize-handle" onMouseDown={handleResizeStart}>⋮</div>
        </div>

        <div className="week-grid" style={{ gridTemplateColumns: `repeat(7, ${colWidth}px)` }}>
          {weekDays.map((day, i) => {
            const dateStr = formatDate(day);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const isWeekend = i >= 5;
            const dayTodos = getTodosForDate(dateStr);

            return (
              <div
                key={i}
                className={`day-col ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${isWeekend ? "weekend" : ""} ${dragOverDate === dateStr ? "drag-over" : ""}`}
                onClick={() => setSelectedDate(dateStr)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverDate(dateStr);
                }}
                onDragLeave={() => setDragOverDate(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const todoId = e.dataTransfer.getData("todoId");
                  if (todoId) {
                    moveTodo(todoId, dateStr);
                  }
                  setDragOverDate(null);
                  setDraggingId(null);
                }}
              >
                <div className="day-header">
                  <span className="day-name">{weekDaysZh[i]}</span>
                  <span className="day-num">{day.getDate()}</span>
                </div>
                <div className="day-todos">
                  {dayTodos.map(todo => (
                    <div
                      key={todo.id}
                      className={`mini-todo ${todo.completed ? "completed" : ""} ${draggingId === todo.id ? "dragging" : ""}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("todoId", todo.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(todo.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverDate(null);
                      }}
                    >
                      <span className="mini-time">{todo.time}</span>
                      <span className="mini-text">{todo.text}</span>
                    </div>
                  ))}
                  {hasTodos(day) && dayTodos.length === 0 && (
                    <div className="has-todo-dot" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="detail">
        {selectedDate ? (
          <>
            <div className="detail-header">
              <h2>{new Date(selectedDate + "T12:00:00").toLocaleDateString("zh-CN", { weekday: "long", month: "long", day: "numeric" })}</h2>
            </div>
            <div className="add-form">
              <input ref={timeInputRef} type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="time-input" />
              <input type="text" placeholder="添加待办..." value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => e.key === "Enter" && addTodo()} className="text-input" />
              <button onClick={addTodo} className="add-btn">+</button>
            </div>
            <div className="todo-list">
              {selectedTodos.length === 0 ? (
                <div className="empty">暂无待办</div>
              ) : (
                selectedTodos.map(todo => (
                  <div key={todo.id} className={`todo-item ${todo.completed ? "completed" : ""}`}>
                    <button className={`checkbox ${todo.completed ? "checked" : ""}`} onClick={() => toggleTodo(todo.id)}>
                      {todo.completed && <span>✓</span>}
                    </button>
                    <span className="todo-time">{todo.time}</span>
                    <div className="todo-content">
                      <span className="todo-text">{todo.text}</span>
                      <div className="todo-meta">
                        {todo.repeat !== "none" && (
                          <span className="repeat-badge">{REPEAT_LABELS[todo.repeat]}</span>
                        )}
                        {todo.reminder && (
                          <span className="reminder-badge">🔔{todo.reminder}</span>
                        )}
                      </div>
                    </div>
                    <div className="todo-actions">
                      <button className="action-btn" onClick={() => setShowRepeatSelect(showRepeatSelect === todo.id ? null : todo.id)}>🔁</button>
                      <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>×</button>
                    </div>
                    {showRepeatSelect === todo.id && (
                      <div className="repeat-dropdown">
                        {(["none", "daily", "weekly", "monthly", "yearly"] as RepeatType[]).map(r => (
                          <button key={r} className={`dropdown-item ${todo.repeat === r ? "active" : ""}`} onClick={() => updateTodoRepeat(todo.id, r)}>
                            {r === "none" ? "不重复" : REPEAT_LABELS[r]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="no-selection">
            <p>点击日期查看/添加待办</p>
          </div>
        )}
      </div>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --bg: rgba(25, 25, 45, ${(100 - settings.bgOpacity) / 100});
          --card: rgba(40, 40, 65, ${settings.cardOpacity / 100});
          --text: ${isDarkBg ? '#ffffff' : '#1a1a2e'};
          --text-dim: ${isDarkBg ? '#8888aa' : '#666688'};
          --accent: hsl(${settings.accentHue}, 100%, 60%);
          --weekend: hsl(${(settings.accentHue + 30) % 360}, 80%, 60%);
          --danger: #ff5566;
        }
        body { font-family: system-ui, sans-serif; background: transparent; color: var(--text); overflow: hidden; }
        .app { display: flex; flex-direction: column; height: 100vh; padding: 0; position: relative; }
        .drag-bar { height: 36px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; background: rgba(0,0,0,0.3); -webkit-app-region: drag; user-select: none; flex-shrink: 0; }
        .drag-bar .title { font-size: 13px; font-weight: 600; color: var(--accent); }
        .drag-actions { display: flex; gap: 4px; -webkit-app-region: no-drag; }
        .drag-bar .settings-btn, .drag-bar .close-btn { width: 26px; height: 26px; border: none; background: transparent; color: var(--text-dim); font-size: 16px; cursor: pointer; border-radius: 4px; transition: all 0.2s; }
        .drag-bar .settings-btn:hover, .drag-bar .close-btn:hover { background: rgba(255,255,255,0.1); color: var(--text); }
        .drag-bar .close-btn:hover { background: rgba(255,85,102,0.3); color: var(--danger); }
        .settings-panel { position: absolute; top: 40px; right: 10px; background: var(--card); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; z-index: 100; min-width: 200px; }
        .setting-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .setting-item:last-child { margin-bottom: 0; }
        .setting-item label { font-size: 12px; color: var(--text-dim); width: 60px; }
        .setting-item input[type="range"] { flex: 1; height: 4px; -webkit-appearance: none; background: rgba(255,255,255,0.2); border-radius: 2px; outline: none; }
        .setting-item input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: var(--accent); border-radius: 50%; cursor: pointer; }
        .setting-item span { font-size: 11px; color: var(--accent); width: 36px; text-align: right; }
        .resize-handle { position: absolute; z-index: 10; }
        .resize-handle.top, .resize-handle.bottom { left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
        .resize-handle.top { top: 0; }
        .resize-handle.bottom { bottom: 0; }
        .resize-handle.left, .resize-handle.right { top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
        .resize-handle.left { left: 0; }
        .resize-handle.right { right: 0; }
        .resize-handle.corner { width: 16px; height: 16px; }
        .resize-handle.corner.tl { top: 0; left: 0; cursor: nwse-resize; }
        .resize-handle.corner.tr { top: 0; right: 0; cursor: nesw-resize; }
        .resize-handle.corner.bl { bottom: 0; left: 0; cursor: nesw-resize; }
        .resize-handle.corner.br { bottom: 0; right: 0; cursor: nwse-resize; }
        .week-view { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); overflow-y: auto; }
        .week-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .week-nav button { width: 28px; height: 28px; border: none; background: var(--card); color: var(--text); border-radius: 6px; cursor: pointer; font-size: 11px; transition: all 0.2s; }
        .week-nav button:hover { background: var(--accent); color: ${isDarkBg ? '#1a1a2e' : '#fff'}; }
        .week-label { font-size: 12px; font-weight: 600; cursor: pointer; }
        .col-resize-handle { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: var(--text-dim); cursor: ew-resize; font-size: 14px; border-radius: 4px; user-select: none; }
        .col-resize-handle:hover { background: rgba(255,255,255,0.1); color: var(--text); }
        .week-grid { display: grid; gap: 4px; }
        .day-col { background: var(--card); border-radius: 6px; padding: 6px; min-height: 60px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; }
        .day-col:hover { background: rgba(60,60,90,0.8); }
        .day-col.today { border: 2px solid var(--accent); }
        .day-col.selected { background: rgba(60,60,90,0.9); }
        .day-col.drag-over { border: 2px dashed var(--accent); background: rgba(100,100,150,0.4); }
        .day-col.weekend .day-name { color: var(--weekend); }
        .day-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 4px; }
        .day-name { font-size: 10px; color: var(--text-dim); }
        .day-num { font-size: 14px; font-weight: 600; }
        .day-todos { display: flex; flex-direction: column; gap: 2px; }
        .mini-todo { background: rgba(0,0,0,0.2); border-radius: 3px; padding: 2px 4px; font-size: 10px; display: flex; gap: 3px; align-items: center; cursor: grab; }
        .mini-todo.completed { opacity: 0.5; text-decoration: line-through; }
        .mini-todo.dragging { opacity: 0.4; }
        .mini-time { color: var(--accent); font-size: 9px; flex-shrink: 0; }
        .mini-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .more-todos { font-size: 9px; color: var(--text-dim); text-align: center; }
        .has-todo-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--accent); margin: 2px auto; }
        .detail { flex: 1; padding: 10px; display: flex; flex-direction: column; overflow-y: auto; }
        .detail-header h2 { font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--accent); }
        .add-form { display: flex; gap: 6px; margin-bottom: 6px; }
        .time-input { width: 70px; padding: 6px 8px; background: var(--card); border: 2px solid transparent; border-radius: 6px; color: var(--accent); font-size: 12px; outline: none; }
        .time-input:focus { border-color: var(--accent); }
        .text-input { flex: 1; padding: 6px 8px; background: var(--card); border: 2px solid transparent; border-radius: 6px; color: var(--text); font-size: 12px; outline: none; }
        .text-input:focus { border-color: var(--accent); }
        .text-input::placeholder { color: var(--text-dim); }
        .add-btn { width: 32px; height: 32px; border: none; background: var(--accent); color: ${isDarkBg ? '#1a1a2e' : '#fff'}; font-size: 18px; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .add-btn:hover { opacity: 0.9; }
        .add-options { display: flex; gap: 6px; margin-bottom: 8px; }
        .repeat-select, .reminder-input { padding: 5px 8px; background: var(--card); border: 2px solid transparent; border-radius: 6px; color: var(--text); font-size: 11px; outline: none; }
        .repeat-select { flex: 1; }
        .reminder-input { width: 90px; color: var(--accent); }
        .repeat-select:focus, .reminder-input:focus { border-color: var(--accent); }
        .todo-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
        .todo-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; background: var(--card); border-radius: 6px; animation: slideIn 0.2s ease-out; position: relative; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .checkbox { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--text-dim); background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; margin-top: 2px; }
        .checkbox:hover { border-color: var(--accent); }
        .checkbox.checked { background: var(--accent); border-color: var(--accent); }
        .checkbox.checked span { color: ${isDarkBg ? '#1a1a2e' : '#fff'}; font-size: 10px; font-weight: bold; }
        .todo-time { font-size: 11px; color: var(--accent); font-weight: 500; flex-shrink: 0; margin-top: 2px; }
        .todo-content { flex: 1; min-width: 0; }
        .todo-text { font-size: 12px; transition: all 0.2s; display: block; }
        .todo-item.completed .todo-text { text-decoration: line-through; color: var(--text-dim); }
        .todo-meta { display: flex; gap: 4px; margin-top: 2px; }
        .repeat-badge, .reminder-badge { font-size: 9px; padding: 1px 4px; background: rgba(0,0,0,0.2); border-radius: 3px; color: var(--text-dim); }
        .todo-actions { display: flex; gap: 2px; opacity: 0; transition: opacity 0.2s; }
        .todo-item:hover .todo-actions { opacity: 1; }
        .action-btn { width: 22px; height: 22px; border: none; background: transparent; color: var(--text-dim); font-size: 12px; cursor: pointer; border-radius: 4px; transition: all 0.2s; }
        .action-btn:hover { background: rgba(255,255,255,0.1); color: var(--text); }
        .delete-btn { width: 22px; height: 22px; border: none; background: transparent; color: var(--text-dim); font-size: 14px; cursor: pointer; border-radius: 4px; transition: all 0.2s; }
        .delete-btn:hover { color: var(--danger); background: rgba(255,85,102,0.2); }
        .repeat-dropdown { position: absolute; top: 100%; right: 10px; background: var(--card); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px; z-index: 50; min-width: 80px; }
        .dropdown-item { width: 100%; padding: 6px 8px; border: none; background: transparent; color: var(--text); font-size: 11px; text-align: left; cursor: pointer; border-radius: 4px; transition: all 0.2s; }
        .dropdown-item:hover { background: rgba(255,255,255,0.1); }
        .dropdown-item.active { color: var(--accent); }
        .empty, .no-selection { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-dim); font-size: 12px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--card); border-radius: 3px; }
      `}</style>
    </div>
  );
}

export default App;
