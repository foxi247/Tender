// Telegram inline and reply keyboards

export const FILTER_CATEGORIES = [
  'Бетон', 'Ракушечник', 'Кирпич', 'Цемент', 'Щебень',
  'Арматура', 'Газобетон', 'Песок', 'ЖБИ', 'Кровля',
  'Утеплитель', 'Асфальт', 'Трубы', 'Стройматериалы',
];

export const FILTER_REGIONS = [
  'Москва', 'Московская область', 'Санкт-Петербург', 'Ленинградская область',
  'Краснодарский край', 'Ростовская область', 'Свердловская область',
  'Республика Татарстан', 'Самарская область', 'Нижегородская область',
  'Воронежская область', 'Ставропольский край', 'Республика Крым',
  'Новосибирская область', 'Красноярский край',
];

export const BUDGET_PRESETS = [
  { label: 'Без лимита', value: 0 },
  { label: 'до 500 тыс', value: 500_000 },
  { label: 'до 1 млн', value: 1_000_000 },
  { label: 'до 3 млн', value: 3_000_000 },
  { label: 'до 5 млн', value: 5_000_000 },
  { label: 'до 10 млн', value: 10_000_000 },
  { label: 'до 50 млн', value: 50_000_000 },
];

type ButtonRow = Array<{ text: string; callback_data: string }>;

export function mainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '📋 Тендеры сегодня' }, { text: '⭐ Лучшие для меня' }],
      [{ text: '❤️ Избранное' }, { text: '🔧 В работе' }],
      [{ text: '📊 Анализ рынка' }, { text: '🤖 ИИ Чат' }],
      [{ text: '⚙️ Фильтры' }, { text: '❓ Помощь' }],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

export function aiChatKeyboard() {
  return {
    keyboard: [[{ text: '❌ Завершить ИИ Чат' }]],
    resize_keyboard: true,
    persistent: true,
  };
}

export function tenderActionsKeyboard(tenderId: string) {
  return {
    inline_keyboard: [
      [
        { text: '🔗 Открыть закупку', callback_data: `open_${tenderId}` },
        { text: '📄 Документация', callback_data: `docs_${tenderId}` },
      ],
      [
        { text: '❤️ Сохранить', callback_data: `fav_${tenderId}` },
        { text: '🔧 В работу', callback_data: `work_${tenderId}` },
        { text: '🙈 Скрыть', callback_data: `hide_${tenderId}` },
      ],
    ],
  };
}

export function paginationKeyboard(
  action: string,
  currentPage: number,
  totalPages: number,
  extra: Record<string, string> = {}
) {
  const extraStr = Object.entries(extra)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');

  const buttons = [];
  if (currentPage > 1) {
    buttons.push({
      text: '◀️ Назад',
      callback_data: `${action}_p${currentPage - 1}${extraStr ? `_${extraStr}` : ''}`,
    });
  }
  if (currentPage < totalPages) {
    buttons.push({
      text: 'Вперед ▶️',
      callback_data: `${action}_p${currentPage + 1}${extraStr ? `_${extraStr}` : ''}`,
    });
  }

  if (buttons.length === 0) return null;
  return { inline_keyboard: [buttons] };
}

export function favoriteToggledKeyboard(tenderId: string, isFavorite: boolean) {
  return {
    inline_keyboard: [
      [
        { text: '🔗 Открыть закупку', callback_data: `open_${tenderId}` },
        { text: '📄 Документация', callback_data: `docs_${tenderId}` },
      ],
      [
        {
          text: isFavorite ? '💔 Убрать из избранного' : '❤️ Сохранить',
          callback_data: `fav_${tenderId}`,
        },
        { text: '🔧 В работу', callback_data: `work_${tenderId}` },
        { text: '🙈 Скрыть', callback_data: `hide_${tenderId}` },
      ],
    ],
  };
}

export function showMoreKeyboard(action: string) {
  return {
    inline_keyboard: [[{ text: '➕ Показать ещё', callback_data: `more_${action}` }]],
  };
}

// ── Filter keyboards ─────────────────────────────────────────────────────────

export function filterMainMenuKeyboard(
  categories: string[],
  regions: string[],
  maxBudget: number | null
) {
  const catLabel = `📦 Категории${categories.length > 0 ? ` (${categories.length})` : ''}`;
  const regLabel = `📍 Регионы${regions.length > 0 ? ` (${regions.length})` : ''}`;
  const budgetLabel = maxBudget
    ? `💰 Бюджет: до ${maxBudget >= 1_000_000 ? `${maxBudget / 1_000_000} млн` : `${maxBudget / 1_000} тыс`}`
    : '💰 Бюджет: без лимита';

  return {
    inline_keyboard: [
      [
        { text: catLabel, callback_data: 'fc' },
        { text: regLabel, callback_data: 'fr' },
      ],
      [{ text: budgetLabel, callback_data: 'fb' }],
      [{ text: '✅ Сохранить и закрыть', callback_data: 'fd' }],
    ],
  };
}

export function filterCategoriesKeyboard(selectedCategories: string[]) {
  const rows: ButtonRow[] = [];
  for (let i = 0; i < FILTER_CATEGORIES.length; i += 2) {
    const row: ButtonRow = [];
    for (let j = i; j < Math.min(i + 2, FILTER_CATEGORIES.length); j++) {
      const cat = FILTER_CATEGORIES[j];
      row.push({
        text: `${selectedCategories.includes(cat) ? '✅' : '◻️'} ${cat}`,
        callback_data: `fct_${j}`,
      });
    }
    rows.push(row);
  }
  rows.push([{ text: '◀️ К фильтрам', callback_data: 'fm' }]);
  return { inline_keyboard: rows };
}

export function filterRegionsKeyboard(selectedRegions: string[]) {
  const rows: ButtonRow[] = [];
  for (let i = 0; i < FILTER_REGIONS.length; i += 2) {
    const row: ButtonRow = [];
    for (let j = i; j < Math.min(i + 2, FILTER_REGIONS.length); j++) {
      const reg = FILTER_REGIONS[j];
      row.push({
        text: `${selectedRegions.includes(reg) ? '✅' : '◻️'} ${reg}`,
        callback_data: `frt_${j}`,
      });
    }
    rows.push(row);
  }
  rows.push([{ text: '◀️ К фильтрам', callback_data: 'fm' }]);
  return { inline_keyboard: rows };
}

export function filterBudgetKeyboard(currentMax: number | null) {
  const rows: ButtonRow[] = [];
  for (let i = 0; i < BUDGET_PRESETS.length; i += 2) {
    const row: ButtonRow = [];
    for (let j = i; j < Math.min(i + 2, BUDGET_PRESETS.length); j++) {
      const preset = BUDGET_PRESETS[j];
      const isSelected = preset.value === 0 ? !currentMax : currentMax === preset.value;
      row.push({
        text: `${isSelected ? '✅' : '◻️'} ${preset.label}`,
        callback_data: `fbmax_${preset.value}`,
      });
    }
    rows.push(row);
  }
  rows.push([{ text: '◀️ К фильтрам', callback_data: 'fm' }]);
  return { inline_keyboard: rows };
}
