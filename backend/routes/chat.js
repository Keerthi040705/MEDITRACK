/**
 * MediTrack Assistant - POST /api/chat body: { message }
 *
 * A rule-based helper for all three dashboards. No API key and no external AI service:
 * 1. Safety first - emergency words get an "act now" answer before anything else.
 * 2. Intent matching - each role has a list of { match, answer } rules, checked in order.
 * 3. Answers use the logged-in user's LIVE data (appointments, stock, sales ...).
 * 4. Symptom sentences ("I have fever and cough") are sent to the Python symptom checker.
 *
 * Reply shape: { reply, actions: [{label, tab} | {label, href}], chips: [string], kind }
 * reply - text; "**bold**" and new lines are rendered by the React chat panel
 * actions - buttons: "tab" switches dashboard tab, "href" opens a safe http(s) link
 * chips - suggested next questions
 */
const express = require('express');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Order = require('../models/Order');
const HealthLog = require('../models/HealthLog');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { HttpError, asyncHandler, todayStr, round2 } = require('../utils/helpers');
const { callAiService } = require('./ai');

const router = express.Router();
router.use(protect);

const MAX_LEN = 500;
const money = (n) => `$${round2(n || 0).toFixed(2)}`; // same format as the React app
const isLink = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v);
const has = (text, ...words) => words.some((w) => (w instanceof RegExp ? w.test(text) : text.includes(w)));
const say = (reply, extra = {}) => ({ reply, actions: [], chips: [], kind: 'answer', ...extra });
const modeText = (m) => (m === 'ONLINE' ? ' Online' : ' In-person');
const placeText = (a) => [a.clinicAddress, a.clinicCity].filter(Boolean).join(', ');
const mapHref = (a) =>
 isLink(a.clinicMapUrl)
 ? a.clinicMapUrl
 : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeText(a))}`;

// ---------------------------------------------------------------- 1. safety
const EMERGENCY = [
 /severe chest pain|crushing chest|chest pain.*(sweat|arm|jaw)/,
 /can'?t breathe|cannot breathe|unable to breathe|choking/,
 /unconscious|passed out|fainted|not waking/,
 /stroke|face (is )?droop|slurred speech/,
 /seizure|convulsion|fits\b/,
 /overdose|poison/,
 /heavy bleeding|bleeding (a lot|heavily|won'?t stop)/,
 /anaphyla|throat (is )?swelling|swollen throat/,
];
const SELF_HARM = /suicid|kill myself|end my life|self[- ]?harm|hurt myself|want to die/;

function safetyReply(text) {
 if (SELF_HARM.test(text)) {
 return say(
 "I'm really sorry you're feeling this way. You don't have to go through it alone.\n" +
 '**Please talk to someone right now:**\n' +
 '• India: Tele-MANAS **14416** (free, 24×7) · Emergency **112**\n' +
 '• USA: call or text **988** · Elsewhere: your local emergency number\n' +
 'If you are in immediate danger, call emergency services or go to the nearest hospital. ' +
 'You can also reach out to someone you trust and tell them how you feel.',
 { kind: 'emergency' }
 );
 }
 if (EMERGENCY.some((r) => r.test(text))) {
 return say(
 ' **This sounds like a medical emergency.**\n' +
 'Call emergency services now (**112** in India, **911** in the USA) or go to the nearest emergency department. ' +
 "Don't wait for an online appointment, and don't drive yourself if you feel faint.\n" +
 'MediTrack cannot assess emergencies.',
 { kind: 'emergency' }
 );
 }
 return null;
}

// ---------------------------------------------------------------- 2. symptom words -> symptom-checker ids
const SYMPTOM_WORDS = {
 fever: [/fever|temperature|feverish/],
 fatigue: [/tired|fatigue|exhausted|lethargic|no energy|weakness/],
 shortness_of_breath: [/short(ness)? of breath|breathless|breathing (is )?(hard|difficult)/],
 chest_pain: [/chest (pain|tightness|pressure)/],
 frequent_urination: [/urinat|peeing|pee a lot|toilet a lot/],
 excessive_thirst: [/thirst/],
 tremors: [/tremor|shaking|shaky/],
 muscle_rigidity: [/stiff|rigid/],
 slow_movement: [/slow movement|moving slow|slowness/],
 swollen_ankles: [/swollen (ankle|feet|foot|leg)|ankle swelling|swelling in (my )?(ankle|feet|leg)/],
 jaundice_yellowing: [/jaundice|yellow (eyes|skin)|eyes (are |look )?yellow|skin (is |looks )?yellow/],
 abdominal_pain: [/abdominal pain|stomach (pain|ache)|belly pain|tummy (pain|ache)/],
 high_bp: [/high (bp|blood pressure)|hypertension/],
 blurred_vision: [/blur/],
 weight_loss: [/weight loss|losing weight|lost weight/],
 joint_pain: [/joint/],
 persistent_cough: [/cough/],
 nausea_vomiting: [/nause|vomit|throwing up/],
};
const findSymptoms = (text) =>
 Object.entries(SYMPTOM_WORDS).filter(([, rs]) => rs.some((r) => r.test(text))).map(([id]) => id);

async function symptomReply(ids) {
 try {
 const r = await callAiService('/symptom-check', { method: 'POST', body: { symptoms: ids } });
 const top = (r.predictions || []).slice(0, 3);
 const chestWarning = ids.includes('chest_pain')
 ? '\n Chest pain that is sudden, severe, or spreads to the arm, jaw or back is an emergency - call **112 / 911** now.'
 : '';
 if (!top.length || top[0].probability < 40) {
 // Only weak matches: usually common, non-specific symptoms (cold, flu, a stomach bug...)
 return say(
 `I noted: ${ids.join(', ').replace(/_/g, ' ')}.\n` +
 'These are common symptoms that many everyday illnesses cause (for example a cold, flu or a stomach bug). ' +
 'They do **not** clearly point to any of the 5 long-term conditions MediTrack checks.\n' +
 'See a doctor if they last more than 3 days, get worse, or you have a high fever (above 39 °C / 102 °F) or trouble breathing.' +
 chestWarning,
 { actions: [{ label: ' Book a doctor', tab: 'appointments' }, { label: ' Full symptom checker', tab: 'symptoms' }], kind: 'ai' }
 );
 }
 const lines = top.map((p) => `• **${p.diseaseName}** - ${p.probability}% match (${p.riskLevel.toLowerCase()})`);
 return say(
 `Symptom match for: ${ids.join(', ').replace(/_/g, ' ')}\n${lines.join('\n')}\n` +
 `Next step: ${top[0].recommendedNextSteps?.[0] || 'see a doctor'}.\n` +
 '_This is a symptom match score, not a diagnosis._' +
 chestWarning,
 {
 actions: [
 { label: ' Open Symptom Checker', tab: 'symptoms' },
 { label: ' Check risk with lab values', tab: 'dnn' },
 { label: ' Book a doctor', tab: 'appointments' },
 ],
 kind: 'ai',
 }
 );
 } catch (e) {
 return say(
 `I noted: ${ids.join(', ').replace(/_/g, ' ')}. The AI service is offline right now, so I can't score them. ` +
 'You can still book a doctor.',
 { actions: [{ label: ' Book a doctor', tab: 'appointments' }] }
 );
 }
}

// ---------------------------------------------------------------- 3. shared helpers
async function medicineLookup(text) {
 const meds = await Medicine.find().sort({ name: 1 });
 const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
 const hits = meds.filter((m) => [...words(m.name), ...words(m.genericName)].some((w) => text.includes(w)));
 if (!hits.length) return null;
 const lines = hits.slice(0, 5).map((m) => {
 const state = m.isExpired() ? ' expired' : m.quantity <= 0 ? ' out of stock' : m.isLowStock() ? ` low (${m.quantity} left)` : ` ${m.quantity} in stock`;
 return `• **${m.name}** (${m.dosageForm || 'unit'}) - ${money(m.price)} - ${state}`;
 });
 return lines.join('\n');
}

const nextAppointments = (filter) =>
 Appointment.find({ ...filter, appointmentDate: { $gte: todayStr() }, status: { $in: ['PENDING', 'ACCEPTED'] } })
 .sort({ appointmentDate: 1, appointmentTime: 1 })
 .limit(5);

function describeForPatient(a) {
 let where;
 if (a.mode === 'ONLINE') {
 where = a.status === 'ACCEPTED' && isLink(a.meetingLink) ? 'video call (link below)' : 'video call - link is shared when the doctor confirms';
 } else {
 where = placeText(a) || 'clinic address not available';
 }
 return `**${a.appointmentDate} ${a.appointmentTime || ''}** with ${a.doctorName} - ${modeText(a.mode)} - ${a.status.toLowerCase()}\n ${where}`;
}

// ---------------------------------------------------------------- 4. role rules
const COMMON_HELP = {
 patient:
 'I can help you with:\n• your next appointment, its place or video link\n• booking online or in-person visits\n' +
 '• prescriptions\n• medicine price and stock\n• your bills\n' +
 '• quick symptom check - just type e.g. "I have fever and cough"',
 doctor:
 'I can help you with:\n• pending appointment requests\n• today’s schedule\n• patient health logs waiting for feedback\n' +
 '• your clinic location / video link settings\n• medicine stock before prescribing',
 pharmacist:
 'I can help you with:\n• low-stock and expired medicines\n• today’s sales and revenue\n• stock and price of any medicine\n' +
 '• how to add or remove stock',
};
const CHIPS = {
 patient: ['My next appointment', 'How do I book online?', 'My prescriptions', 'I have fever and cough'],
 doctor: ['Pending requests', 'Today’s schedule', 'Logs to review', 'My clinic location'],
 pharmacist: ['Low stock', 'Expired medicines', 'Today’s sales', 'Stock of paracetamol'],
};

const PATIENT_RULES = [
 {
 match: (t) => has(t, 'how', 'book', 'online or', 'offline', 'in person', 'in-person') && has(t, 'book', 'online', 'offline', 'in person', 'in-person', 'video'),
 answer: async () =>
 say(
 'To book: open **Appointments** → choose a doctor → pick **Online** (video call) or **In-person** (clinic) → choose date & time → **Book**.\n' +
 '• **In-person**: the clinic address the doctor entered is shown with a Google Maps link.\n' +
 '• **Online**: the doctor shares a video-call link when accepting - it appears in your appointments table.\n' +
 'Some doctors offer only one type; the other option is greyed out.',
 { actions: [{ label: ' Book now', tab: 'appointments' }], chips: ['Which doctors are available?', 'My next appointment'] }
 ),
 },
 {
 match: (t) => has(t, 'doctor') && has(t, 'which', 'list', 'available', 'all doctors', 'specialist'),
 answer: async () => {
 const docs = await User.find({ role: 'doctor' }).sort({ name: 1 }).limit(10);
 if (!docs.length) return say('No doctors are registered yet.');
 const label = { BOTH: 'online & in-person', OFFLINE: 'in-person only', ONLINE: 'online only' };
 return say(
 `Doctors on MediTrack:\n${docs
 .map((d) => `• **${d.name}** - ${d.specialization || 'General'} - ${label[d.consultationMode || 'BOTH']}${d.clinicCity ? ` - ${d.clinicCity}` : ''}`)
 .join('\n')}`,
 { actions: [{ label: ' Book an appointment', tab: 'appointments' }] }
 );
 },
 },
 {
 match: (t) => has(t, 'appointment', 'visit', 'consult', 'where', 'location', 'address', 'clinic', 'video', 'link', 'meet', 'when is'),
 answer: async (u) => {
 const list = await nextAppointments({ patientId: u._id });
 if (!list.length) {
 return say("You don't have any upcoming appointments.", {
 actions: [{ label: ' Book an appointment', tab: 'appointments' }],
 chips: ['How do I book online?'],
 });
 }
 const [first, ...rest] = list;
 const actions = [];
 if (first.mode === 'ONLINE' && first.status === 'ACCEPTED' && isLink(first.meetingLink)) actions.push({ label: ' Join video call', href: first.meetingLink });
 if (first.mode === 'OFFLINE' && placeText(first)) actions.push({ label: ' Open in Maps', href: mapHref(first) });
 actions.push({ label: ' All appointments', tab: 'appointments' });
 return say(
 `Your next appointment:\n${describeForPatient(first)}` + (rest.length ? `\n\nAlso coming up: ${rest.length} more.` : ''),
 { actions }
 );
 },
 },
 {
 match: (t) => has(t, 'prescription', 'prescribed', 'my medicine', 'my medication', 'what should i take'),
 answer: async (u) => {
 const list = await Prescription.find({ patientId: u._id, status: { $ne: 'DISPENSED' } }).sort({ createdAt: -1 }).limit(3);
 if (!list.length) return say('You have no active prescriptions.', { actions: [{ label: ' Pharmacy', tab: 'pharmacy' }] });
 const blocks = list.map(
 (p) =>
 `**${p.diagnosis || 'Prescription'}** - by ${p.doctorName}\n` +
 (p.items || []).map((i) => `• ${i.medicineName} ${i.dosage || ''} - ${i.frequency || ''}${i.durationDays ? `, ${i.durationDays} days` : ''}`).join('\n')
 );
 return say(blocks.join('\n\n') + '\n\nTake medicines exactly as your doctor wrote. Ask them before changing a dose.', {
 actions: [{ label: ' Order these medicines', tab: 'pharmacy' }],
 });
 },
 },
 {
 match: (t) => has(t, 'bill', 'invoice', 'order', 'paid', 'payment', 'spent'),
 answer: async (u) => {
 const list = await Order.find({ patientId: u._id }).sort({ orderDate: -1 }).limit(3);
 if (!list.length) return say('You have no medicine orders yet.', { actions: [{ label: ' Order medicines', tab: 'pharmacy' }] });
 const lines = list.map((o) => `• ${o.billNumber} - ${new Date(o.orderDate).toISOString().slice(0, 10)} - **${money(o.totalAmount)}** (${o.paymentStatus})`);
 return say(`Your recent bills:\n${lines.join('\n')}`, { actions: [{ label: ' View invoices', tab: 'pharmacy' }] });
 },
 },
 {
 match: (t) => has(t, 'risk', 'predict', 'diabetes', 'kidney', 'heart', 'liver', 'parkinson', 'model', 'machine learning'),
 answer: async () =>
 say(
 'The **Disease Risk Models** tab estimates risk for diabetes, kidney, heart, liver and Parkinson’s from your test values ' +
 '(e.g. glucose, HbA1c, creatinine). It shows the risk %, what pushed it up or down, and the model’s tested accuracy.\n' +
 'It is a screening aid for learning - not a diagnosis.',
 { actions: [{ label: ' Open risk models', tab: 'dnn' }] }
 ),
 },
 {
 match: (t) => has(t, 'health log', 'daily update', 'log my', 'bp reading', 'blood sugar', 'my vitals'),
 answer: async (u) => {
 const last = await HealthLog.findOne({ patientId: u._id }).sort({ logDate: -1, createdAt: -1 });
 const intro = last
 ? `Your last update (${last.logDate}): BP ${last.systolicBp ?? '-'}/${last.diastolicBp ?? '-'}, glucose ${last.bloodGlucose ?? '-'} mg/dL, heart rate ${last.heartRate ?? '-'}.` +
 (last.doctorFeedback ? `\nDoctor's feedback: "${last.doctorFeedback}"` : '\nYour doctor has not replied yet.')
 : "You haven't sent a daily update yet.";
 return say(intro, { actions: [{ label: ' Add today’s update', tab: 'healthlogs' }] });
 },
 },
];

const DOCTOR_RULES = [
 {
 match: (t) => has(t, 'today', 'schedule'),
 answer: async (u) => {
 const list = await Appointment.find({ doctorId: u._id, appointmentDate: todayStr(), status: 'ACCEPTED' }).sort({ appointmentTime: 1 });
 if (!list.length) return say('No confirmed appointments today.', { chips: ['Pending requests'] });
 return say(
 `Today's confirmed appointments:\n${list.map((a) => `• **${a.appointmentTime}** - ${a.patientName} - ${modeText(a.mode)}${a.reason ? ` - ${a.reason}` : ''}`).join('\n')}`,
 { actions: [{ label: ' Open appointments', tab: 'appointments' }] }
 );
 },
 },
 {
 match: (t) => has(t, 'pending', 'request', 'appointment', 'booking', 'new patient'),
 answer: async (u) => {
 const list = await Appointment.find({ doctorId: u._id, status: 'PENDING' }).sort({ appointmentDate: 1 }).limit(6);
 if (!list.length) return say('No pending requests. You are all caught up ', { chips: ['Today’s schedule'] });
 const online = list.filter((a) => a.mode === 'ONLINE').length;
 return say(
 `${list.length} pending request(s):\n${list.map((a) => `• **${a.patientName}** - ${a.appointmentDate} ${a.appointmentTime || ''} - ${modeText(a.mode)}`).join('\n')}` +
 (online ? `\n\n${online} online - you'll be asked for a video-call link when you accept.` : ''),
 { actions: [{ label: ' Review requests', tab: 'appointments' }] }
 );
 },
 },
 {
 match: (t) => has(t, 'log', 'feedback', 'review', 'vitals', 'performance'),
 answer: async (u) => {
 const list = await HealthLog.find({ doctorId: u._id, reviewedByDoctor: { $ne: true } }).sort({ logDate: -1 }).limit(6);
 if (!list.length) return say('No health logs waiting for your feedback ');
 return say(
 `${list.length} log(s) waiting for feedback:\n${list.map((l) => `• **${l.patientName}** - ${l.logDate} - BP ${l.systolicBp ?? '-'}/${l.diastolicBp ?? '-'}, glucose ${l.bloodGlucose ?? '-'}`).join('\n')}`,
 { actions: [{ label: ' Open patient logs', tab: 'performance' }] }
 );
 },
 },
 {
 match: (t) => has(t, 'clinic', 'location', 'address', 'video link', 'meeting link', 'online', 'offline', 'in person', 'in-person'),
 answer: async (u) => {
 const mode = { BOTH: 'online and in-person', OFFLINE: 'in-person only', ONLINE: 'online only' }[u.consultationMode || 'BOTH'];
 const lines = [`You consult **${mode}**.`];
 if (u.consultationMode !== 'ONLINE') {
 lines.push(u.clinicAddress ? ` Patients see: ${placeText(u)}` : ' No clinic address yet - patients cannot book in-person visits.');
 }
 if (u.consultationMode !== 'OFFLINE') {
 lines.push(isLink(u.meetingLink) ? ` Default video link: ${u.meetingLink}` : ' No default video link - you will type one when accepting online visits.');
 }
 return say(lines.join('\n') + '\nChange these under **Doctor Profile → Edit Profile**.', { actions: [{ label: ' Edit profile', tab: 'profile' }] });
 },
 },
 {
 match: (t) => has(t, 'prescri'),
 answer: async (u) => {
 const n = await Prescription.countDocuments({ doctorId: u._id });
 return say(
 `You have issued ${n} prescription(s).\nTo write one: **Prescribe Medication** → pick the patient → add medicines from live stock → dosage & days → **Issue**.`,
 { actions: [{ label: ' Prescribe', tab: 'prescribe' }] }
 );
 },
 },
 {
 match: (t) => has(t, 'how many patients', 'my patients', 'patient count'),
 answer: async (u) => {
 const ids = await Appointment.distinct('patientId', { doctorId: u._id });
 return say(`You have seen or been booked by **${ids.length}** patient(s).`);
 },
 },
];

const PHARMACIST_RULES = [
 {
 match: (t) => has(t, 'expired', 'expiry', 'expire'),
 answer: async () => {
 const meds = (await Medicine.find().sort({ expiryDate: 1 })).filter((m) => m.isExpired());
 if (!meds.length) return say('No expired medicines in stock ');
 return say(
 `${meds.length} expired medicine(s):\n${meds.map((m) => `• **${m.name}** - batch ${m.batchNumber || '-'} - expired ${m.expiryDate} - ${m.quantity} units`).join('\n')}\n\nUse **Remove Expired** in Stock Management to clear them.`,
 { actions: [{ label: ' Open stock', tab: 'stock' }] }
 );
 },
 },
 {
 match: (t) => has(t, 'low', 'reorder', 'running out', 'shortage', 'out of stock'),
 answer: async () => {
 const meds = (await Medicine.find().sort({ quantity: 1 })).filter((m) => !m.isExpired() && m.isLowStock());
 if (!meds.length) return say('Nothing is low on stock ');
 return say(
 `${meds.length} medicine(s) to reorder:\n${meds.map((m) => `• **${m.name}** - ${m.quantity} left (minimum ${m.minStockThreshold ?? 15})`).join('\n')}`,
 { actions: [{ label: ' Restock', tab: 'stock' }] }
 );
 },
 },
 {
 match: (t) => has(t, 'sale', 'revenue', 'income', 'earn', 'sold', 'invoice', 'bill'),
 answer: async () => {
 const orders = await Order.find().sort({ orderDate: -1 });
 const today = todayStr();
 const todays = orders.filter((o) => new Date(o.orderDate).toISOString().slice(0, 10) === today);
 const sum = (l) => l.reduce((s, o) => s + (o.totalAmount || 0), 0);
 return say(
 `Today: **${todays.length}** bill(s), **${money(sum(todays))}**\nAll time: ${orders.length} bill(s), ${money(sum(orders))}` +
 (orders[0] ? `\nLatest: ${orders[0].billNumber} - ${orders[0].patientName} - ${money(orders[0].totalAmount)}` : ''),
 { actions: [{ label: ' Sales history', tab: 'sales' }] }
 );
 },
 },
 {
 match: (t) => has(t, 'add medicine', 'new medicine', 'add stock', 'how to add', 'restock'),
 answer: async () =>
 say('Open **Stock Management** → **+ Add Medicine**, fill name, batch, price, quantity, expiry date and minimum stock → Save. Edit a row to restock.', {
 actions: [{ label: ' Open stock', tab: 'stock' }],
 }),
 },
];

const RULES = { patient: PATIENT_RULES, doctor: DOCTOR_RULES, pharmacist: PHARMACIST_RULES };

// ---------------------------------------------------------------- 5. main handler
async function answer(user, raw) {
 const text = raw.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
 const role = user.role;

 const safety = safetyReply(text);
 if (safety) return safety;

 if (/^(hi|hii+|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(text) || has(text, 'help', 'what can you do')) {
 return say(`Hi ${user.name}! ${COMMON_HELP[role]}`, { chips: CHIPS[role], kind: 'help' });
 }
 if (/^(thanks|thank you|thx|ok|okay|great|cool)\b/.test(text)) return say("You're welcome! Anything else?", { chips: CHIPS[role] });
 if (has(text, 'profile', 'change my', 'update my', 'edit my')) {
 return say('Open the **Profile** tab (top right) → **Edit Profile** to change your details.', { actions: [{ label: ' Open profile', tab: 'profile' }] });
 }
 if (has(text, 'log out', 'logout', 'sign out')) return say('Use the red **Logout** button at the top right.');

 // Patients describing how they feel -> symptom checker (before keyword rules, so "chest pain" isn't read as "heart")
 if (role === 'patient') {
 const ids = findSymptoms(text);
 const short = text.split(' ').length <= 4; // e.g. just "chest pain" or "cough?"
 const shopping = has(text, 'price', 'cost', 'stock', 'available', 'do you have', 'how much', 'buy', 'order');
 if (ids.length && !shopping && (ids.length >= 2 || short || has(text, 'i have', 'i feel', 'i am', "i'm", 'suffering', 'having', 'symptom', 'my '))) {
 return symptomReply(ids);
 }
 }

 // Medicine price / stock questions (all roles)
 if (has(text, 'price', 'cost', 'stock', 'available', 'do you have', 'in stock', 'how much')) {
 const found = await medicineLookup(text);
 if (found) {
 return say(found, {
 actions: role === 'patient' ? [{ label: ' Order', tab: 'pharmacy' }] : role === 'pharmacist' ? [{ label: ' Stock', tab: 'stock' }] : [{ label: ' Prescribe', tab: 'prescribe' }],
 });
 }
 }

 if (has(text, 'price', 'cost', 'do you have', 'how much') && !has(text, 'bill', 'order', 'spent', 'sale', 'revenue')) {
 return say("I couldn't find that medicine in the pharmacy stock. Try its brand or generic name (e.g. \"paracetamol\").", {
 actions: role === 'patient' ? [{ label: ' Browse all medicines', tab: 'pharmacy' }] : role === 'pharmacist' ? [{ label: ' Stock list', tab: 'stock' }] : [],
 });
 }

 for (const rule of RULES[role] || []) {
 if (rule.match(text)) return rule.answer(user, text);
 }

 // Last try: a medicine name on its own ("paracetamol?")
 const found = await medicineLookup(text);
 if (found) return say(found);

 return say(`Sorry, I didn't understand that. ${COMMON_HELP[role]}`, { chips: CHIPS[role], kind: 'fallback' });
}

router.post(
 '/',
 asyncHandler(async (req, res) => {
 const message = String(req.body?.message ?? '').trim();
 if (!message) throw new HttpError(400, 'Please type a message.');
 if (message.length > MAX_LEN) throw new HttpError(400, `Please keep messages under ${MAX_LEN} characters.`);
 const out = await answer(req.user, message);
 res.json(out);
 })
);

module.exports = router;
module.exports.answer = answer; // exported for tests
