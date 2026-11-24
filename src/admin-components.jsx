import React, { useState } from 'react';
import { Percent, Pencil } from 'lucide-react';
import { adminDay, adminDays, nextDate, DEFAULT_ADMIN_PERCENT } from './admin-stats.mjs';

const rub = amount => `${new Intl.NumberFormat('ru-RU').format(amount)} ₽`;
const formatDate = date => date.split('-').reverse().join('.');
const rateLabel = percent => `${new Intl.NumberFormat('ru-RU').format(percent)}%`;
const dayStatus = day => day.live ? 'Идёт учёт' : day.hasDay && day.hasNight ? 'День и ночь завершены' : day.hasDay ? 'Только день' : 'Только ночь';

export function AdminDayCard({ data, date, onEdit, busy }) {
  const day = adminDay(data,date);
  return <section className="panel admin-day" aria-label="Процент админов за сутки">
    <div className="admin-day-description"><span className="eyebrow">ДЕНЬ + НОЧЬ</span><h2><Percent size={18}/>Процент админов</h2><p>{formatDate(date)} 08:00 — {formatDate(nextDate(date))} 08:00</p><small>{day.live ? 'Текущий учёт включён в расчёт' : day.count ? dayStatus(day) : 'Учёты за эти сутки ещё не начаты'}</small></div>
    <div className="admin-day-base"><span>Общий итог за сутки</span><strong>{rub(day.revenue)}</strong><small>Товары + PS + ПК</small></div>
    <div className="admin-day-earned"><span>Админам · {rateLabel(day.percent)}</span><strong data-testid="admin-day-amount">{rub(day.amount)}</strong><button type="button" className="text-button" disabled={busy} onClick={() => onEdit(date)}><Pencil size={12}/>Ставка за сутки</button></div>
  </section>;
}

export function AdminSettings({ data, run, busy }) {
  const [percent,setPercent] = useState(data.settings.adminPercent ?? DEFAULT_ADMIN_PERCENT);
  return <section className="panel admin-settings"><div><h2><Percent size={19}/>Процент админов</h2><p>От общего итога за сутки: день и ночь с одной датой.<br/>Новая ставка действует для новых дат. Прошлые ставки сохраняются.</p></div><form onSubmit={async e => {e.preventDefault();await run({type:'adminPercent',payload:{percent:Number(percent)}},'Процент админов сохранён');}}><fieldset disabled={busy}><label>Процент админов, %<input type="number" min="0" max="100" step="0.01" required value={percent} onChange={e => setPercent(e.target.value)}/></label><button className="button primary" type="submit">Сохранить процент</button></fieldset></form></section>;
}

export function AdminRateForm({ data, date, run, busy, close }) {
  const [percent,setPercent] = useState(adminDay(data,date).percent);
  return <form onSubmit={async e => {e.preventDefault();if(await run({type:'adminRate',payload:{date,percent:Number(percent)}},'Ставка за сутки сохранена'))close();}}><fieldset disabled={busy}>
    <p className="modal-description">{formatDate(date)} · день + ночь.<br/>Эта ставка применяется ко всему итогу выбранных суток и пересчитывает начисление за эту дату.</p>
    <label>Процент админов, %<input autoFocus type="number" min="0" max="100" step="0.01" required value={percent} onChange={e => setPercent(e.target.value)}/></label>
    <div className="modal-footer"><button className="button" type="button" onClick={close}>Отмена</button><button className="button primary" type="submit">Сохранить ставку</button></div>
  </fieldset></form>;
}

export function AdminStatistics({ data, month, onEdit, busy }) {
  const days = adminDays(data,month);
  const earned = days.reduce((sum,day) => sum+day.amount,0);
  const revenue = days.reduce((sum,day) => sum+day.revenue,0);
  return <section className="panel admin-statistics" aria-label="Статистика процента админов"><div className="panel-heading"><div><h2><Percent size={18}/>Процент админов</h2><p className="quiet">Полные сутки: день + ночь. Текущий учёт включён; фильтр смен выше на этот расчёт не влияет.</p></div><div className="admin-month-total"><span>За месяц</span><strong data-testid="admin-month-amount">{rub(earned)}</strong></div></div>
    {days.length ? <div className="table-scroll"><table><thead><tr><th>Дата суток</th><th>Учёты</th><th className="numeric">Общий итог</th><th className="numeric">Процент</th><th className="numeric">Админам</th><th/></tr></thead><tbody>{days.map(day => <tr key={day.date}><td>{formatDate(day.date)}</td><td className="muted">{dayStatus(day)}</td><td className="numeric">{rub(day.revenue)}</td><td className="numeric">{rateLabel(day.percent)}</td><td className="numeric strong">{rub(day.amount)}</td><td><button type="button" className="icon-button" title={`Ставка за ${formatDate(day.date)}`} aria-label={`Ставка за ${formatDate(day.date)}`} disabled={busy} onClick={() => onEdit(day.date)}><Pencil size={15}/></button></td></tr>)}</tbody></table><div className="table-total"><span>Выручка за сутки выбранного месяца: {rub(revenue)}</span><strong>{rub(earned)}</strong></div></div> : <div className="admin-no-data">За этот месяц учётов пока нет.</div>}
  </section>;
}
