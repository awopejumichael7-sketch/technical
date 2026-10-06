/* Freely Given Media Team – application logic */
'use strict';

// ==================== CONSTANTS & STATE ====================
const CFG = window.APP_CONFIG;
const CONFERENCE_DAYS = ['Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MEETINGS = ['Thursday', 'Friday', 'Saturday', 'Sunday', 'Wednesday'];
const DEPARTMENTS = ['Videography', 'Photography', 'SRT', 'Equipment', 'Live Stream & Projection'];
const LEGACY_ROLES = ['Camera', 'Sound', 'Projection', 'Streaming', 'Media', 'Technical'];
const ALBUMS = [
    { folder: 'ALL', label: 'All' },
    { folder: 'Gallery-Videography', label: 'Videography' },
    { folder: 'Gallery-Photography', label: 'Photography' },
    { folder: 'Gallery-SRT', label: 'SRT' },
    { folder: 'Gallery-General', label: 'General' }
];
const DEPT_ICONS = {
    'Videography': 'fa-video', 'Photography': 'fa-camera', 'SRT': 'fa-people-group',
    'Equipment': 'fa-toolbox', 'Live Stream & Projection': 'fa-tower-broadcast'
};

let members = [], attendance = [], requests = [], complaints = [], roster = [], evaluations = [];
let contacts = {};                // memberId -> phone (admin only)
let galleryItems = [], galleryLoaded = false, galleryLoading = false;
let isAdminLoggedIn = false;
let currentSection = 'dashboard';
let rosterDay = defaultRosterDay();
let currentAlbum = 'ALL';
let lightboxList = [], lightboxIndex = 0;
const unsubscribers = [];         // admin-only listeners

// ==================== HELPERS ====================
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cls = (s) => slug(s) || 'unknown';         // safe CSS class fragment from data
const pad = (n) => String(n).padStart(2, '0');
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayName() { return WEEKDAYS[new Date().getDay()]; }
function defaultRosterDay() { const t = WEEKDAYS[new Date().getDay()]; return CONFERENCE_DAYS.includes(t) ? t : 'Thursday'; }
function showNotification(message, type = 'success') { window.showAlert ? window.showAlert(message, type) : alert(message); }
const memberById = (id) => members.find((m) => m.id === id);
const phoneOf = (m) => (isAdminLoggedIn ? (contacts[m.id] ?? m.phone ?? '') : '');
function tsToDate(t) { return t && t.toDate ? t.toDate().toISOString().split('T')[0] : ''; }
function fillSelect(el, values, selected) {
    el.innerHTML = values.map((v) => `<option value="${esc(v.value ?? v)}" ${(v.value ?? v) === selected ? 'selected' : ''}>${esc(v.label ?? v)}</option>`).join('');
}

// ==================== WHATSAPP ====================
function waNumber(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('0')) d = CFG.DEFAULT_COUNTRY_CODE + d.slice(1);
    else if (d.length === 10 && /^[789]/.test(d)) d = CFG.DEFAULT_COUNTRY_CODE + d;
    return d.length >= 11 ? d : '';
}
function slotLabel(s) { return `${s.day === 'ALL' ? 'All Days' : s.day} – ${s.department}${s.shift && s.shift !== 'All Days' ? ` (${s.shift})` : ''}`; }
function buildMessage(m, slot) {
    const slots = slot ? [slot] : assignmentsFor(m.id);
    let msg = `Hello ${m.name}, this is the ${CFG.TEAM_NAME}.\n\n`;
    if (!slots.length) {
        msg += 'You have no assignment on the roster yet. We will update you shortly.';
    } else {
        msg += slots.length > 1 ? '*Your assignments:*\n' : '*Your assignment:*\n';
        slots.forEach((s) => {
            msg += `\n📌 *${slotLabel(s)}*\n` + (s.duties || []).map((d) => `• ${d}`).join('\n') + '\n';
        });
        const notes = (window.ROSTER_DATA && window.ROSTER_DATA.directives) || [];
        if (notes.length) msg += '\n*Please note:*\n' + notes.map((n) => `• ${n}`).join('\n') + '\n';
    }
    return msg + '\nKindly reply to confirm you have seen this. God bless you. 🙏';
}
function waLink(m, slot) {
    const n = waNumber(phoneOf(m));
    return n ? `https://wa.me/${n}?text=${encodeURIComponent(buildMessage(m, slot))}` : '';
}
function waButton(m, slot, label = 'WhatsApp') {
    const href = waLink(m, slot);
    return href
        ? `<a class="btn-wa" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="Message ${esc(m.name)} on WhatsApp"><i class="fab fa-whatsapp"></i> ${label}</a>`
        : `<span class="btn-wa disabled" title="No WhatsApp number saved – edit the member to add one"><i class="fab fa-whatsapp"></i> No number</span>`;
}

// ==================== ROSTER HELPERS ====================
const SHIFT_ORDER = (s) => s.order ?? 99;
function assignmentsFor(memberId) {
    const dayRank = (d) => (d === 'ALL' ? 99 : CONFERENCE_DAYS.indexOf(d));
    return roster.filter((s) => (s.memberIds || []).includes(memberId))
        .sort((a, b) => dayRank(a.day) - dayRank(b.day) || SHIFT_ORDER(a) - SHIFT_ORDER(b));
}
function avatarHTML(m, size = 200) {
    if (m.photoId) return `<img src="${esc(window.DriveService.thumb(m.photoId, size))}" alt="${esc(m.name)}" loading="lazy" referrerpolicy="no-referrer">`;
    if (m.picture) return `<img src="${esc(m.picture)}" alt="${esc(m.name)}" loading="lazy">`;   // legacy photos
    return '<i class="fas fa-user"></i>';
}

// ==================== REMOTE DATA ====================
function refreshActive() {
    const loaders = { dashboard: loadDashboard, roster: loadRoster, members: loadMembers, attendance: loadAttendance, gallery: renderGallery, requests: loadRequests, helpdesk: loadComplaints, performance: loadPerformance, reports: loadReport };
    if (loaders[currentSection]) loaders[currentSection]();
}

function subscribeToRemoteData() {
    const s = window.svc;
    s.members.listen((d) => { members = d.map((m) => ({ attendance: 0, ...m })); refreshActive(); });
    s.attendance.listen((d) => { attendance = d; refreshActive(); });
    s.requests.listen((d) => { requests = d.sort(byNewest); refreshActive(); });
    s.helpdesk.listen((d) => { complaints = d.map((c) => ({ response: c.resolution || c.response || '', ...c })).sort(byNewest); refreshActive(); });
    s.roster.listen((d) => { roster = d; refreshActive(); });
}
const byNewest = (a, b) => ((b.createdAt && b.createdAt.seconds) || 9e12) - ((a.createdAt && a.createdAt.seconds) || 9e12);

function subscribeAdminData() {
    unsubscribeAdminData();
    const s = window.svc;
    unsubscribers.push(
        s.contacts.listen((d) => { contacts = Object.fromEntries(d.map((c) => [c.id, c.phone || ''])); refreshActive(); }),
        s.evaluations.listen((d) => { evaluations = d.sort(byNewest); refreshActive(); })
    );
}
function unsubscribeAdminData() {
    while (unsubscribers.length) { try { unsubscribers.pop()(); } catch (_) { /* ignore */ } }
    contacts = {}; evaluations = [];
}

// ==================== THEME & NAV ====================
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (_) { /* private mode */ }
}
try { document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light'); } catch (_) { /* ignore */ }

function showSection(section) {
    if (section === 'performance' && !isAdminLoggedIn) section = 'dashboard';
    currentSection = section;
    document.querySelectorAll('.section').forEach((s) => (s.style.display = 'none'));
    $(section + 'Section').style.display = 'block';
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.toggle('active', l.dataset.section === section));
    if (section === 'gallery') loadGallery(false);
    else refreshActive();
}

// ==================== ADMIN AUTH (Firebase Authentication) ====================
function toggleAdminModal() {
    if (isAdminLoggedIn) {
        if (confirm('Are you sure you want to logout?')) window.authService.logout();
    } else {
        $('adminLoginModal').style.display = 'flex';
    }
}
function closeAdminModal() { $('adminLoginModal').style.display = 'none'; }

$('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('adminLoginBtn'); btn.disabled = true;
    try {
        await window.authService.login($('adminEmail').value.trim(), $('adminPassword').value);
        $('adminPassword').value = '';
        closeAdminModal();
    } catch (err) {
        const bad = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'];
        showNotification(bad.includes(err.code) ? 'Invalid email or password.' : `Login failed: ${err.message}`, 'error');
    } finally { btn.disabled = false; }
});

function onAuthChanged(user) {
    isAdminLoggedIn = !!user;
    if (isAdminLoggedIn) subscribeAdminData(); else unsubscribeAdminData();
    $('adminBadge').classList.toggle('logged-in', isAdminLoggedIn);
    $('adminIcon').className = isAdminLoggedIn ? 'fas fa-lock-open' : 'fas fa-lock';
    $('adminText').textContent = isAdminLoggedIn ? 'Admin Logout' : 'Admin Login';
    document.querySelectorAll('.admin-only').forEach((el) => (el.hidden = !isAdminLoggedIn));
    if (!isAdminLoggedIn && currentSection === 'performance') showSection('dashboard'); else refreshActive();
}

// ==================== DASHBOARD ====================
function loadDashboard() {
    $('totalMembers').textContent = members.length;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = `${weekAgo.getFullYear()}-${pad(weekAgo.getMonth() + 1)}-${pad(weekAgo.getDate())}`;
    const week = attendance.filter((a) => a.date >= weekAgoISO);
    const present = week.filter((a) => a.status === 'present').length;
    const absent = week.filter((a) => a.status === 'absent').length;
    $('presentThisWeek').textContent = present;
    $('absentThisWeek').textContent = absent;
    $('attendancePercentage').textContent = week.length ? Math.round((present / week.length) * 100) + '%' : '0%';

    const today = new Date().getDay();
    const dayIdx = CONFERENCE_DAYS.map((d) => WEEKDAYS.indexOf(d));
    let text, progress;
    if (dayIdx.includes(today)) { text = `${WEEKDAYS[today]} (Today)`; progress = 100; $('nextMeetingCard').classList.add('meeting-day'); }
    else {
        $('nextMeetingCard').classList.remove('meeting-day');
        let offset = 1;
        while (!dayIdx.includes((today + offset) % 7)) offset++;
        text = `${WEEKDAYS[(today + offset) % 7]} (in ${offset} day${offset > 1 ? 's' : ''})`;
        progress = ((7 - offset) / 7) * 100;
    }
    $('nextMeeting').textContent = text;
    $('meetingProgress').style.width = progress + '%';

    // Today's assignments
    const t = todayName();
    const slots = roster.filter((s) => s.day === t).sort((a, b) => a.department.localeCompare(b.department) || SHIFT_ORDER(a) - SHIFT_ORDER(b));
    $('todayAssignments').innerHTML = !slots.length
        ? `<div class="empty-state">No duty roster for ${esc(t)}.</div>`
        : `<div class="table-container"><table><thead><tr><th>Department</th><th>Post</th><th>Team</th></tr></thead><tbody>${slots.map((s) =>
            `<tr><td>${esc(s.department)}</td><td>${esc(s.shift)}</td><td>${(s.memberIds || []).map((id) => esc(memberById(id)?.name || '?')).join(', ') || '-'}</td></tr>`).join('')}</tbody></table></div>`;

    const todayRecords = attendance.filter((a) => a.date === todayISO());
    $('todayAttendanceTable').innerHTML = members.map((m) => {
        const r = todayRecords.find((a) => a.memberId === m.id);
        return `<tr><td>${esc(m.name)}</td><td>${esc(m.role)}</td><td><span class="status-badge status-${r ? cls(r.status) : 'pending'}">${r ? esc(r.status) : 'Not marked'}</span></td><td>${esc(r?.reason || '-')}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="empty-state">No team members yet.</td></tr>';
}

// ==================== DUTY ROSTER ====================
function setRosterDay(d) { rosterDay = d; loadRoster(); }

function loadRoster() {
    $('rosterTabs').innerHTML = CONFERENCE_DAYS.map((d) =>
        `<button class="day-tab ${d === rosterDay ? 'active' : ''}" onclick="setRosterDay('${d}')">${d}${d === todayName() ? ' <small>• today</small>' : ''}</button>`).join('');

    if (!roster.length) {
        $('rosterBody').innerHTML = `<div class="empty-state"><i class="fas fa-clipboard-list fa-2x"></i><p style="margin:1rem 0;">No roster has been set up yet.</p>
            ${isAdminLoggedIn ? '<button class="btn-primary" onclick="seedRoster()"><i class="fas fa-download"></i> Load Conference Roster (Thu–Sun)</button>' : '<p>Please check back soon.</p>'}</div>`;
        return;
    }
    const sorted = (arr) => arr.sort((a, b) => SHIFT_ORDER(a) - SHIFT_ORDER(b));
    let html = '';
    ['Videography', 'Photography'].forEach((dept) => {
        const slots = sorted(roster.filter((s) => s.day === rosterDay && s.department === dept));
        if (slots.length) html += `<div class="dept-block"><h2 class="dept-title"><i class="fas ${DEPT_ICONS[dept]}"></i> ${dept}</h2><div class="slot-grid">${slots.map(slotCard).join('')}</div></div>`;
    });
    const all = sorted(roster.filter((s) => s.day === 'ALL'));
    if (all.length) html += `<div class="dept-block"><h2 class="dept-title"><i class="fas fa-layer-group"></i> Support Teams <small style="font-weight:400;color:var(--text-secondary);">(on duty every day)</small></h2><div class="slot-grid">${all.map(slotCard).join('')}</div></div>`;
    const notes = (window.ROSTER_DATA && window.ROSTER_DATA.directives) || [];
    if (notes.length) html += `<div class="directives"><h3><i class="fas fa-bullhorn" style="color:var(--accent-gold);"></i> Team Directives</h3><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
    $('rosterBody').innerHTML = html;
}

function slotCard(slot) {
    const people = (slot.memberIds || []).map((id) => memberById(id)).filter(Boolean);
    const title = slot.day === 'ALL' ? slot.department : slot.shift;
    return `<div class="slot-card">
        <div class="slot-head"><span class="slot-shift">${esc(title)}</span>
            ${isAdminLoggedIn ? `<button class="btn-sm" onclick="openSlotModal('${slot.id}')"><i class="fas fa-pen"></i> Edit</button>` : ''}</div>
        <ul class="duty-list">${(slot.duties || []).map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
        ${people.map((m) => personRow(slot, m)).join('') || '<div class="empty-state" style="padding:1rem;">Nobody assigned yet.</div>'}
    </div>`;
}

function personRow(slot, m) {
    const evs = isAdminLoggedIn ? evaluations.filter((e) => e.memberId === m.id && e.slotId === slot.id && e.day === rosterDay) : [];
    const chips = evs.map((e) => e.type === 'appraisal'
        ? `<span class="chip good" title="${esc(e.comment)}">★ ${esc(e.rating)}</span>`
        : `<span class="chip bad" title="${esc(e.comment)}">⚠ ${esc(e.severity || '')}</span>`).join('');
    return `<div class="person-row">
        <div class="person-avatar">${avatarHTML(m, 120)}</div>
        <div class="person-main"><div class="person-name">${esc(m.name)}</div><div>${chips}</div></div>
        ${isAdminLoggedIn ? `<div class="person-actions">
            ${waButton(m, { ...slot, day: slot.day === 'ALL' ? rosterDay : slot.day }, 'Brief')}
            <button class="btn-sm good" onclick="openEvalModal('${m.id}','${slot.id}','appraisal')" title="Give appraisal"><i class="fas fa-thumbs-up"></i></button>
            <button class="btn-sm bad" onclick="openEvalModal('${m.id}','${slot.id}','complaint')" title="Log complaint"><i class="fas fa-flag"></i></button>
        </div>` : ''}
    </div>`;
}

async function seedRoster() {
    if (!isAdminLoggedIn) return showNotification('Please login as admin first', 'error');
    const data = window.ROSTER_DATA;
    if (!data) return showNotification('Roster data file is missing', 'error');
    if (roster.length && !confirm('A roster already exists. Reloading will overwrite the assignments and duties with the defaults. Continue?')) return;

    const idByName = {};
    members.forEach((m) => (idByName[m.name.toLowerCase()] = m.id));
    for (const p of data.team) {
        if (idByName[p.name.toLowerCase()]) continue;
        const id = await window.svc.members.add({ name: p.name, role: p.department, joinDate: '', attendance: 0, photoId: '' });
        if (!id) return;
        idByName[p.name.toLowerCase()] = id;
    }
    for (const s of data.slots) {
        const id = `${slug(s.day)}_${slug(s.department)}_${slug(s.shift)}`;
        const ok = await window.svc.roster.set(id, { day: s.day, department: s.department, shift: s.shift, order: s.order, duties: s.duties, memberIds: s.people.map((n) => idByName[n.toLowerCase()]) });
        if (!ok) return;
    }
    showNotification('Conference roster loaded');
}

// ---- slot editor ----
function openSlotModal(id) {
    const slot = roster.find((s) => s.id === id);
    if (!slot) return;
    $('slotId').value = id;
    $('slotModalTitle').textContent = `Edit – ${slotLabel(slot)}`;
    const chosen = new Set(slot.memberIds || []);
    $('slotMembers').innerHTML = [...members].sort((a, b) => a.name.localeCompare(b.name)).map((m) =>
        `<label><input type="checkbox" value="${m.id}" ${chosen.has(m.id) ? 'checked' : ''}> ${esc(m.name)}</label>`).join('');
    $('slotDuties').value = (slot.duties || []).join('\n');
    $('slotModal').style.display = 'flex';
}
function closeSlotModal() { $('slotModal').style.display = 'none'; }
$('slotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const memberIds = [...document.querySelectorAll('#slotMembers input:checked')].map((i) => i.value);
    const duties = $('slotDuties').value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (await window.svc.roster.update($('slotId').value, { memberIds, duties })) closeSlotModal();
});

// ---- appraisals / complaints ----
function openEvalModal(memberId, slotId, type) {
    const m = memberById(memberId), slot = roster.find((s) => s.id === slotId);
    if (!m || !slot) return;
    $('evalMemberId').value = memberId;
    $('evalSlotId').value = slotId;
    fillSelect($('evalDay'), CONFERENCE_DAYS, rosterDay);
    $('evalType').value = type;
    $('evalComment').value = '';
    $('evalModalTitle').textContent = `${m.name} – ${slot.department}${slot.shift !== 'All Days' ? ` (${slot.shift})` : ''}`;
    toggleEvalFields();
    $('evalModal').style.display = 'flex';
}
function closeEvalModal() { $('evalModal').style.display = 'none'; }
function toggleEvalFields() {
    const appraisal = $('evalType').value === 'appraisal';
    $('evalRatingGroup').hidden = !appraisal;
    $('evalSeverityGroup').hidden = appraisal;
}
$('evalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) return showNotification('Please login as admin', 'error');
    const m = memberById($('evalMemberId').value), slot = roster.find((s) => s.id === $('evalSlotId').value);
    if (!m || !slot) return;
    const type = $('evalType').value;
    const data = {
        memberId: m.id, memberName: m.name, slotId: slot.id, department: slot.department, shift: slot.shift,
        day: $('evalDay').value, type, comment: $('evalComment').value.trim(),
        createdBy: window.authService.currentUser()?.email || '', date: todayISO()
    };
    if (type === 'appraisal') data.rating = Number($('evalRating').value); else data.severity = $('evalSeverity').value;
    if (await window.svc.evaluations.add(data)) {
        showNotification(type === 'appraisal' ? 'Appraisal saved' : 'Complaint logged');
        closeEvalModal();
    }
});

// ==================== PERFORMANCE (admin) ====================
function loadPerformance() {
    if (!isAdminLoggedIn) { $('performanceBody').innerHTML = '<div class="empty-state">Admin login required.</div>'; return; }
    const rows = members.map((m) => {
        const mine = evaluations.filter((e) => e.memberId === m.id);
        const ap = mine.filter((e) => e.type === 'appraisal'), cp = mine.filter((e) => e.type === 'complaint');
        const avg = ap.length ? (ap.reduce((n, e) => n + (Number(e.rating) || 0), 0) / ap.length) : 0;
        return { m, ap: ap.length, cp: cp.length, avg };
    }).sort((a, b) => b.avg - a.avg || a.m.name.localeCompare(b.m.name));

    const summary = `<div class="table-container"><table><thead><tr><th>Member</th><th>Department</th><th>Appraisals</th><th>Average</th><th>Complaints</th></tr></thead><tbody>${rows.map((r) =>
        `<tr><td>${esc(r.m.name)}</td><td>${esc(r.m.role)}</td><td>${r.ap}</td><td>${r.ap ? `<span class="stars">${'★'.repeat(Math.round(r.avg))}</span> ${r.avg.toFixed(1)}` : '-'}</td><td>${r.cp ? `<span class="chip bad">${r.cp}</span>` : '0'}</td></tr>`).join('')}</tbody></table></div>`;

    const log = evaluations.length ? evaluations.map((e) => `<div class="request-card ${e.type === 'complaint' ? 'priority-' + cls(e.severity || 'low') : 'priority-low'}">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div><strong>${esc(e.memberName)}</strong> <span class="chip dept">${esc(e.day)} · ${esc(e.department)}${e.shift && e.shift !== 'All Days' ? ' (' + esc(e.shift) + ')' : ''}</span>
                ${e.type === 'appraisal' ? `<span class="chip good">★ ${esc(e.rating)}/5</span>` : `<span class="chip bad">Complaint · ${esc(e.severity)}</span>`}
                <p style="margin-top:.5rem;">${esc(e.comment)}</p>
                <small style="color:var(--text-secondary);">${esc(e.date || tsToDate(e.createdAt))} · by ${esc(e.createdBy || 'admin')}</small></div>
            <div><button class="btn-icon" onclick="deleteEvaluation('${e.id}')" title="Delete"><i class="fas fa-trash"></i></button></div>
        </div></div>`).join('') : '<div class="empty-state">No appraisals or complaints recorded yet. Use the 👍 / 🚩 buttons on the Duty Roster after each day.</div>';

    $('performanceBody').innerHTML = `<h2 style="margin-bottom:1rem;">Summary</h2>${summary}<h2 style="margin:2rem 0 1rem;">History</h2>${log}`;
}
async function deleteEvaluation(id) {
    if (confirm('Delete this entry?')) await window.svc.evaluations.remove(id);
}

// ==================== TEAM ====================
function roleOptions(selected) {
    const extra = selected && ![...DEPARTMENTS, ...LEGACY_ROLES].includes(selected) ? [selected] : [];
    return [...DEPARTMENTS, ...LEGACY_ROLES, ...extra];
}

function loadMembers() {
    const roleSel = $('roleFilter'), keep = roleSel.value;
    fillSelect(roleSel, [{ value: '', label: 'All Departments' }, ...DEPARTMENTS, ...LEGACY_ROLES], keep);

    const term = $('memberSearch').value.toLowerCase(), role = roleSel.value;
    const list = members.filter((m) => (m.name || '').toLowerCase().includes(term) && (!role || m.role === role))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const missing = isAdminLoggedIn ? members.filter((m) => !waNumber(phoneOf(m))).length : 0;
    $('phoneNotice').innerHTML = missing ? `<div class="banner info"><i class="fab fa-whatsapp"></i> ${missing} team member${missing > 1 ? 's have' : ' has'} no WhatsApp number yet. Click <i class="fas fa-edit"></i> on a card to add it – numbers are stored privately and only admins can see them.</div>` : '';

    $('membersGrid').innerHTML = list.map((m) => {
        const cls2 = m.attendance >= 80 ? 'attendance-high' : (m.attendance >= 60 ? 'attendance-medium' : 'attendance-low');
        const chips = assignmentsFor(m.id).map((s) => `<span class="chip dept">${esc(s.day === 'ALL' ? 'Daily' : s.day.slice(0, 3))} · ${esc(s.department === 'Live Stream & Projection' ? 'Stream' : s.department)}${s.shift !== 'All Days' ? ' ' + esc(s.shift) : ''}</span>`).join('');
        return `<div class="member-card">
            <div class="member-avatar">${avatarHTML(m)}</div>
            <div class="member-info">
                <h3>${esc(m.name)}</h3>
                <div class="member-role">${esc(m.role)}</div>
                ${isAdminLoggedIn && phoneOf(m) ? `<div class="member-detail"><i class="fas fa-phone"></i> ${esc(phoneOf(m))}</div>` : ''}
                ${m.joinDate ? `<div class="member-detail"><i class="fas fa-calendar"></i> Joined: ${esc(m.joinDate)}</div>` : ''}
                <span class="attendance-badge ${cls2}"><i class="fas fa-chart-line"></i> ${esc(m.attendance)}% Attendance</span>
                <div class="assign-chips">${chips}</div>
            </div>
            ${isAdminLoggedIn ? `<div class="member-actions">
                ${waButton(m, null, 'Send my schedule')}
                <button class="btn-icon" onclick="openMemberModal('${m.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn-icon" onclick="openAttendanceModal('${m.id}')" title="Mark Attendance"><i class="fas fa-calendar-check"></i></button>
                <button class="btn-icon" onclick="deleteMember('${m.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>` : ''}
        </div>`;
    }).join('') || '<div class="empty-state" style="grid-column:1/-1;">No team members found.</div>';

    const header = document.querySelector('#membersSection .section-header');
    let btn = $('addMemberBtn');
    if (isAdminLoggedIn && !btn) {
        btn = document.createElement('button');
        btn.className = 'btn-primary'; btn.id = 'addMemberBtn';
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Add Member';
        btn.onclick = () => openMemberModal();
        header.appendChild(btn);
    } else if (!isAdminLoggedIn && btn) btn.remove();
}

function previewInto(input, targetId, round = false) {
    const target = $(targetId);
    if (!input.files || !input.files[0]) { target.innerHTML = ''; return; }
    const reader = new FileReader();
    reader.onload = (e) => { target.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:${round ? 100 : 200}px;max-height:${round ? 100 : 200}px;border-radius:${round ? '50%' : '12px'};">`; };
    reader.readAsDataURL(input.files[0]);
}

function openMemberModal(id = null) {
    if (!isAdminLoggedIn) return showNotification('Please login as admin first', 'error');
    $('memberForm').reset();
    $('imagePreview').innerHTML = '';
    const m = id ? memberById(id) : null;
    fillSelect($('memberRole'), roleOptions(m?.role), m?.role || 'Videography');
    $('memberId').value = m ? m.id : '';
    $('memberModalTitle').textContent = m ? 'Edit Team Member' : 'Add Team Member';
    if (m) {
        $('memberName').value = m.name || '';
        $('memberPhone').value = phoneOf(m);
        $('memberJoinDate').value = m.joinDate || '';
        if (m.photoId || m.picture) $('imagePreview').innerHTML = `<div class="person-avatar" style="width:90px;height:90px;margin:auto;">${avatarHTML(m, 200)}</div>`;
    }
    $('memberModal').style.display = 'flex';
}
function closeMemberModal() { $('memberModal').style.display = 'none'; }

$('memberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) { showNotification('Please login as admin', 'error'); return closeMemberModal(); }
    const btn = $('memberSaveBtn'); btn.disabled = true; btn.textContent = 'Saving...';
    try {
        const id = $('memberId').value;
        const existing = id ? memberById(id) : null;
        const data = {
            name: $('memberName').value.trim(),
            role: $('memberRole').value,
            joinDate: $('memberJoinDate').value,
            attendance: existing ? existing.attendance || 0 : 0,
            photoId: existing?.photoId || ''
        };
        const file = $('memberPicture').files[0];
        if (file) {
            data.photoId = (await window.DriveService.upload({
                file, folder: 'Members', maxPx: CFG.AVATAR_MAX_PX, meta: { title: data.name },
                idToken: await window.authService.getToken()
            })).id;
            if (existing?.photoId) window.DriveService.remove(existing.photoId, await window.authService.getToken()).catch(() => {});
        }
        if (existing && existing.phone !== undefined) data.phone = window.fieldDelete(); // migrate legacy public phone -> private contacts
        const memberId = existing ? (await window.svc.members.update(id, data) ? id : null) : await window.svc.members.add(data);
        if (!memberId) return;
        const phone = $('memberPhone').value.trim();
        if (phone) await window.svc.contacts.set(memberId, { phone });
        else if (contacts[memberId] !== undefined) await window.svc.contacts.remove(memberId);
        closeMemberModal();
    } catch (err) {
        showNotification(err.message, 'error');
    } finally { btn.disabled = false; btn.textContent = 'Save Member'; }
});

async function deleteMember(id) {
    if (!isAdminLoggedIn) return showNotification('Please login as admin', 'error');
    const m = memberById(id);
    if (!m || !confirm(`Delete ${m.name}? Their attendance records and roster assignments will also be removed.`)) return;
    if (!(await window.svc.members.remove(id))) return;
    await Promise.all([
        ...attendance.filter((a) => a.memberId === id).map((a) => window.svc.attendance.remove(a.id)),
        ...roster.filter((s) => (s.memberIds || []).includes(id)).map((s) => window.svc.roster.update(s.id, { memberIds: s.memberIds.filter((x) => x !== id) }, true)),
        window.svc.contacts.remove(id)
    ]);
    if (m.photoId) window.DriveService.remove(m.photoId, await window.authService.getToken()).catch(() => {});
}

// ==================== ATTENDANCE ====================
function loadAttendance() {
    const sel = $('attendanceMeetingFilter');
    if (!sel.options.length) fillSelect(sel, [{ value: 'all', label: 'All Days' }, ...MEETINGS]);
    const meeting = sel.value, date = $('attendanceDateFilter').value;
    const list = attendance.filter((a) => (meeting === 'all' || a.meeting === meeting) && (!date || a.date === date))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $('attendanceTable').innerHTML = list.map((r) => {
        const m = memberById(r.memberId);
        return `<tr><td>${esc(r.date)}</td><td>${esc(r.meeting)}</td><td>${esc(m ? m.name : 'Unknown')}</td><td><span class="status-badge status-${cls(r.status)}">${esc(r.status)}</span></td><td>${esc(r.reason || '-')}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="empty-state">No attendance records.</td></tr>';
}
function resetAttendanceFilter() { $('attendanceMeetingFilter').value = 'all'; $('attendanceDateFilter').value = ''; loadAttendance(); }

function openAttendanceModal(memberId = null) {
    if (!isAdminLoggedIn) return showNotification('Please login as admin first', 'error');
    $('attendanceForm').reset();
    fillSelect($('attendanceMember'), [...members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ value: m.id, label: m.name })), memberId);
    fillSelect($('attendanceMeeting'), MEETINGS, MEETINGS.includes(todayName()) ? todayName() : 'Thursday');
    $('attendanceDate').value = todayISO();
    $('reasonGroup').style.display = 'none';
    $('attendanceModal').style.display = 'flex';
}
function closeAttendanceModal() { $('attendanceModal').style.display = 'none'; }
function toggleReasonField() {
    const s = $('attendanceStatus').value;
    $('reasonGroup').style.display = (s === 'absent' || s === 'excused') ? 'block' : 'none';
}
$('attendanceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdminLoggedIn) { showNotification('Please login as admin', 'error'); return closeAttendanceModal(); }
    const status = $('attendanceStatus').value, reason = $('attendanceReason').value.trim();
    if ((status === 'absent' || status === 'excused') && !reason) return showNotification('Please provide a reason', 'error');
    const rec = { memberId: $('attendanceMember').value, date: $('attendanceDate').value, meeting: $('attendanceMeeting').value, status, reason };
    if (!(await window.svc.attendance.add(rec))) return;
    const mine = [...attendance.filter((a) => a.memberId === rec.memberId), rec];
    const pct = Math.round((mine.filter((a) => a.status === 'present').length / mine.length) * 100);
    await window.svc.members.update(rec.memberId, { attendance: pct }, true);
    closeAttendanceModal();
});

// ==================== GALLERY (Google Drive) ====================
function renderAlbumTabs() {
    $('albumTabs').innerHTML = ALBUMS.map((a) => `<button class="day-tab ${a.folder === currentAlbum ? 'active' : ''}" onclick="setAlbum('${a.folder}')">${a.label}</button>`).join('');
}
function setAlbum(f) { currentAlbum = f; renderGallery(); }

async function loadGallery(force = false) {
    $('driveBanner').hidden = window.DriveService.enabled;
    renderAlbumTabs();
    if (!window.DriveService.enabled) {
        $('galleryGrid').innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Google Drive is not connected yet. See SETUP.md.</div>';
        return;
    }
    if (galleryLoaded && !force) return renderGallery();
    if (galleryLoading) return;
    galleryLoading = true;
    $('galleryGrid').innerHTML = '<div class="spinner" style="grid-column:1/-1;"><i class="fas fa-circle-notch fa-spin"></i> Loading from Google Drive…</div>';
    try {
        galleryItems = await window.DriveService.list('GALLERY');
        galleryLoaded = true;
    } catch (err) {
        $('galleryGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Could not load the gallery: ${esc(err.message)}</div>`;
        galleryLoading = false; return;
    }
    galleryLoading = false;
    renderGallery();
}

function filteredGallery() {
    const term = ($('gallerySearch').value || '').toLowerCase();
    const sort = $('gallerySort').value;
    const list = galleryItems.filter((g) => (currentAlbum === 'ALL' || g.folder === currentAlbum) &&
        (!term || (g.title || '').toLowerCase().includes(term) || (g.description || '').toLowerCase().includes(term)));
    if (sort === 'oldest') list.sort((a, b) => a.created - b.created);
    else if (sort === 'az') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else list.sort((a, b) => b.created - a.created);
    return list;
}

function renderGallery() {
    if (!galleryLoaded) return;
    renderAlbumTabs();
    lightboxList = filteredGallery();
    $('galleryGrid').innerHTML = lightboxList.map((g, i) => `<div class="gallery-item">
        <img src="${esc(window.DriveService.thumb(g.id, 600))}" alt="${esc(g.title)}" class="gallery-image" loading="lazy" referrerpolicy="no-referrer" onclick="openLightbox(${i})">
        <div class="gallery-info">
            <div class="gallery-title">${esc(g.title)}</div>
            <div class="gallery-description">${esc(g.description || 'No description')}</div>
            <div class="gallery-date"><span class="chip dept">${esc(String(g.folder).replace('Gallery-', ''))}</span> <i class="fas fa-calendar"></i> ${esc(g.date)}${g.uploader ? ` · ${esc(g.uploader)}` : ''}</div>
            ${isAdminLoggedIn ? `<div class="gallery-actions"><button class="btn-icon" onclick="deleteGalleryItem('${esc(g.id)}')" title="Delete Photo"><i class="fas fa-trash"></i></button></div>` : ''}
        </div></div>`).join('') || '<div class="empty-state" style="grid-column:1/-1;">No photos here yet. Click "Upload Photo" to add some!</div>';
}

function openUploadModal() {
    if (!window.DriveService.enabled) return showNotification('Google Drive is not connected yet (see SETUP.md).', 'error');
    $('uploadForm').reset(); $('photoPreview').innerHTML = '';
    if (currentAlbum !== 'ALL') $('photoAlbum').value = currentAlbum;
    $('uploadModal').style.display = 'flex';
}
function closeUploadModal() { $('uploadModal').style.display = 'none'; }

$('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('uploadBtn'); btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Uploading…';
    try {
        await window.DriveService.upload({
            file: $('photoImage').files[0], folder: $('photoAlbum').value,
            meta: { title: $('photoTitle').value.trim(), description: $('photoDescription').value.trim(), uploader: $('photoUploader').value.trim() },
            idToken: await window.authService.getToken()
        });
        showNotification('Photo saved to Google Drive');
        closeUploadModal();
        loadGallery(true);
    } catch (err) {
        showNotification(`Upload failed: ${err.message}`, 'error');
    } finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload to Google Drive'; }
});

async function deleteGalleryItem(id) {
    if (!isAdminLoggedIn) return showNotification('Please login as admin to delete photos', 'error');
    if (!confirm('Delete this photo from Google Drive?')) return;
    try {
        await window.DriveService.remove(id, await window.authService.getToken());
        galleryItems = galleryItems.filter((g) => g.id !== id);
        renderGallery();
        showNotification('Photo deleted');
    } catch (err) { showNotification(`Delete failed: ${err.message}`, 'error'); }
}

function openLightbox(i) { lightboxIndex = i; showLightbox(); $('lightboxModal').style.display = 'flex'; }
function showLightbox() {
    const g = lightboxList[lightboxIndex];
    if (!g) return;
    $('lightboxImage').src = window.DriveService.thumb(g.id, 1600);
    $('lightboxCaption').textContent = g.title + (g.description ? ' – ' + g.description : '');
}
function stepLightbox(d) {
    const n = lightboxIndex + d;
    if (n >= 0 && n < lightboxList.length) { lightboxIndex = n; showLightbox(); }
}
function closeLightbox() { $('lightboxModal').style.display = 'none'; }
document.addEventListener('keydown', (e) => {
    if ($('lightboxModal').style.display !== 'flex') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
});

// ==================== REQUESTS ====================
function loadRequests() {
    const st = $('requestStatusFilter').value, ur = $('requestUrgencyFilter').value;
    const list = requests.filter((r) => (st === 'all' || r.status === st) && (ur === 'all' || r.urgency === ur));
    $('requestsList').innerHTML = list.map((r) => `<div class="request-card priority-${cls(r.urgency)}">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
            <div>
                <div class="admin-badge-small">Submitted by: ${esc(r.name)}</div> ${r.department ? `<span class="chip dept">${esc(r.department)}</span>` : ''}
                <h3>${esc(r.title)}</h3><p>${esc(r.description)}</p>
                <div><span class="status-badge status-${cls(r.status)}">${esc(r.status)}</span> <span class="status-badge priority-${cls(r.urgency)}">${esc(r.urgency)}</span></div>
            </div>
            ${isAdminLoggedIn ? `<div>
                <button class="btn-icon" onclick="updateRequestStatus('${r.id}','approved')" title="Approve"><i class="fas fa-check"></i></button>
                <button class="btn-icon" onclick="updateRequestStatus('${r.id}','declined')" title="Decline"><i class="fas fa-times"></i></button>
                <button class="btn-icon" onclick="updateRequestStatus('${r.id}','completed')" title="Complete"><i class="fas fa-check-double"></i></button>
            </div>` : ''}
        </div></div>`).join('') || '<div class="empty-state">No requests.</div>';
}
function openPublicRequestModal() {
    fillSelect($('publicRequestDept'), [...DEPARTMENTS, 'General']);
    $('publicRequestModal').style.display = 'flex';
}
function closePublicRequestModal() { $('publicRequestModal').style.display = 'none'; }
$('publicRequestForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const id = await window.svc.requests.add({
        name: $('publicRequestName').value.trim(), department: $('publicRequestDept').value, type: $('publicRequestType').value,
        title: $('publicRequestTitle').value.trim(), description: $('publicRequestDescription').value.trim(),
        urgency: $('publicRequestUrgency').value, status: 'pending'
    });
    if (id) { closePublicRequestModal(); this.reset(); }
});
async function updateRequestStatus(id, status) { await window.svc.requests.update(id, { status }); }

// ==================== HELP DESK ====================
function loadComplaints() {
    const deptSel = $('complaintDeptFilter');
    if (!deptSel.options.length) fillSelect(deptSel, [{ value: 'all', label: 'All Departments' }, ...DEPARTMENTS, 'General']);
    const dept = deptSel.value, st = $('complaintStatusFilter').value, cat = $('complaintCategoryFilter').value;
    const list = complaints.filter((c) => (dept === 'all' || c.department === dept) && (st === 'all' || c.status === st) && (cat === 'all' || c.category === cat));
    $('complaintsList').innerHTML = list.map((c) => `<div class="request-card">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
            <div>
                <div class="admin-badge-small">Submitted by: ${esc(c.name)}</div> ${c.department ? `<span class="chip dept">${esc(c.department)}</span>` : ''}
                <h3>${esc(c.title)}</h3><p>${esc(c.description)}</p>
                ${c.attachmentId ? `<a href="${esc(window.DriveService.viewUrl(c.attachmentId))}" target="_blank" rel="noopener noreferrer"><img class="thumb-attach" src="${esc(window.DriveService.thumb(c.attachmentId, 400))}" alt="Attachment" loading="lazy" referrerpolicy="no-referrer"></a>` : ''}
                <div style="margin-top:.5rem;"><span class="status-badge status-${cls(c.status)}">${esc(c.status)}</span> <span class="status-badge">${esc(c.category)}</span></div>
                ${c.response ? `<div style="background:var(--bg-secondary);padding:.75rem;border-radius:8px;margin-top:.5rem;"><strong>Response:</strong> ${esc(c.response)}</div>` : ''}
            </div>
            ${isAdminLoggedIn ? `<div>
                <button class="btn-icon" onclick="openResponseModal('${c.id}')" title="Respond"><i class="fas fa-reply"></i></button>
                <select class="form-control" style="margin-top:.5rem;" onchange="updateComplaintStatus('${c.id}', this.value)">
                    ${['open', 'in-progress', 'resolved'].map((s) => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${s.replace('-', ' ')}</option>`).join('')}
                </select>
            </div>` : ''}
        </div></div>`).join('') || '<div class="empty-state">No tickets.</div>';
}
function openPublicComplaintModal() {
    fillSelect($('publicComplaintDept'), [...DEPARTMENTS, 'General']);
    $('complaintPreview').innerHTML = '';
    $('publicComplaintModal').style.display = 'flex';
}
function closePublicComplaintModal() { $('publicComplaintModal').style.display = 'none'; }
$('publicComplaintForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = $('complaintSubmitBtn'); btn.disabled = true;
    try {
        let attachmentId = '';
        const file = $('publicComplaintImage').files[0];
        if (file) {
            attachmentId = (await window.DriveService.upload({
                file, folder: 'HelpDesk', meta: { title: $('publicComplaintTitle').value.trim(), uploader: $('publicComplaintName').value.trim() },
                idToken: await window.authService.getToken()
            })).id;
        }
        const id = await window.svc.helpdesk.add({
            name: $('publicComplaintName').value.trim(), department: $('publicComplaintDept').value, category: $('publicComplaintCategory').value,
            title: $('publicComplaintTitle').value.trim(), description: $('publicComplaintDescription').value.trim(),
            attachmentId, response: '', status: 'open'
        });
        if (id) { closePublicComplaintModal(); this.reset(); }
    } catch (err) {
        showNotification(`Could not attach picture: ${err.message}`, 'error');
    } finally { btn.disabled = false; }
});
function openResponseModal(id) {
    const c = complaints.find((x) => x.id === id);
    if (!c) return;
    $('responseComplaintId').value = id; $('responseStatus').value = c.status; $('responseText').value = c.response || '';
    $('responseModal').style.display = 'flex';
}
function closeResponseModal() { $('responseModal').style.display = 'none'; }
$('responseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await window.svc.helpdesk.update($('responseComplaintId').value, {
        status: $('responseStatus').value, resolution: $('responseText').value.trim(), resolvedAt: new Date().toISOString()
    });
    if (ok) closeResponseModal();
});
async function updateComplaintStatus(id, status) { await window.svc.helpdesk.update(id, { status }); }

// ==================== REPORTS ====================
function reportMonth() {
    const el = $('reportMonth');
    if (!el.value) el.value = todayISO().slice(0, 7);
    return el.value;
}
function reportRows() {
    const month = reportMonth();
    return members.map((m) => {
        const mine = attendance.filter((a) => a.memberId === m.id && String(a.date).startsWith(month));
        const present = mine.filter((a) => a.status === 'present').length;
        return {
            name: m.name, role: m.role, total: mine.length, present,
            absent: mine.filter((a) => a.status === 'absent').length,
            excused: mine.filter((a) => a.status === 'excused').length,
            pct: mine.length ? Math.round((present / mine.length) * 100) : 0,
            reasons: mine.filter((a) => a.reason).map((a) => `${a.date}: ${a.reason}`).join('; ')
        };
    });
}
function loadReport() {
    $('reportTable').innerHTML = reportRows().map((r) =>
        `<tr><td>${esc(r.name)}</td><td>${esc(r.role)}</td><td>${r.total}</td><td>${r.present}</td><td>${r.absent}</td><td>${r.excused}</td><td>${r.pct}%</td><td>${esc(r.reasons || '-')}</td></tr>`).join('')
        || '<tr><td colspan="8" class="empty-state">No data.</td></tr>';
}
function downloadReport(type) {
    if (!isAdminLoggedIn) return showNotification('Please login as admin', 'error');
    const month = reportMonth();
    if (type === 'pdf') {
        document.body.classList.add('printing-report');
        window.print();
        setTimeout(() => document.body.classList.remove('printing-report'), 500);
        return;
    }
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Member', 'Role', 'Total', 'Present', 'Absent', 'Excused', 'Attendance %', 'Reasons'];
    const lines = [header, ...reportRows().map((r) => [r.name, r.role, r.total, r.present, r.absent, r.excused, r.pct, r.reasons])].map((l) => l.map(q).join(','));
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `freely-given-media-team_attendance_${month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showNotification('Report downloaded');
}

// ==================== MODAL CLOSE ON BACKDROP ====================
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) e.target.style.display = 'none';
    if (e.target.classList.contains('lightbox-modal')) closeLightbox();
});

// ==================== START ====================
function startApp() {
    if (window.svc && window.authService && window.DriveService) {
        $('driveBanner').hidden = window.DriveService.enabled;
        fillSelect($('memberRole'), roleOptions());
        subscribeToRemoteData();
        window.authService.onChange(onAuthChanged);
        showSection('dashboard');
    } else {
        setTimeout(startApp, 50);
    }
}
startApp();
