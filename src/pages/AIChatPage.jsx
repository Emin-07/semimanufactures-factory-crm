import { useState, useRef, useEffect, useCallback, useContext } from "react";
import { AppContext } from "../context/AppContext.js";
import { C } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { PageH, Btn, SearchBox } from "../components/ui/index.jsx";

const SYSTEM_PROMPT = `Ты — AI-помощник системы управления производством полуфабрикатов (пельмени, котлеты, вареники, голубцы, блинчики, чебуреки, хинкали и т.д.).

Система состоит из 20 разделов, охватывающих полный цикл: от закупки сырья до анализа прибыли.

Вот полный список разделов и их функции:

1. Dashboard — главный экран со сводкой: выпуск за сегодня, прибыль, долги магазинов, процент брака
2. Задания — оперативные задачи рабочим с детальным описанием: кто, что, сколько, статус, время
3. Товары — справочник: название, артикул, себестоимость, розничная цена, рецептура, фото, штрих-код
4. Выпуск — учёт произведённого: дата, время, смена, сотрудник, номенклатура, количество, номер партии
5. Планирование — план производства на день/неделю с учётом заказов магазинов и сезонного спроса
6. Партии/Брак — журнал партий (дата, номер, срок годности, остаток, статус) и брака (тип, причина, утилизация, сумма убытка)
7. Сырьё/Поставки/Закупки — остатки муки, мяса, лука, масла, яиц, специй; закупки у поставщиков с ценами и датами; контроль сроков годности
8. Магазины/Продажи/Долги — база торговых точек, история отгрузок, долги с разбивкой по срокам
9. Доска заказов — канбан: статусы заказов от магазинов (новый → в производстве → собран → отгружен → оплачен)
10. KPI/Расчёт оплаты — зарплата рабочих (сдельная + премия), KPI по выпуску, браку, посещаемости
11. Посещаемость — электронный журнал: открытие/закрытие смены, отметки прихода и ухода, опоздания, прогулы
12. Отчёты — формирование сводок за период по выпуску, продажам, браку, зарплате, остаткам
13. Прибыль — финансовая аналитика: валовая/чистая прибыль, рентабельность, графики динамики
14. Пользователи — ролевая модель: админ, технолог, мастер, кладовщик, бухгалтер, директор
15. Журнал — лог всех действий: кто, когда, что изменил
16. Камеры — видеонаблюдение за цехом и складом в реальном времени
17. Смены — график, состав смены, часы работы, пересменка
18. Инвентаризация — пересчёт остатков сырья и готовой продукции с формированием акта
19. Списание — утилизация просроченного сырья и брака с указанием причины и ответственного
20. Настройки — параметры предприятия: нормы, лимиты, проценты, конфигурация

Правила ответов:
- Отвечай только на русском языке, кратко (1-5 предложений).
- Если вопрос про конкретную операцию — объясни пошагово: какой раздел, какую кнопку нажать.
- Примеры типовых сценариев:
  • Оформление выпуска: Задание → Выпуск → Партия
  • Отгрузка магазину: Заказ на доске → Собрать → Отгрузить → Продажа
  • Расчёт зарплаты: Посещаемость → Выпуск → KPI → Расчёт
- При вопросах про цифры — уточни период/магазин/сотрудника.
- Если функционала нет в системе — скажи честно.
- Будь дружелюбным, но деловым.`;

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openrouter/owl-alpha";
const MAX_HISTORY = 30;
const CONTEXT_WINDOW = 10;

const WELCOME = {
  role: "assistant",
  content: "Привет! Я AI-помощник системы Dikanish. Готов ответить на вопросы по любому разделу — от заданий и выпуска до расчёта зарплаты и отчётов. Чем могу помочь?",
  ts: new Date().toISOString(),
};

const QUICK_SECTIONS = [
  { label: "Dashboard",       q: ["Что сегодня на дашборде?"] },
  { label: "Задания",         q: ["Как создать задание?", "Какие задания в работе?"] },
  { label: "Товары",          q: ["Как добавить новый товар?"] },
  { label: "Выпуск",          q: ["Как зафиксировать выпуск продукции?"] },
  { label: "Планирование",    q: ["Как сформировать план на день?"] },
  { label: "Партии / Брак",   q: ["Как списать брак?", "Какие партии на складе?"] },
  { label: "Сырьё",           q: ["Какое сырьё заканчивается?", "Как оформить поставку?"] },
  { label: "Магазины",        q: ["Сколько должны магазины?", "Как отгрузить товар?"] },
  { label: "Доска заказов",   q: ["Как создать заказ?"] },
  { label: "KPI / Оплата",    q: ["Как рассчитать зарплату?"] },
  { label: "Посещаемость",    q: ["Кто работал сегодня?", "Как открыть смену?"] },
  { label: "Отчёты",          q: ["Покажи отчёт по прибыли"] },
  { label: "Прибыль",         q: ["Какая прибыль за месяц?"] },
  { label: "Пользователи",    q: ["Как добавить пользователя?"] },
  { label: "Камеры",          q: ["Как открыть камеры цеха?"] },
  { label: "Смены",           q: ["Какая смена сейчас работает?"] },
  { label: "Инвентаризация",  q: ["Как провести инвентаризацию?"] },
  { label: "Списание",        q: ["Как списать просрочку?"] },
  { label: "Настройки",       q: ["Где настроить нормы выработки?"] },
];

function BotAvatar() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 10, flexShrink: 0,
      background: `linear-gradient(135deg, rgba(91,141,181,.35), rgba(91,141,181,.12))`,
      border: `1px solid rgba(91,141,181,.35)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: C.info, fontSize: 15,
    }}>✦</div>
  );
}

function UserAvatar({ name }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 10, flexShrink: 0,
      background: `linear-gradient(135deg, rgba(200,150,62,.30), rgba(200,150,62,.10))`,
      border: `1px solid rgba(200,150,62,.30)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: C.primary, fontWeight: 800, fontSize: 13,
    }}>{(name || "?").charAt(0)}</div>
  );
}

function MessageBubble({ msg, userName }) {
  const isUser = msg.role === "user";
  const isError = msg.isError;

  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      gap: 8,
      alignItems: "flex-start",
      animation: "softFadeIn .25s ease",
    }}>
      {isUser ? <UserAvatar name={userName} /> : <BotAvatar />}
      <div style={{
        maxWidth: "72%",
        padding: "10px 14px",
        borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
        background: isUser
          ? `linear-gradient(135deg, rgba(200,150,62,.22), rgba(200,150,62,.10))`
          : isError
            ? `rgba(196,78,61,.18)`
            : `rgba(255,255,255,.06)`,
        border: isUser
          ? `1px solid rgba(200,150,62,.28)`
          : isError
            ? `1px solid rgba(196,78,61,.30)`
            : `1px solid rgba(255,255,255,.09)`,
        color: isError ? C.danger : C.text,
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {msg.content}
        <div style={{ fontSize: 10, color: C.dim, marginTop: 4, textAlign: isUser ? "right" : "left" }}>
          {msg.ts ? new Date(msg.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : ""}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <BotAvatar />
      <div style={{
        padding: "12px 16px",
        borderRadius: "4px 16px 16px 16px",
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.09)",
        display: "flex", alignItems: "center", gap: 6,
        animation: "softFadeIn .2s ease",
      }}>
        <span style={{ color: C.info, fontSize: 18, animation: "pulseGlow 1.2s ease-in-out infinite" }}>✎</span>
        <span style={{ color: C.dim, fontSize: 12 }}>Думает...</span>
      </div>
    </div>
  );
}

export function AIChatPage() {
  const { currentUser } = useContext(AppContext);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [showQuick, setShowQuick] = useState(true);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const sendMessage = useCallback(async (text) => {
    const q = (text !== undefined ? text : input).trim();
    if (!q || busy) return;

    const ts = new Date().toISOString();
    setBusy(true);
    setInput("");

    setMessages(prev => {
      const updated = [...prev, { role: "user", content: q, ts }];
      if (updated.length > MAX_HISTORY + 1) {
        return [updated[0], ...updated.slice(-(MAX_HISTORY))];
      }
      return updated;
    });

    try {
      const historyForApi = [...messages, { role: "user", content: q }]
        .filter(m => m !== WELCOME)
        .slice(-CONTEXT_WINDOW)
        .map(({ role, content }) => ({ role, content }));

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...historyForApi,
          ],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${errBody ? ": " + errBody.slice(0, 120) : ""}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || "Не удалось получить ответ от AI.";

      setMessages(prev => {
        const updated = [...prev, { role: "assistant", content: reply, ts: new Date().toISOString() }];
        if (updated.length > MAX_HISTORY + 1) {
          return [updated[0], ...updated.slice(-(MAX_HISTORY))];
        }
        return updated;
      });
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Ошибка соединения с AI: ${err.message}. Проверьте подключение к интернету и повторите попытку.`,
        isError: true,
        ts: new Date().toISOString(),
      }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [input, busy, messages]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([WELCOME]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const filteredSections = QUICK_SECTIONS
    .map(s => ({
      ...s,
      q: s.q.filter(q => !filter || q.toLowerCase().includes(filter.toLowerCase())),
    }))
    .filter(s => s.q.length > 0 || (!filter || s.label.toLowerCase().includes(filter.toLowerCase())));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* Header */}
      <PageH title="Помощник">
        <Btn
          v="secondary" sz="sm"
          onClick={() => setShowQuick(p => !p)}
          icon={<I.menu size={14} />}
          style={{ opacity: showQuick ? 1 : 0.5 }}
        >
          Подсказки
        </Btn>
        <Btn v="ghost" sz="sm" onClick={clearChat} icon={<I.x size={14} />}>
          Очистить
        </Btn>
      </PageH>

      {/* Sub-header */}
      <div style={{
        fontSize: 12, color: C.dim, marginBottom: 14,
        padding: "0 2px",
      }}>
        AI-чат-бот системы управления производством · История: {messages.length - 1} сообщений
      </div>

      <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 0 }}>
        {/* Quick questions panel */}
        {showQuick && (
          <div style={{
            width: 230, flexShrink: 0,
            display: "flex", flexDirection: "column", gap: 10,
            background: "rgba(255,255,255,.035)",
            border: `1px solid rgba(255,255,255,.08)`,
            borderRadius: 16,
            padding: "12px 10px",
            overflowY: "auto",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: .6, paddingLeft: 4, paddingBottom: 4, borderBottom: `1px solid rgba(255,255,255,.07)` }}>
              Быстрые вопросы
            </div>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Фильтр..."
              style={{
                background: "rgba(255,255,255,.05)",
                border: `1px solid rgba(255,255,255,.10)`,
                borderRadius: 8, padding: "5px 9px",
                color: C.text, fontSize: 11,
                fontFamily: "inherit", outline: "none",
                width: "100%",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredSections.map(sec => (
                <div key={sec.label}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.dim, textTransform: "uppercase", letterSpacing: .4, marginBottom: 3, paddingLeft: 2 }}>
                    {sec.label}
                  </div>
                  {sec.q.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      disabled={busy}
                      style={{
                        width: "100%", textAlign: "left",
                        padding: "6px 9px",
                        borderRadius: 8,
                        background: "transparent",
                        border: `1px solid rgba(255,255,255,.07)`,
                        color: busy ? C.dim : C.muted,
                        fontSize: 11, fontFamily: "inherit",
                        cursor: busy ? "not-allowed" : "pointer",
                        marginBottom: 3,
                        transition: "all .15s ease",
                        lineHeight: 1.4,
                      }}
                      onMouseEnter={e => { if (!busy) { e.currentTarget.style.background = "rgba(200,150,62,.12)"; e.currentTarget.style.color = C.primary; e.currentTarget.style.borderColor = "rgba(200,150,62,.22)"; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = "rgba(255,255,255,.07)"; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Messages */}
          <div
            ref={chatRef}
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "14px",
              background: "rgba(0,0,0,.18)",
              border: `1px solid rgba(255,255,255,.07)`,
              borderRadius: 16,
            }}
          >
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} userName={currentUser?.name} />
            ))}
            {busy && <TypingIndicator />}
          </div>

          {/* Input bar */}
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-end",
            padding: "10px 12px",
            background: "rgba(255,255,255,.04)",
            border: `1px solid rgba(255,255,255,.09)`,
            borderRadius: 14,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Задайте вопрос... (Enter — отправить, Shift+Enter — перенос строки)"
              disabled={busy}
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                color: busy ? C.dim : C.text,
                fontSize: 13,
                fontFamily: "inherit",
                lineHeight: 1.5,
                maxHeight: 120,
                overflowY: "auto",
                paddingTop: 4,
              }}
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={busy || !input.trim()}
              style={{
                padding: "8px 18px",
                borderRadius: 10,
                border: "none",
                background: busy || !input.trim()
                  ? "rgba(255,255,255,.07)"
                  : `linear-gradient(135deg, ${C.primary}, rgba(200,150,62,.75))`,
                color: busy || !input.trim() ? C.dim : "#1a1208",
                fontWeight: 700, fontSize: 13,
                fontFamily: "inherit",
                cursor: busy || !input.trim() ? "not-allowed" : "pointer",
                flexShrink: 0,
                transition: "all .18s ease",
                boxShadow: busy || !input.trim() ? "none" : "0 4px 14px rgba(200,150,62,.28)",
              }}
            >
              {busy ? "..." : "Отправить"}
            </button>
          </div>

          <div style={{ fontSize: 10, color: C.dim, textAlign: "center", paddingBottom: 2 }}>
            Powered by OpenRouter · История: последние {CONTEXT_WINDOW} сообщений отправляются в AI
          </div>
        </div>
      </div>
    </div>
  );
}
