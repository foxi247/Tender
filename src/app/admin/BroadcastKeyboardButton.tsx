'use client';

export default function BroadcastKeyboardButton() {
  async function handleClick() {
    if (!confirm('Отправить обновление клавиатуры всем активным пользователям?')) return;
    const res = await fetch('/api/broadcast-keyboard', { method: 'POST' });
    const data = await res.json();
    alert(`Отправлено: ${data.sent}, Ошибок: ${data.failed}`);
  }

  return (
    <button onClick={handleClick} className="btn-secondary">
      📲 Обновить клавиатуру
    </button>
  );
}
