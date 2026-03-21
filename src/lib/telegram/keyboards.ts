// Telegram inline and reply keyboards

export function mainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '📋 Тендеры сегодня' }, { text: '⭐ Лучшие для меня' }],
      [{ text: '❤️ Избранное' }, { text: '🔧 В работе' }],
      [{ text: '⚙️ Фильтры' }, { text: '❓ Помощь' }],
    ],
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
