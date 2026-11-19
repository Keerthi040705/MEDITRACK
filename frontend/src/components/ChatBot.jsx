import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Api } from '../api/client';
import { safeLink } from '../utils/format';

/**
 * Floating "MediTrack Assistant" shown on every dashboard (doctor, patient, pharmacist).
 * Messages go to POST /api/chat, which answers from the user's live data.
 * - Buttons with a "tab" switch the dashboard tab, buttons with an "href" open a link.
 * - History is kept for this browser tab only (sessionStorage), per user.
 */
const WELCOME_CHIPS = {
 patient: ['My next appointment', 'How do I book online?', 'I have fever and cough'],
 doctor: ['Pending requests', 'Today’s schedule', 'Logs to review', 'My clinic location'],
 pharmacist: ['Low stock', 'Expired medicines', 'Today’s sales', 'Stock of paracetamol'],
};

const storageKey = (id) => `meditrack-chat-${id}`;
const loadHistory = (id) => {
 try {
 const v = JSON.parse(sessionStorage.getItem(storageKey(id)) || '[]');
 return Array.isArray(v) ? v : [];
 } catch {
 return [];
 }
};

/** Renders "**bold**", "_italic_" and new lines as React elements (no raw HTML). */
function RichText({ text }) {
 return String(text)
 .split('\n')
 .map((line, i) => (
 <div key={i} className="chat-line">
 {line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, j) => {
 if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={j}>{part.slice(2, -2)}</strong>;
 if (/^_[^_]+_$/.test(part)) return <em key={j}>{part.slice(1, -1)}</em>;
 return part;
 })}
 {!line && ' '}
 </div>
 ));
}

export default function ChatBot({ tabs = [], onNavigate }) {
 const { user } = useAuth();
 const [open, setOpen] = useState(false);
 const [input, setInput] = useState('');
 const [busy, setBusy] = useState(false);
 const [messages, setMessages] = useState(() => loadHistory(user.id));
 const endRef = useRef(null);
 const inputRef = useRef(null);
 const tabKeys = new Set(tabs.map((t) => t.key));

 useEffect(() => {
 try {
 sessionStorage.setItem(storageKey(user.id), JSON.stringify(messages.slice(-40)));
 } catch {
 /* storage unavailable - history just won't survive a reload */
 }
 }, [messages, user.id]);

 useEffect(() => {
 if (open) {
 endRef.current?.scrollIntoView({ block: 'end' });
 inputRef.current?.focus();
 }
 }, [open, messages, busy]);

 const send = async (text) => {
 const msg = String(text ?? input).trim();
 if (!msg || busy) return;
 setInput('');
 setMessages((m) => [...m, { from: 'me', text: msg }]);
 setBusy(true);
 try {
 const r = await Api.chat(msg);
 setMessages((m) => [...m, { from: 'bot', text: r.reply, actions: r.actions || [], chips: r.chips || [], kind: r.kind }]);
 } catch (e) {
 setMessages((m) => [...m, { from: 'bot', text: ` ${e.message}`, kind: 'error' }]);
 } finally {
 setBusy(false);
 }
 };

 const runAction = (a) => {
 if (a.tab && tabKeys.has(a.tab)) {
 onNavigate?.(a.tab);
 if (window.innerWidth < 640) setOpen(false); // give phones the screen back
 }
 };

 const last = messages[messages.length - 1];
 const chips = !messages.length ? WELCOME_CHIPS[user.role] || [] : last?.from === 'bot' ? last.chips || [] : [];

 return (
 <>
 <button
 type="button"
 className={`chat-fab ${open ? 'open' : ''}`}
 aria-label={open ? 'Close assistant' : 'Open MediTrack Assistant'}
 onClick={() => setOpen((v) => !v)}
 >
 {open ? '✕' : ''}
 </button>

 {open && (
 <div className="chat-panel" role="dialog" aria-label="MediTrack Assistant">
 <div className="chat-head">
 <div>
 <strong>MediTrack Assistant</strong>
 <small>Answers from your live MediTrack data</small>
 </div>
 {messages.length > 0 && (
 <button type="button" className="chat-clear" onClick={() => setMessages([])} title="Clear chat">Clear</button>
 )}
 </div>

 <div className="chat-body">
 {!messages.length && (
 <div className="chat-msg bot">
 <RichText text={`Hi ${user.name}! Ask me about your ${user.role === 'pharmacist' ? 'stock and sales' : user.role === 'doctor' ? 'appointments and patients' : 'appointments, medicines and symptoms'}, or tap a suggestion below.`} />
 </div>
 )}
 {messages.map((m, i) => (
 <div key={i} className={`chat-msg ${m.from} ${m.kind || ''}`}>
 <RichText text={m.text} />
 {m.actions?.length > 0 && (
 <div className="chat-actions">
 {m.actions.map((a, j) => {
 const href = a.href && safeLink(a.href);
 if (href) return <a key={j} className="chat-action" href={href} target="_blank" rel="noopener noreferrer">{a.label} </a>;
 if (a.tab && tabKeys.has(a.tab)) return <button key={j} type="button" className="chat-action" onClick={() => runAction(a)}>{a.label}</button>;
 return null;
 })}
 </div>
 )}
 </div>
 ))}
 {busy && <div className="chat-msg bot typing"><span /><span /><span /></div>}
 <div ref={endRef} />
 </div>

 {chips.length > 0 && !busy && (
 <div className="chat-chips">
 {chips.map((c) => (
 <button key={c} type="button" onClick={() => send(c)}>{c}</button>
 ))}
 </div>
 )}

 <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
 <input
 ref={inputRef}
 value={input}
 maxLength={500}
 onChange={(e) => setInput(e.target.value)}
 placeholder="Type a question…"
 aria-label="Message"
 />
 <button type="submit" disabled={busy || !input.trim()}>Send</button>
 </form>
 <div className="chat-foot">Not medical advice. In an emergency call 112 / 911.</div>
 </div>
 )}
 </>
 );
}
