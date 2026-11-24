import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, History, ChartNoAxesCombined, Settings, Sun, Moon, Plus, Search, Package, Gamepad2, Monitor, Banknote, ArrowLeftRight, ArrowRight, ArrowLeft, Download, Pencil, Trash2, X, Check, FileText, CheckCircle2, CircleHelp, Percent, CalendarDays, ChevronDown } from 'lucide-react';
import './style.css';
import './preview-bridge.js';

const rub = value => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
const dayLabel = period => period === 'day' ? 'День' : 'Ночь';
const dateLabel = date => date.split('-').reverse().join('.');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const sum = (shift, kind) => shift?.items.filter(i => !kind || i.kind === kind).reduce((a, i) => a + i.unitPrice * i.quantity, 0) || 0;
const paymentLabels = { cash: 'Наличка', transfer: 'Перевод', unknown: 'Не указано' };
const paidSum = (shift, method) => shift.items.filter(i => (i.paymentMethod || 'unknown') === method).reduce((a,i) => a + i.unitPrice * i.quantity,0);
const net = (value, discount) => Math.round(Number(value) * (100-discount)/100);
const activeOf = data => data.shifts.find(s => s.status === 'active');
const icons = { ledger: LayoutDashboard, history: History, stats: ChartNoAxesCombined, settings: Settings };
const names = { ledger: 'Учёт', history: 'История', stats: 'Статистика', settings: 'Настройки' };

function Button({ children, variant = '', className = '', ...props }) {
  return <button className={`button ${variant} ${className}`} {...props}>{children}</button>;
}
function IconButton({ title, children, ...props }) {
  return <button className="icon-button" title={title} aria-label={title} {...props}>{children}</button>;
}
function Badge({ shift }) {
  const Icon = shift.period === 'day' ? Sun : Moon;
  return <span className={`badge ${shift.period}`}><Icon size={13}/>{dayLabel(shift.period)}</span>;
}
function Modal({ title, children, close }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === ref.current) close(); }}><div className="modal"><div className="modal-head"><h2>{title}</h2><IconButton title="Закрыть" onClick={close}><X size={20}/></IconButton></div>{children}</div></dialog>;
}
function Empty({ icon: Icon = FileText, title, text, children }) {
  return <div className="empty"><div className="empty-icon"><Icon size={28}/></div><h2>{title}</h2><p>{text}</p>{children}</div>;
}
function PaymentButtons({ disabled = false }) {
  return <div className="payment-buttons"><Button variant="primary" type="submit" name="paymentMethod" value="cash" disabled={disabled}><Banknote size={17}/>Наличка</Button><Button variant="transfer" type="submit" name="paymentMethod" value="transfer" disabled={disabled}><ArrowLeftRight size={17}/>Перевод</Button></div>;
}
function PaymentSummary({ shift }) {
  const methods = shift.items.some(i => !i.paymentMethod) ? ['cash','transfer','unknown'] : ['cash','transfer'];
  return <div className="payment-summary" aria-label="Итоги по способам оплаты"><span>По оплате</span>{methods.map(method => <div key={method} className={`payment-total ${method}`}><span>{paymentLabels[method]}</span><strong>{rub(paidSum(shift,method))}</strong></div>)}</div>;
}
function Summary({ shift }) {
  return <><div className="summary-grid">
    <div className="metric"><span className="metric-label">Товары <Package size={17}/></span><strong>{rub(sum(shift, 'product'))}</strong><small>{shift.items.filter(i => i.kind === 'product').reduce((a,i) => a+i.quantity,0)} шт. в учёте</small></div>
    <div className="metric"><span className="metric-label">PS / услуги <Gamepad2 size={17}/></span><strong>{rub(sum(shift, 'service'))}</strong><small>{shift.items.filter(i => i.kind === 'service').length} позиций</small></div>
    <div className="metric pc"><span className="metric-label">ПК <Monitor size={17}/></span><strong>{rub(sum(shift, 'pc'))}</strong><small>Записей: {shift.items.filter(i => i.kind === 'pc').length}</small></div>
    <div className="metric total"><span className="metric-label">Общая сумма <ChartNoAxesCombined size={17}/></span><strong>{rub(sum(shift))}</strong><small>С учётом применённых скидок</small></div>
  </div><PaymentSummary shift={shift}/></>;
}
function ItemsTable({ shift, editable, onEdit, onDelete }) {
  if (!shift.items.length) return <Empty icon={Package} title="Здесь появятся добавленные позиции" text="Выберите товар, добавьте услугу PS или внесите сумму за ПК."/>;
  return <div className="table-scroll"><table><thead><tr><th className="number-col">№</th><th>Наименование</th><th>Группа</th><th>Оплата</th><th className="numeric">Кол-во</th><th className="numeric">Цена за ед.</th><th className="numeric">Сумма</th>{editable && <th className="actions-col"/>}</tr></thead><tbody>{shift.items.map((item,index) => <tr key={item.id}><td className="muted">{index+1}</td><td className="item-name">{item.name}</td><td><span className={`type-tag ${item.kind}`}>{{ product: 'Товар', service: 'PS', pc: 'ПК' }[item.kind]}</span></td><td><span className={`payment-tag ${item.paymentMethod || 'unknown'}`}>{paymentLabels[item.paymentMethod || 'unknown']}</span></td><td className="numeric">{item.quantity}</td><td className="numeric muted">{rub(item.unitPrice)}</td><td className="numeric strong">{rub(item.unitPrice*item.quantity)}</td>{editable && <td><div className="row-actions"><IconButton title={`Редактировать: ${item.name}`} onClick={() => onEdit(item)}><Pencil size={15}/></IconButton><IconButton title={`Удалить: ${item.name}`} onClick={() => onDelete(item)}><Trash2 size={15}/></IconButton></div></td>}</tr>)}</tbody></table></div>;
}

function AddPosition({ data, shift, run, busy, goSettings }) {
  const [tab, setTab] = useState('product');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [serviceName, setServiceName] = useState('');
  const [price, setPrice] = useState('');
  const [pcPrice, setPcPrice] = useState('');
  const [discount, setDiscount] = useState(false);
  const [suggestions, setSuggestions] = useState(false);
  const product = data.products.find(p => p.id === selected);
  const matches = data.products.filter(p => p.name.toLocaleLowerCase('ru').includes(query.toLocaleLowerCase('ru')));
  async function submit(event) {
    event.preventDefault();
    const paymentMethod = event.nativeEvent.submitter?.value;
    const command = tab === 'product'
      ? { type: 'addProduct', payload: { shiftId: shift.id, productId: selected, quantity: Number(quantity), paymentMethod } }
      : tab === 'pc'
        ? { type: 'addPc', payload: { shiftId: shift.id, price: Number(pcPrice), paymentMethod } }
        : { type: 'addService', payload: { shiftId: shift.id, name: serviceName, price: Number(price), discount, paymentMethod } };
    if (await run(command, 'Позиция добавлена')) {
      if (tab === 'service') { setServiceName(''); setPrice(''); setDiscount(false); }
      if (tab === 'pc') setPcPrice('');
      setQuantity(1);
    }
  }
  return <section className="panel add-panel"><div className="panel-heading"><h2>Добавить позицию</h2><span className="quiet">В текущий учёт</span></div>
    <div className="tabs"><button className={tab === 'product' ? 'selected' : ''} onClick={() => setTab('product')}><Package size={16}/>Товары</button><button className={tab === 'service' ? 'selected' : ''} onClick={() => setTab('service')}><Gamepad2 size={17}/>PS / услуги</button><button className={tab === 'pc' ? 'selected' : ''} onClick={() => setTab('pc')}><Monitor size={17}/>ПК</button></div>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {tab === 'product' ? !data.products.length ? <div className="catalog-hint">Список товаров пока пуст. <button type="button" className="text-button" onClick={goSettings}>Добавить в настройках <ArrowRight size={14}/></button></div> : <div className="add-fields product-fields">
        <label className="search-field">Товар<div className="input-icon"><Search size={17}/><input value={query} placeholder="Начните вводить название…" autoComplete="off" required onFocus={() => setSuggestions(true)} onBlur={() => setTimeout(() => setSuggestions(false),150)} onChange={e => { setQuery(e.target.value); setSelected(''); setSuggestions(true); }} aria-label="Поиск товара"/><ChevronDown size={15}/></div>
          {suggestions && <div className="suggestions">{matches.length ? matches.map(p => <button type="button" key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => { setSelected(p.id); setQuery(p.name); setSuggestions(false); }}><span>{p.name}</span><strong>{rub(net(p.price,data.settings.discount))}</strong></button>) : <div className="no-match">Ничего не найдено</div>}</div>}
        </label>
        <label>Количество<input type="number" min="1" max="100000" step="1" required value={quantity} onChange={e => setQuantity(e.target.value)}/></label>
        <label>Цена за ед.<div className="price-preview">{product ? rub(net(product.price,data.settings.discount)) : '—'}</div></label>
        <PaymentButtons disabled={!product}/>
      </div> : tab === 'pc' ? <div className="add-fields pc-fields">
        <label>Сумма, ₽<input type="number" min="0" max="1000000000" step="1" required value={pcPrice} placeholder="0" onChange={e => setPcPrice(e.target.value)}/></label>
        <PaymentButtons/>
      </div> : <div className="add-fields service-fields">
        <label>Услуга / описание<input value={serviceName} list="service-presets" placeholder="Например: ТВ3 — 1,5 часа" required maxLength="180" onChange={e => setServiceName(e.target.value)}/><datalist id="service-presets">{data.services.map(s => <option key={s.id} value={s.name}/>)}</datalist></label>
        <label>Сумма, ₽<input type="number" min="0" max="1000000000" step="1" required value={price} placeholder="0" onChange={e => setPrice(e.target.value)}/></label>
        <button className={`discount-toggle ${discount ? 'enabled' : ''}`} aria-pressed={discount} type="button" onClick={() => setDiscount(!discount)}><Percent size={16}/>Дисконт {data.settings.discount}%{discount && <Check size={14}/>}</button>
        <PaymentButtons/>
      </div>}
    </fieldset></form>
    {tab !== 'pc' && <div className="form-note"><Percent size={13}/>{tab === 'product' ? `Скидка ${data.settings.discount}% применяется к товарам автоматически.` : discount ? `К оплате: ${rub(net(price || 0,data.settings.discount))}. Скидка будет применена один раз.` : 'Введите полную сумму услуги. Если цена уже со скидкой, не включайте дисконт.'}</div>}
  </section>;
}

function StartForm({ run, busy, close, onStarted }) {
  const [date,setDate] = useState(today());
  const [period,setPeriod] = useState('day');
  return <form onSubmit={async e => { e.preventDefault(); if (await run({ type: 'start', payload: { date, period } }, 'Учёт начат')) onStarted(); }}><fieldset disabled={busy}>
    <p className="modal-description">Выберите дату и смену. Позиции будут сохраняться автоматически.</p>
    <label>Дата учёта<input type="date" min="1900-01-01" max="9999-12-31" value={date} required onChange={e => setDate(e.target.value)}/></label>
    <label className="spaced-label">Смена</label><div className="period-picker">{[['day',Sun,'День'],['night',Moon,'Ночь']].map(([v,Icon,label]) => <button type="button" className={period === v ? 'selected' : ''} key={v} onClick={() => setPeriod(v)}><Icon size={23}/>{label}{period === v && <Check size={16}/>}</button>)}</div>
    <p className="quiet">Для ночного учёта указывайте дату начала ночи.</p>
    <div className="modal-footer"><Button type="button" onClick={close}>Отмена</Button><Button variant="primary" type="submit">Начать учёт <ArrowRight size={16}/></Button></div>
  </fieldset></form>;
}
function ItemEdit({ item, shift, run, close, busy, discountRate }) {
  const [name,setName] = useState(item.name);
  const [price,setPrice] = useState(item.basePrice);
  const [quantity,setQuantity] = useState(item.quantity);
  const [payment,setPayment] = useState(item.paymentMethod || '');
  const [discount,setDiscount] = useState(item.discountPercent > 0);
  const rate = item.discountPercent || discountRate;
  return <form onSubmit={async e => { e.preventDefault(); if (await run({ type: 'editItem', payload: { shiftId: shift.id, itemId: item.id, name, price: Number(price), quantity: Number(quantity), discount, paymentMethod: payment || undefined } }, 'Позиция обновлена')) close(); }}><fieldset disabled={busy}>
    {item.kind === 'product' ? <><p className="modal-description">{item.name} · {rub(item.unitPrice)} за шт.</p><label>Количество<input type="number" required min="1" max="100000" step="1" value={quantity} onChange={e => setQuantity(e.target.value)}/></label><p className="quiet">Цена этой позиции сохранена на момент добавления. Новую цену можно задать в настройках для будущих добавлений.</p></> : item.kind === 'pc' ? <label>Сумма, ₽<input type="number" required min="0" max="1000000000" step="1" value={price} onChange={e => setPrice(e.target.value)}/></label> : <><label>Название услуги<input required maxLength="180" value={name} onChange={e => setName(e.target.value)}/></label><label className="spaced-label">Сумма до дисконта, ₽<input type="number" required min="0" max="1000000000" step="1" value={price} onChange={e => setPrice(e.target.value)}/></label><button type="button" className={`discount-toggle spaced-label ${discount ? 'enabled' : ''}`} aria-pressed={discount} onClick={() => setDiscount(!discount)}><Percent size={16}/>Дисконт {rate}%{discount && <Check size={16}/>}</button><p className="quiet">Итого: {rub(discount ? net(price,rate) : Number(price))}</p></>}
    <label className="spaced-label">Способ оплаты<select aria-label="Способ оплаты" value={payment} onChange={e => setPayment(e.target.value)}>{!item.paymentMethod && <option value="">Не указано (старая запись)</option>}<option value="cash">Наличка</option><option value="transfer">Перевод</option></select></label>
    <div className="modal-footer"><Button type="button" onClick={close}>Отмена</Button><Button variant="primary" type="submit">Сохранить</Button></div>
  </fieldset></form>;
}
function MetaEdit({ shift, run, close, busy }) {
  const [date,setDate] = useState(shift.date);
  const [period,setPeriod] = useState(shift.period);
  return <form onSubmit={async e => { e.preventDefault(); if (await run({type:'shiftMeta',payload:{shiftId:shift.id,date,period}},'Дата и смена сохранены')) close(); }}><fieldset disabled={busy}><label>Дата<input type="date" required min="1900-01-01" max="9999-12-31" value={date} onChange={e => setDate(e.target.value)}/></label><label className="spaced-label">Смена<select value={period} onChange={e => setPeriod(e.target.value)}><option value="day">День</option><option value="night">Ночь</option></select></label><div className="modal-footer"><Button type="button" onClick={close}>Отмена</Button><Button variant="primary" type="submit">Сохранить</Button></div></fieldset></form>;
}

function CatalogForm({ catalog, item, run, close, busy }) {
  const [name,setName] = useState(item?.name || '');
  const [price,setPrice] = useState(item?.price ?? '');
  return <form onSubmit={async e => { e.preventDefault(); if (await run({ type: 'catalogSave', payload: { catalog, id:item?.id, name, price:Number(price) } }, 'Список обновлён')) close(); }}><fieldset disabled={busy}>
    <label>Название<input autoFocus required maxLength="180" value={name} onChange={e => setName(e.target.value)} placeholder={catalog === 'products' ? 'Например: Вода 0,5 л' : 'Например: ТВ3 — 1 час'}/></label>
    {catalog === 'products' ? <label className="spaced-label">Исходная цена, ₽<input type="number" required min="0" max="1000000000" step="1" value={price} onChange={e => setPrice(e.target.value)}/></label> : <p className="quiet">Это заготовка названия. Сумму услуги вы вводите вручную при каждом добавлении.</p>}
    <div className="modal-footer"><Button type="button" onClick={close}>Отмена</Button><Button type="submit" variant="primary">Сохранить</Button></div>
  </fieldset></form>;
}
function SettingsPage({ data, run, busy, setModal, confirm }) {
  const [discount,setDiscount] = useState(data.settings.discount);
  return <><div className="page-title"><div><span className="eyebrow">ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>Настройки</h1><p>Товары, заготовки услуг и общий дисконт.</p></div></div>
    <section className="panel settings-discount"><div><div className="heading-icon"><Percent size={20}/><h2>Общий дисконт</h2></div><p>Автоматически для товаров, по кнопке — для PS.<br/>Изменение действует только на новые добавления.</p></div><form onSubmit={async e => { e.preventDefault(); await run({ type:'discount',payload:{discount:Number(discount)} },'Скидка сохранена'); }}><fieldset disabled={busy}><label>Скидка, %<input type="number" min="0" max="100" step="1" required value={discount} onChange={e => setDiscount(e.target.value)}/></label><Button variant="primary" type="submit">Сохранить</Button></fieldset></form></section>
    <div className="catalog-grid">{[['products','Товары',Package],['services','Заготовки PS',Gamepad2]].map(([catalog,title,Icon]) => <section className="panel" key={catalog}><div className="panel-heading"><h2><Icon size={19}/>{title}<span className="count">{data[catalog].length}</span></h2><Button variant="small" disabled={busy} onClick={() => setModal({type:'catalog',catalog})}><Plus size={16}/>Добавить</Button></div>{data[catalog].length ? <div className="catalog-list">{data[catalog].map(item => <div className="catalog-row" key={item.id}><div><strong>{item.name}</strong>{catalog === 'products' && <small>{rub(item.price)} <span className="muted">→</span> <span className="green">{rub(net(item.price,data.settings.discount))} с дисконтом</span></small>}</div><div className="row-actions"><IconButton title={`Изменить: ${item.name}`} disabled={busy} onClick={() => setModal({type:'catalog',catalog,item})}><Pencil size={16}/></IconButton><IconButton title={`Удалить из настроек: ${item.name}`} disabled={busy} onClick={() => confirm(`Удалить «${item.name}»?`,'Позиция исчезнет из настроек. В существующих учётах она сохранится.',() => run({type:'catalogDelete',payload:{catalog,id:item.id}},'Позиция удалена'))}><Trash2 size={16}/></IconButton></div></div>)}</div> : <Empty icon={Icon} title={catalog === 'products' ? 'Добавьте первый товар' : 'Создайте заготовки услуг'} text={catalog === 'products' ? 'Укажите название и исходную цену.' : 'Удобные названия для быстрого ввода. Можно обойтись без заготовок.'}/>}</section>)}</div>
    <div className="local-info"><CheckCircle2 size={17}/><span>Данные хранятся на этом компьютере. Интернет для работы не нужен.</span></div>
  </>;
}

function HistoryPage({ data, open, confirm, run, busy }) {
  const [from,setFrom] = useState(''); const [to,setTo] = useState(''); const [period,setPeriod] = useState('all');
  const shifts = data.shifts.filter(s => s.status === 'closed' && (!from || s.date >= from) && (!to || s.date <= to) && (period === 'all' || s.period === period)).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const hasLegacy = shifts.some(s => s.items.some(i => !i.paymentMethod));
  return <><div className="page-title"><div><span className="eyebrow">ВСЁ ПОД РУКОЙ</span><h1>История учётов</h1><p>Завершённые смены и отчёты за любой день.</p></div></div>
    <div className="panel filters"><label>С даты<input type="date" value={from} onChange={e => setFrom(e.target.value)} max={to || '9999-12-31'}/></label><label>По дату<input type="date" value={to} onChange={e => setTo(e.target.value)} min={from || '1900-01-01'}/></label><label>Смена<select value={period} onChange={e => setPeriod(e.target.value)}><option value="all">Все смены</option><option value="day">День</option><option value="night">Ночь</option></select></label><button className="text-button" onClick={() => {setFrom('');setTo('');setPeriod('all');}}>Сбросить</button></div>
    <section className="panel"><div className="panel-heading"><h2>Завершённые учёты <span className="count">{shifts.length}</span></h2><strong>{rub(shifts.reduce((a,s) => a+sum(s),0))}</strong></div>{shifts.length ? <div className="table-scroll"><table><thead><tr><th>Дата / смена</th><th>Позиции</th><th className="numeric">Товары</th><th className="numeric">PS</th><th className="numeric">ПК</th><th className="numeric">Наличка</th><th className="numeric">Перевод</th>{hasLegacy && <th className="numeric">Не указано</th>}<th className="numeric">Итого</th><th/></tr></thead><tbody>{shifts.map(s => <tr key={s.id}><td><button className="date-link" onClick={() => open(s.id)}>{dateLabel(s.date)}<Badge shift={s}/></button><small className="shift-id">Учёт #{s.id.slice(0,8)}</small></td><td className="muted">{s.items.length}</td><td className="numeric muted">{rub(sum(s,'product'))}</td><td className="numeric muted">{rub(sum(s,'service'))}</td><td className="numeric muted">{rub(sum(s,'pc'))}</td><td className="numeric muted">{rub(paidSum(s,'cash'))}</td><td className="numeric muted">{rub(paidSum(s,'transfer'))}</td>{hasLegacy && <td className="numeric muted">{rub(paidSum(s,'unknown'))}</td>}<td className="numeric strong">{rub(sum(s))}</td><td><div className="row-actions"><IconButton title="Открыть отчёт" onClick={() => open(s.id)}><ArrowRight size={18}/></IconButton><IconButton title="Удалить учёт" disabled={busy} onClick={() => confirm('Удалить этот учёт?',`${dateLabel(s.date)} · ${dayLabel(s.period)}. Удаление нельзя отменить. Статистика будет пересчитана.`,() => run({type:'deleteShift',payload:{shiftId:s.id}},'Учёт удалён'))}><Trash2 size={16}/></IconButton></div></td></tr>)}</tbody></table></div> : <Empty icon={History} title="Учётов пока нет" text="Здесь появятся завершённые учёты. Если вы задали фильтр, попробуйте изменить даты."/>}</section>
  </>;
}
function StatsPage({ data }) {
  const [month,setMonth] = useState(today().slice(0,7));
  const [period,setPeriod] = useState('all');
  const shifts = data.shifts.filter(s => s.status === 'closed' && s.date.startsWith(`${month}-`) && (period === 'all' || s.period === period));
  const aggregate = { items: shifts.flatMap(s => s.items) };
  const days = new Map(); shifts.forEach(s => days.set(s.date,(days.get(s.date) || 0)+sum(s)));
  const sortedDays = [...days.entries()].sort((a,b) => a[0].localeCompare(b[0]));
  const max = Math.max(1,...days.values());
  return <><div className="page-title"><div><span className="eyebrow">ЦИФРЫ ВАШИХ СМЕН</span><h1>Статистика</h1><p>Суммы по завершённым учётам. Исправления учитываются автоматически.</p></div></div><div className="panel filters"><label>Месяц<input type="month" value={month} required onChange={e => {if(e.target.value)setMonth(e.target.value);}}/></label><label>Смена<select value={period} onChange={e => setPeriod(e.target.value)}><option value="all">Все смены</option><option value="day">День</option><option value="night">Ночь</option></select></label><span className="stats-count">Завершено учётов: <strong>{shifts.length}</strong></span></div><Summary shift={aggregate}/>
    <section className="panel"><div className="panel-heading"><h2>Выручка по дням</h2><span className="quiet">Товары, PS и ПК</span></div>{sortedDays.length ? <div className="daily-chart">{sortedDays.map(([date,value]) => <div className="daily-row" key={date}><span>{dateLabel(date)}</span><div className="bar-track"><div className="bar" style={{width:`${Math.max(value ? 1 : 0,value/max*100)}%`}}/></div><strong>{rub(value)}</strong></div>)}</div> : <Empty icon={ChartNoAxesCombined} title="Статистика появится после завершения учёта" text="Активный учёт пока не включён в эти суммы."/>}</section>
  </>;
}

function App() {
  const [data,setData] = useState(null);
  const [fatal,setFatal] = useState('');
  const [page,setPage] = useState('ledger');
  const [modal,setModal] = useState(null);
  const [reportId,setReportId] = useState(null);
  const [editing,setEditing] = useState(false);
  const [busy,setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');
  const [exporting,setExporting] = useState(false);
  useEffect(() => {
    if (!window.ledger) { setFatal('Откройте Dlya Adminov как приложение: через ярлык или командой npm run dev.'); return; }
    window.ledger.read().then(state => { setData(state); if(activeOf(state)) setModal({type:'resume'}); }).catch(e => setFatal(e.message));
  }, []);
  useEffect(() => { if(data) document.documentElement.dataset.theme = data.settings.theme; }, [data?.settings.theme]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''),3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if(!modal) setError(''); }, [modal]);
  async function run(command, message) {
    if(busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const result = await window.ledger.command(command);
      if (!result.ok) {setError(result.error);return false;}
      setData(result.state); if(message)setNotice(message); return true;
    } catch(e) {setError(`Не удалось выполнить действие: ${e.message}`);return false;}
    finally {busyRef.current = false; setBusy(false);}
  }
  const confirm = (title,text,action) => setModal({type:'confirm',title,text,action});
  const navigate = next => {setPage(next);setReportId(null);setEditing(false);setError('');};
  const openReport = (id, edit = false) => {setReportId(id);setEditing(edit);setError('');};
  async function download(shift) {
    setExporting(true);setError('');
    try {const result = await window.ledger.exportXlsx(shift.id); if(!result.ok)setError(result.error);else if(!result.canceled)setNotice('Отчёт сохранён в Excel');}
    catch(e) {setError(e.message);} finally {setExporting(false);}
  }
  if(fatal) return <div className="loading"><FileText size={35}/><h1>Dlya Adminov</h1><p>{fatal}</p></div>;
  if(!data) return <div className="loading">Открываем ваш учёт…</div>;
  const active = activeOf(data);
  const report = data.shifts.find(s => s.id === reportId);
  const shift = report || (page === 'ledger' ? active : null);
  const closeModal = () => {if(!busy)setModal(null);};
  const deleteItem = item => confirm(`Удалить «${item.name}»?`,'Позиция будет удалена из этого учёта.',() => run({type:'deleteItem',payload:{shiftId:shift.id,itemId:item.id}},'Позиция удалена'));
  const editItem = item => setModal({type:'item',item,shiftId:shift.id});
  return <div className="app"><aside className="sidebar"><div className="brand"><div className="brand-mark">da<span/></div><div>Dlya Adminov<small>Порядок в каждом дне</small></div></div><div className="nav-label">РАБОЧЕЕ МЕСТО</div><nav>{Object.keys(names).map(key => {const Icon = icons[key]; return <button key={key} className={page === key ? 'active' : ''} onClick={() => navigate(key)}><Icon size={19}/>{names[key]}{key === 'ledger' && active && <span className="nav-dot"/>}</button>;})}</nav><div className="sidebar-bottom"><div className="offline"><span/>Работает без интернета</div><button className="theme-button" disabled={busy} onClick={() => run({type:'theme',payload:{theme:data.settings.theme === 'light' ? 'dark' : 'light'}})}>{data.settings.theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}<span>{data.settings.theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}</span></button><div className="app-version">Dlya Adminov <span>1.2.0</span></div></div></aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb">Рабочее место <span>/</span> <strong>{report ? 'Отчёт' : names[page]}</strong></div><div className="topbar-date"><CalendarDays size={16}/>{dateLabel(today())}</div></header><main>
    {error && <div className="error" role="alert">{error}<IconButton title="Закрыть уведомление" onClick={() => setError('')}><X size={16}/></IconButton></div>}
    {report ? <>
      <button className="back-link" onClick={() => {setReportId(null);setEditing(false);}}><ArrowLeft size={16}/>{page === 'history' ? 'Назад в историю' : 'Вернуться в учёт'}</button>
      <div className="page-title"><div><span className="eyebrow">{editing ? 'РЕДАКТИРОВАНИЕ УЧЁТА' : 'ОТЧЁТ ПО СМЕНЕ'}</span><h1>{dateLabel(report.date)} <span className="title-period">— {dayLabel(report.period).toLowerCase()}</span></h1><p>{report.status === 'active' ? 'Промежуточный отчёт. Можно скачать и продолжить учёт.' : `Учёт #${report.id.slice(0,8)} · завершён`}</p></div><div className="title-actions">{report.status === 'closed' && <Button disabled={busy} onClick={() => setEditing(!editing)}>{editing ? <Check size={16}/> : <Pencil size={16}/>} {editing ? 'Готово' : 'Редактировать'}</Button>}<Button onClick={() => download(report)} disabled={exporting || busy}><Download size={17}/>{exporting ? 'Сохранение…' : 'Скачать XLSX'}</Button></div></div>
      <Summary shift={report}/>{editing && <><div className="edit-notice"><Pencil size={16}/>Изменения сохраняются сразу и обновляют статистику.<button className="text-button" onClick={() => setModal({type:'meta',shiftId:report.id})}>Изменить дату / смену</button></div><AddPosition key={report.id} data={data} shift={report} run={run} busy={busy} goSettings={() => navigate('settings')}/></>}
      <section className="panel"><div className="panel-heading"><h2>Позиции учёта <span className="count">{report.items.length}</span></h2><span className="quiet">Все цены итоговые</span></div><ItemsTable shift={report} editable={editing} onEdit={editItem} onDelete={deleteItem}/><div className="table-total"><span>Итого к оплате</span><strong>{rub(sum(report))}</strong></div></section>
      {report.status === 'active' && <div className="finish-footer"><p><CircleHelp size={17}/>Завершённый учёт сохранится в истории.</p><Button variant="primary" disabled={busy || exporting} onClick={() => confirm('Завершить учёт?', 'Все позиции сохранятся в истории, статистика обновится. После этого можно начать новый учёт.',async () => {const result = await run({type:'finish',payload:{shiftId:report.id}},'Учёт завершён'); if(result){setReportId(null);setPage('ledger');}return result;})}><CheckCircle2 size={18}/>Завершить учёт</Button></div>}
    </> : page === 'ledger' ? <>
      <div className="page-title"><div><span className="eyebrow">ВСЁ ДЛЯ УДОБНОГО УЧЁТА</span><h1>{active ? 'Текущий учёт' : 'Новая смена — чистый лист'}</h1><p>{active ? <><span>{dateLabel(active.date)}</span><span className="dot-separator">·</span><Badge shift={active}/><span className="status-text"><span/>Учёт идёт</span></> : 'Товары, PS, ПК и итог смены в одном месте.'}</p></div>{active ? <Button onClick={() => openReport(active.id)}><FileText size={17}/>Открыть отчёт <ArrowRight size={16}/></Button> : <Button variant="primary" onClick={() => setModal({type:'start'})}><Plus size={18}/>Начать учёт</Button>}</div>
      {active ? <><Summary shift={active}/><AddPosition key={active.id} data={data} shift={active} run={run} busy={busy} goSettings={() => navigate('settings')}/><section className="panel"><div className="panel-heading"><h2>Добавленные позиции <span className="count">{active.items.length}</span></h2><button className="text-button" onClick={() => setModal({type:'meta',shiftId:active.id})}><Pencil size={14}/>Дата и смена</button></div><ItemsTable shift={active} editable onEdit={editItem} onDelete={deleteItem}/>{active.items.length > 0 && <div className="table-total"><span>Итого</span><strong>{rub(sum(active))}</strong></div>}</section><div className="autosave"><CheckCircle2 size={14}/>Все изменения сохраняются автоматически</div></> : <><section className="welcome panel"><div className="welcome-art"><div className="art-orbit"/><div className="art-receipt"><div className="art-check"><Check size={25}/></div><span/><span/><span/><strong>Всё учтено.</strong></div><div className="art-mini"><Package size={22}/></div><div className="art-mini second"><Gamepad2 size={24}/></div></div><h2>Начните новый учёт</h2><p>Выберите дату, отметьте день или ночь<br/>и добавляйте товары, PS и ПК.</p><Button variant="primary" onClick={() => setModal({type:'start'})}><Plus size={18}/>Начать учёт</Button></section><div className="welcome-links"><button onClick={() => navigate('settings')}><Settings size={23}/><div><strong>Настройте список позиций</strong><span>Товары, цены, услуги и скидка</span></div><ArrowRight size={18}/></button><button onClick={() => navigate('history')}><History size={23}/><div><strong>Посмотрите прошлые смены</strong><span>История учётов и отчёты</span></div><ArrowRight size={18}/></button></div></>}
    </> : page === 'settings' ? <SettingsPage data={data} run={run} busy={busy} setModal={setModal} confirm={confirm}/> : page === 'history' ? <HistoryPage data={data} open={openReport} confirm={confirm} run={run} busy={busy}/> : <StatsPage data={data}/>}
    </main></div>
    {notice && <div className="toast" role="status"><CheckCircle2 size={18}/>{notice}</div>}
    {modal && <Modal title={modal.type === 'start' ? 'Начать учёт' : modal.type === 'resume' ? 'У вас есть незавершённый учёт' : modal.type === 'confirm' ? modal.title : modal.type === 'catalog' ? `${modal.item ? 'Изменить' : 'Добавить'} ${modal.catalog === 'products' ? 'товар' : 'заготовку PS'}` : modal.type === 'meta' ? 'Дата и смена' : 'Редактировать позицию'} close={closeModal}>
      {error && <div className="error" role="alert">{error}</div>}
      {modal.type === 'start' && <StartForm run={run} busy={busy} close={closeModal} onStarted={() => {setModal(null);navigate('ledger');}}/>}
      {modal.type === 'resume' && active && <><p className="modal-description">{dateLabel(active.date)} · {dayLabel(active.period)} · {rub(sum(active))}<br/>Все добавленные позиции сохранены.</p><div className="resume-buttons"><Button variant="primary" onClick={() => {setModal(null);navigate('ledger');}}>Продолжить учёт <ArrowRight size={16}/></Button><Button onClick={() => {setModal(null);navigate('ledger');openReport(active.id);}}>Начать новый: сначала завершить текущий</Button></div></>}
      {modal.type === 'confirm' && <><p className="modal-description">{modal.text}</p><div className="modal-footer"><Button onClick={closeModal} disabled={busy}>Отмена</Button><Button variant={modal.title.startsWith('Завершить') ? 'primary' : 'danger'} disabled={busy} onClick={async () => {if(await modal.action())setModal(null);}}>{busy ? 'Сохранение…' : modal.title.startsWith('Завершить') ? 'Завершить учёт' : 'Удалить'}</Button></div></>}
      {modal.type === 'catalog' && <CatalogForm catalog={modal.catalog} item={modal.item} run={run} close={closeModal} busy={busy}/>}
      {modal.type === 'item' && <ItemEdit item={modal.item} shift={data.shifts.find(s => s.id === modal.shiftId)} run={run} close={closeModal} busy={busy} discountRate={data.settings.discount}/>}
      {modal.type === 'meta' && <MetaEdit shift={data.shifts.find(s => s.id === modal.shiftId)} run={run} close={closeModal} busy={busy}/>}
    </Modal>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
