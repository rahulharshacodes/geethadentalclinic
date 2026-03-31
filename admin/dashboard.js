import { showToast } from './auth.js';
import { supabase } from './supabase-config.js';

// Global Data State
function getLocalYYYYMMDD() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let activeChannels = [];
let currentDateStr = getLocalYYYYMMDD();

// Helper to create a local Date object from YYYY-MM-DD without UTC offset issues
function parseLocalYYYYMMDD(str) {
    if (!str || typeof str !== 'string') return null;
    const [y, m, d] = str.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d); // Local time constructor
}

let _cachedAppts = [];
let _cachedPatients = [];
let _cachedPayments = [];
let _cachedTreatments = [];

// DOM Elements
const ui = {
    // Navigation & Context
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('.dashboard-section'),
    sectionTitle: document.getElementById('section-title'),
    sectionSubtitle: document.getElementById('section-subtitle'),
    datePicker: document.getElementById('overview-datepicker'),
    dateLabelText: document.getElementById('date-label-text'),
    statAbsent: document.getElementById('stat-absent-patients'),
    flowStatusText: document.getElementById('flow-status-text'),
    badge: document.getElementById('appointment-badge'),

    // Modals
    modalContainer: document.getElementById('modal-container'),
    modalAddPatient: document.getElementById('modal-add-patient'),
    modalAddPayment: document.getElementById('modal-add-payment'),
    
    modalViewPatient: document.getElementById('modal-view-patient'),
    viewPatName: document.getElementById('view-pat-name'),
    viewPatPhone: document.getElementById('view-pat-phone'),
    viewPatVisit: document.getElementById('view-pat-visit'),
    viewPatNotes: document.getElementById('view-pat-notes'),
    
    modalEditNote: document.getElementById('modal-edit-note'),
    editNoteForm: document.getElementById('edit-note-form'),
    editNoteId: document.getElementById('edit-note-id'),
    editNoteText: document.getElementById('edit-note-text'),

    modalConfirm: document.getElementById('modal-confirm'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmOkBtn: document.getElementById('confirm-ok-btn'),
    confirmCancelBtn: document.getElementById('confirm-cancel-btn'),

    viewPatTreatments: document.getElementById('view-pat-treatments'),
    viewPatPayments: document.getElementById('view-pat-payments'),

    closeBtns: document.querySelectorAll('.close-modal'),

    // Tables
    overviewQueue: document.getElementById('today-queue-body'),
    appointmentsTable: document.getElementById('appointments-table-body'),
    patientsTable: document.getElementById('patients-table-body'),
    paymentsTable: document.getElementById('payments-table-body'),

    // Stat Cards
    statTodayAppts: document.getElementById('stat-today-appts'),
    statPatientsPresent: document.getElementById('stat-patients-present'),
    statPatientsPresent: document.getElementById('stat-patients-present'),
    statTotalRev: document.getElementById('stat-total-revenue'),
    statMonthlyInc: document.getElementById('stat-monthly-income'),
    
    // Filters
    apptSearch: document.getElementById('appointment-search'),
    apptFilter: document.getElementById('appointment-filter'),
    paySearch: document.getElementById('search-payments'),

    // Treatment Form
    treatmentList: document.getElementById('active-treatment-list'),
    treatmentPlaceholder: document.getElementById('treatment-editor-placeholder'),
    treatmentActiveContainer: document.getElementById('treatment-active-container'),
    addNewTreatmentBtn: document.getElementById('add-new-treatment-btn'),
    pastTreatmentsList: document.getElementById('past-treatments-list'),
    treatmentFormTitle: document.getElementById('treatment-form-title'),
    cancelTreatmentBtn: document.getElementById('cancel-treatment-btn'),
    tRecordId: document.getElementById('treatment-id'),
    treatmentForm: document.getElementById('treatment-form'),
    tPatientName: document.getElementById('treatment-patient-name'),
    tPatientId: document.getElementById('treatment-patient-id'),
    tDetails: document.getElementById('treatment-details'),
    tMeds: document.getElementById('treatment-meds'),
    tNotes: document.getElementById('treatment-notes')
};

// Initialize Date Control
function updateDateLabel() {
    if (!ui.dateLabelText) return;
    const todayStr = getLocalYYYYMMDD();
    if (currentDateStr === todayStr) {
        ui.dateLabelText.textContent = "Today";
    } else {
        const d = new Date(currentDateStr);
        ui.dateLabelText.textContent = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

function initDateControl() {
    ui.datePicker.value = currentDateStr;
    updateDateLabel();
    ui.datePicker.addEventListener('change', (e) => {
        currentDateStr = e.target.value;
        updateDateLabel();
        
        // Clear out any old patient view when date changes
        if (ui.treatmentPlaceholder) ui.treatmentPlaceholder.style.display = 'flex';
        if (ui.treatmentActiveContainer) ui.treatmentActiveContainer.style.display = 'none';
        if (ui.treatmentForm) ui.treatmentForm.style.display = 'none';
        
        renderAppointmentsUI();
        renderPatientsUI();
        renderPaymentsUI();
    });
}

// Clear all listeners (on logout)
function clearListeners() {
    activeChannels.forEach(channel => channel.unsubscribe());
    activeChannels = [];
}

// ─── INIT ───
let isAppInitialized = false;

supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
        if (!isAppInitialized) {
            isAppInitialized = true;
            initDateControl();
            initGlobalListeners();
            switchSection('overview');
        }
    } else {
        isAppInitialized = false;
        clearListeners();
        // Default back to first section visually
        ui.sections.forEach(s => s.classList.remove('active'));
    }
});

// ─── NAVIGATION ───
ui.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-section');
        switchSection(target);
    });
});

function switchSection(targetId) {
    ui.navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-section="${targetId}"]`).classList.add('active');

    ui.sections.forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${targetId}`).classList.add('active');

    const titles = {
        'overview': { title: 'Overview', sub: 'Monitor today\'s activity and patient queue.' },
        'appointments': { title: 'Appointments', sub: 'Manage pending and confirmed bookings.' },
        'patients': { title: 'Patients Options', sub: 'Manage your patient database.' },
        'treatments': { title: 'Treatments', sub: 'Add clinical notes and medication.' },
        'payments': { title: 'Payments', sub: 'Track daily transactions and income.' },
        'analytics': { title: 'Analytics', sub: 'Clinic performance and statistics.' }
    };
    ui.sectionTitle.textContent = titles[targetId].title;
    ui.sectionSubtitle.textContent = titles[targetId].sub;

    if (targetId === 'analytics') {
        renderCharts();
    }
}

// ─── REAL-TIME LISTENERS & FETCHING ───

async function fetchAppointments() {
    const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('createdat', { ascending: false });
    if (error) console.error('Error fetching appointments:', error);
    else {
        _cachedAppts = data;
        renderAppointmentsUI();
    }
}

async function fetchPatients() {
    const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('createdat', { ascending: false });
    if (error) console.error('Error fetching patients:', error);
    else {
        _cachedPatients = data;
        renderPatientsUI();
    }
}

async function fetchPayments() {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('createdat', { ascending: false });
    if (error) console.error('Error fetching payments:', error);
    else {
        _cachedPayments = data;
        renderPaymentsUI();
    }
}

async function fetchTreatments() {
    const { data, error } = await supabase
        .from('treatments')
        .select('*')
        .order('createdat', { ascending: false });
    if (error) console.error('Error fetching treatments:', error);
    else {
        _cachedTreatments = data;
    }
}

function initGlobalListeners() {
    clearListeners();

    // Initial Fetch
    fetchAppointments();
    fetchPatients();
    fetchPayments();
    fetchTreatments();

    // Real-time Subscriptions
    const apptsChannel = supabase.channel('appts-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchAppointments)
        .subscribe();

    const patientsChannel = supabase.channel('patients-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, fetchPatients)
        .subscribe();

    const paymentsChannel = supabase.channel('payments-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchPayments)
        .subscribe();

    const treatmentsChannel = supabase.channel('treatments-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'treatments' }, fetchTreatments)
        .subscribe();

    activeChannels.push(apptsChannel, patientsChannel, paymentsChannel, treatmentsChannel);
}

function renderPatientsUI() {
    let patHtml = '';
    let presentCount = 0;
    let activeTreatmentsHtml = '';
    let paymentOptionsHtml = '<option value="">Select Patient</option>';
    
    _cachedPatients.forEach(data => {
        const id = data.id;
        const visitDateObj = data.createdat ? new Date(data.createdat).toLocaleDateString() : 'Walk-in';
        const notesEnc = encodeURIComponent(data.notes || '').replace(/'/g, "%27");
        const safeName = (data.name || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        const safePhone = (data.phone || '').replace(/'/g, "\\'").replace(/"/g, "&quot;");
        
        patHtml += `
            <tr>
                <td><strong>${data.name}</strong></td>
                <td>${data.phone}</td>
                <td>${visitDateObj}</td>
                <td>
                    <div style="display:flex; align-items:center; justify-content:space-between; gap: 8px;">
                        <span>${data.notes || '-'}</span>
                        <button class="btn btn-sm" style="border-radius:50%; width:28px; height:28px; padding:0; background:#f1f5f9; color:#475569; border:none; cursor:pointer; flex-shrink: 0;" onclick="editPatientNote('${id}', '${notesEnc}')" title="Edit Note">
                            <i class="fa-solid fa-pencil" style="pointer-events:none;"></i>
                        </button>
                    </div>
                </td>
                <td><button class="btn btn-sm btn-primary" onclick="viewPatient('${id}', '${safeName}', '${safePhone}', '${visitDateObj}', '${notesEnc}')">View</button></td>
            </tr>
        `;

        // Today's patients go to treatments list and payment dropdown
        if (data.visitdate === currentDateStr) {
            presentCount++;
            activeTreatmentsHtml += `
                <li class="active-patient-item" onclick="selectPatientForTreatment('${id}', '${data.name}', event)">
                    <strong>${data.name}</strong>
                    <span class="item-phone">${data.phone}</span>
                </li>
            `;
            paymentOptionsHtml += `<option value="${id}|${data.name}">${data.name}</option>`;
        }
    });

    ui.patientsTable.innerHTML = patHtml || '<tr><td colspan="5">No patients found.</td></tr>';
    ui.statPatientsPresent.textContent = presentCount;
    
    ui.treatmentList.innerHTML = activeTreatmentsHtml || '<div style="padding:16px;color:#64748b;text-align:center;">No patients present today.</div>';
    const pSelect = document.getElementById('payment-patient-id');
    if(pSelect) pSelect.innerHTML = paymentOptionsHtml;
}

function renderPaymentsUI() {
    let payHtml = '';
    let totalRev = 0;
    let monthRev = 0;
    const currentMonth = new Date().getMonth();

    const searchQ = ui.paySearch ? ui.paySearch.value.trim().toLowerCase() : '';

    _cachedPayments.forEach(data => {
        const amount = Number(data.amount) || 0;
        
        // Total revenue uses everything 
        totalRev += amount;
        
        if (data.createdat) {
            const dateObj = new Date(data.createdat);
            if (dateObj.getMonth() === currentMonth) monthRev += amount;
            
            // Map payment date to string compatible with currentDateStr (YYYY-MM-DD or local)
            // Postgre timestamp usually parses in UTC. In original script we didn't filter by date.
            const pYear = dateObj.getFullYear();
            const pMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
            const pDay = String(dateObj.getDate()).padStart(2, '0');
            const payDateStr = `${pYear}-${pMonth}-${pDay}`;

            if (payDateStr !== currentDateStr) return; // Hide payments from other days

            const pName = data.patientname || data.patientName || 'Unknown';
            if (searchQ && !pName.toLowerCase().includes(searchQ)) return;

            payHtml += `
                <tr>
                    <td><strong>${pName}</strong></td>
                    <td>₹${amount}</td>
                    <td>${data.method}</td>
                    <td>${dateObj.toLocaleDateString()}</td>
                </tr>
            `;
        }
    });

    ui.paymentsTable.innerHTML = payHtml || '<tr><td colspan="4">No payments found for this date.</td></tr>';
    ui.statTotalRev.textContent = `₹${totalRev.toLocaleString('en-IN')}`;
    ui.statMonthlyInc.textContent = `₹${monthRev.toLocaleString('en-IN')}`;
    
    // Always sync the charts when payments UI updates
    renderCharts();
}

if (ui.paySearch) {
    ui.paySearch.addEventListener('input', renderPaymentsUI);
}

// Separate render function to allow filtering without refetching
function renderAppointmentsUI() {
    let pendingCount = 0;
    let todayCount = 0;
    let absentCount = 0;
    let queuePresent = 0;
    let queueAbsent = 0;
    let queueTotal = 0;
    let htmlAll = '';
    let htmlToday = '';

    const selectedFilter = ui.apptFilter.value; 
    const searchTerm = (ui.apptSearch ? ui.apptSearch.value.toLowerCase().trim() : '');

    _cachedAppts.forEach(data => {
        const id = data.id;
        
        if (data.status === 'pending') pendingCount++;
        if (data.date === currentDateStr) todayCount++;

        // Render main Appointments section based on filter AND search
        if (selectedFilter === 'all' || selectedFilter === data.status) {
            const nameMatch = (data.name || '').toLowerCase().includes(searchTerm);
            const phoneMatch = (data.phone || '').toLowerCase().includes(searchTerm);
            
            const problemEnc = encodeURIComponent(data.problem || 'No description provided.');
            
            if (searchTerm === '' || nameMatch || phoneMatch) {
                htmlAll += `
                    <tr>
                        <td><strong>${data.name}</strong></td>
                        <td>${data.phone}</td>
                        <td>${data.date}</td>
                        <td>${data.time}</td>
                        <td><span class="status-pill status-${data.status}">${data.status}</span></td>
                        <td>
                            <div style="display:flex; align-items:center;">
                                ${data.status === 'pending' ? `
                                    <button class="btn btn-sm btn-success" onclick="updateApptStatus('${id}', 'confirmed', this)">Confirm</button>
                                    <button class="btn btn-sm btn-danger" style="margin-left:8px;" onclick="updateApptStatus('${id}', 'rejected', this)">Reject</button>
                                ` : `
                                    <button class="btn btn-sm" style="background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; padding:4px 8px; font-size:0.8rem;" onclick="updateApptStatus('${id}', 'pending', this)"><i class="fa-solid fa-rotate-left"></i> Undo</button>
                                `}
                                <button class="btn btn-sm" style="margin-left:12px; border-radius:50%; width:32px; height:32px; padding:0; background:#f1f5f9; color:#475569;" onclick="viewProblem('${problemEnc}')" title="View Problem">
                                    <i class="fa-solid fa-file-waveform"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }

        if (data.date === currentDateStr && data.attendance === 'absent') absentCount++;

        // Render Overview Queue (Only selected date's confirmed)
        if (data.date === currentDateStr && data.status === 'confirmed') {
            queueTotal++;
            const isPresent = data.attendance === 'present';
            const isAbsent = data.attendance === 'absent';
            if (isPresent) queuePresent++;
            if (isAbsent) queueAbsent++;
            
            const problemEnc = encodeURIComponent(data.problem || 'No description provided.');
            
            htmlToday += `
                <tr>
                    <td><strong>${data.name}</strong></td>
                    <td>${data.time}</td>
                    <td>${data.phone}</td>
                    <td>
                        <div style="display:flex; align-items:center;">
                            ${(!isPresent && !isAbsent) ? `
                                <button class="btn btn-sm btn-primary" id="att-btn-present-${id}" onclick="this.disabled=true;document.getElementById('att-btn-absent-${id}').disabled=true;markAttendance('${id}', 'present', '${data.name}', '${data.phone}')">Present</button>
                                <button class="btn btn-sm btn-danger" id="att-btn-absent-${id}" style="margin-left:8px;" onclick="this.disabled=true;document.getElementById('att-btn-present-${id}').disabled=true;markAttendance('${id}', 'absent')">Absent</button>
                                ${data.time === 'Walk-in' ? `<button class="btn btn-sm" style="margin-left:8px; background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; padding:4px 8px; font-size:0.8rem;" onclick="deleteWalkIn('${id}', '${data.name}')" title="Delete Walk-in"><i class="fa-solid fa-trash"></i></button>` : ''}
                            ` : `
                                <span class="status-pill ${isPresent ? 'status-confirmed' : 'status-rejected'}">${(data.attendance || '').toUpperCase()}</span>
                                <button class="btn btn-sm" style="margin-left:8px; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; padding:4px 8px; font-size:0.8rem;" onclick="markAttendance('${id}', null, '${data.name}')"><i class="fa-solid fa-rotate-left"></i> Undo</button>
                                ${data.time === 'Walk-in' ? `<button class="btn btn-sm" style="margin-left:8px; background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; padding:4px 8px; font-size:0.8rem;" onclick="deleteWalkIn('${id}', '${data.name}')" title="Delete Walk-in"><i class="fa-solid fa-trash"></i></button>` : ''}
                            `}
                            <button class="btn btn-sm" style="margin-left:12px; border-radius:50%; width:32px; height:32px; padding:0; background:#f1f5f9; color:#475569;" onclick="viewProblem('${problemEnc}')" title="View Problem">
                                <i class="fa-solid fa-file-waveform"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
    });

    ui.appointmentsTable.innerHTML = htmlAll || '<tr><td colspan="6" style="text-align:center;">No appointments found here.</td></tr>';
    ui.overviewQueue.innerHTML = htmlToday || '<tr><td colspan="4" style="text-align:center;">No confirmed appointments for this date.</td></tr>';
    
    ui.statTodayAppts.textContent = todayCount;
    if (ui.statAbsent) ui.statAbsent.textContent = absentCount;
    
    // Flow Donut Logic
    if (ui.flowStatusText) {
        ui.flowStatusText.textContent = `${queueTotal} Total Appointments`;
        const flowCanvas = document.getElementById('flowDonutChart');
        if (flowCanvas) {
            if (charts.flow) charts.flow.destroy();
            const unarrived = queueTotal - queuePresent - queueAbsent;
            charts.flow = new Chart(flowCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Present', 'Absent', 'Expected'],
                    datasets: [{
                        data: [queuePresent, queueAbsent, unarrived > 0 ? unarrived : 0],
                        backgroundColor: ['#10b981', '#ef4444', '#e2e8f0'],
                        borderWidth: 0,
                        cutout: '70%'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: true } } }
            });
        }
    }
    
    if (pendingCount > 0) {
        ui.badge.textContent = pendingCount;
        ui.badge.style.display = 'block';
    } else {
        ui.badge.style.display = 'none';
    }
}

// ─── GLOBAL WINDOW ACTIONS ───
window.updateApptStatus = async (id, status, btnEl) => {
    if (btnEl) btnEl.disabled = true;
    try {
        const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id);
        if (error) throw error;
        showToast(`Appointment marked as ${status}`, status === 'confirmed' ? 'success' : 'error');
    } catch (e) {
        showToast('Error updating status', 'error');
        if (btnEl) btnEl.disabled = false;
    }
}

window.markAttendance = async (apptId, status, name, phone) => {
    try {
        const { error: attError } = await supabase
            .from('appointments')
            .update({ attendance: status })
            .eq('id', apptId);
        if (attError) throw attError;
        
        // Migrating present patients to Patients Database
        if (status === 'present') {
            // Only merge if both Name AND Phone exactly match, OR same Name and both missing phone
            const existingPat = _cachedPatients.find(p => 
                (p.name === name && p.phone === phone && phone.trim() !== '') || 
                (p.name === name && (!p.phone || p.phone.trim() === '') && (!phone || phone.trim() === ''))
            );
            let patError;
            if (existingPat) {
                // Update existing patient's visit date
                const { error } = await supabase
                    .from('patients')
                    .update({
                        visitdate: currentDateStr,
                        notes: 'Arrived for appointment. ' + (existingPat.notes || '')
                    })
                    .eq('id', existingPat.id);
                patError = error;
            } else {
                // Insert new patient
                const { error } = await supabase
                    .from('patients')
                    .insert([{
                        name: name,
                        phone: phone,
                        visitdate: currentDateStr,
                        notes: 'Arrived for appointment.'
                    }]);
                patError = error;
            }
            if (patError) throw patError;
            showToast('Patient marked present & directory updated', 'success');
        } else if (status === 'absent') {
            showToast('Patient marked absent', 'success');
        } else if (status === null) {
            if (name) {
                // Remove the generated patient record if they mistakenly clicked present
                await supabase.from('patients').delete().match({ name: name, visitdate: currentDateStr });
            }
            showToast('Attendance action reverted', 'success');
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to mark attendance', 'error');
    }
}

window.deleteWalkIn = (apptId, patName) => {
    if (!ui.modalConfirm) {
        // Fallback if HTML not updated
        if (!confirm(`Are you sure you want to completely delete the walk-in record for ${patName}?`)) return;
        executeDeleteWalkIn(apptId, patName);
        return;
    }

    ui.confirmMessage.innerHTML = `Are you sure you want to completely delete the walk-in record for <strong>${patName}</strong>?`;
    ui.modalContainer.style.display = 'flex';
    document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
    ui.modalConfirm.style.display = 'block';

    ui.confirmOkBtn.onclick = () => {
        ui.modalContainer.style.display = 'none';
        executeDeleteWalkIn(apptId, patName);
    };
    
    ui.confirmCancelBtn.onclick = () => {
        ui.modalContainer.style.display = 'none';
    };
};

async function executeDeleteWalkIn(apptId, patName) {
    try {
        const { error: apptErr } = await supabase.from('appointments').delete().eq('id', apptId);
        if (apptErr) throw apptErr;
        
        await supabase.from('patients').delete().match({ name: patName, visitdate: currentDateStr });
        
        showToast('Walk-in record completely deleted', 'success');
    } catch (e) {
        console.error(e);
        showToast('Error deleting walk-in record', 'error');
    }
}

window.selectPatientForTreatment = (id, name, ev) => {
    // Styling the active list
    if (ev && ev.currentTarget) {
        document.querySelectorAll('.active-patient-item').forEach(el => el.classList.remove('selected'));
        ev.currentTarget.classList.add('selected');
    }

    ui.treatmentPlaceholder.style.display = 'none';
    ui.treatmentActiveContainer.style.display = 'block';
    ui.treatmentForm.style.display = 'none';
    
    ui.tPatientName.textContent = `Treating: ${name}`;
    ui.tPatientId.value = id;
    ui.tRecordId.value = '';
    
    // Render past treatments list
    const patTreatments = _cachedTreatments.filter(t => t.patientid == id || t.patientname === name || t.patientId == id || t.patientName === name);
    if (patTreatments.length === 0) {
        ui.pastTreatmentsList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px; background: white; border-radius: 8px; border: 1px dashed var(--border-color);">No prior treatments found for this patient.</p>';
        // Auto-open form if no previous treatments
        if(ui.addNewTreatmentBtn) ui.addNewTreatmentBtn.click();
    } else {
        let hHtml = '<h4 style="margin-bottom: 12px; color: var(--text-muted);">Treatment History</h4><div style="display: flex; flex-direction: column; gap: 12px;">';
        patTreatments.forEach(t => {
            const dateStr = t.date || (t.createdat ? new Date(t.createdat).toLocaleDateString() : '-');
            const detEsc = encodeURIComponent(t.details || '');
            const medEsc = encodeURIComponent(t.medications || '');
            const notesEsc = encodeURIComponent(t.notes || '');
            hHtml += `
                <div style="padding: 16px; border: 1px solid var(--border-color); border-radius: 8px; background: white; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <div style="flex:1;">
                        <strong style="color: var(--text-main); font-size: 1.05rem;">${dateStr}</strong>
                        <div style="margin-top: 8px;">
                            <p style="color: var(--text-main); font-size: 0.95rem; margin-bottom: 4px;"><strong>Treatment:</strong> ${t.details || 'No details provided'}</p>
                            <p style="color: var(--text-main); font-size: 0.95rem; margin-bottom: 4px;"><strong>Medications:</strong> ${t.medications || 'None prescribed'}</p>
                            <p style="color: var(--text-muted); font-size: 0.95rem;"><strong>Notes:</strong> ${t.notes || 'No additional notes'}</p>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; flex-shrink:0;">
                        <button class="btn btn-sm btn-secondary" onclick="editPastTreatment('${t.id}', '${detEsc}', '${medEsc}', '${notesEsc}')"><i class="fa-solid fa-pencil"></i> Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteTreatment('${t.id}')"><i class="fa-solid fa-trash"></i> Delete</button>
                    </div>
                </div>
            `;
        });
        hHtml += '</div>';
        ui.pastTreatmentsList.innerHTML = hHtml;
    }
}

window.editPastTreatment = (tId, detEsc, medEsc, notesEsc) => {
    ui.treatmentForm.style.display = 'block';
    ui.treatmentFormTitle.textContent = "Edit Existing Record";
    ui.tRecordId.value = tId;
    ui.tDetails.value = decodeURIComponent(detEsc);
    ui.tMeds.value = decodeURIComponent(medEsc);
    ui.tNotes.value = decodeURIComponent(notesEsc);
    ui.treatmentForm.scrollIntoView({ behavior: 'smooth' });
}

window.viewProblem = (problemEnc) => {
    const pText = document.getElementById('problem-text-display');
    const problemModal = document.getElementById('modal-view-problem');
    if (pText && problemModal) {
        pText.textContent = decodeURIComponent(problemEnc);
        ui.modalContainer.style.display = 'flex';
        document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
        problemModal.style.display = 'block';
    }
}

window.viewPatient = (id, name, phone, visit, notesEnc) => {
    ui.viewPatName.textContent = name;
    ui.viewPatPhone.textContent = phone;
    ui.viewPatVisit.textContent = visit;
    ui.viewPatNotes.textContent = decodeURIComponent(notesEnc) || '-';
    
    // Treatments
    const patTreatments = _cachedTreatments.filter(t => t.patientid == id || t.patientname === name || t.patientId == id || t.patientName === name);
    let tHtml = '';
    if (patTreatments.length === 0) {
        tHtml = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">No treatment history found.</td></tr>';
    } else {
        patTreatments.forEach(t => {
            const dateStr = t.date || (t.createdat ? new Date(t.createdat).toLocaleDateString() : '-');
            tHtml += `<tr>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${dateStr}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${t.details || '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${t.medications || '-'}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${t.notes || '-'}</td>
            </tr>`;
        });
    }
    if (ui.viewPatTreatments) ui.viewPatTreatments.innerHTML = tHtml;

    // Payments
    const patPayments = _cachedPayments.filter(p => p.patientid == id || p.patientname === name || p.patientId == id || p.patientName === name);
    let pHtml = '';
    if (patPayments.length === 0) {
        pHtml = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 16px;">No payment history found.</td></tr>';
    } else {
        patPayments.forEach(p => {
            const dateStr = p.createdat ? new Date(p.createdat).toLocaleDateString() : '-';
            pHtml += `<tr>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${dateStr}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color); font-weight: 500;">₹${p.amount || 0}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${p.method || '-'}</td>
            </tr>`;
        });
    }
    if (ui.viewPatPayments) ui.viewPatPayments.innerHTML = pHtml;

    ui.modalContainer.style.display = 'flex';
    document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
    ui.modalViewPatient.style.display = 'block';
}

window.editPatientNote = (id, notesEnc) => {
    ui.editNoteId.value = id;
    ui.editNoteText.value = decodeURIComponent(notesEnc);
    
    ui.modalContainer.style.display = 'flex';
    document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
    ui.modalEditNote.style.display = 'block';
}

// ─── EVENT LISTENERS ───
ui.apptFilter.addEventListener('change', () => {
    renderAppointmentsUI();
});

if (ui.apptSearch) {
    ui.apptSearch.addEventListener('input', () => {
        renderAppointmentsUI();
    });
}

// Modals
document.getElementById('open-add-patient').addEventListener('click', () => {
    ui.modalContainer.style.display = 'flex';
    document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
    ui.modalAddPatient.style.display = 'block';
});

document.getElementById('open-payment-modal').addEventListener('click', () => {
    ui.modalContainer.style.display = 'flex';
    document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
    ui.modalAddPayment.style.display = 'block';
});

ui.closeBtns.forEach(btn => btn.addEventListener('click', () => {
    ui.modalContainer.style.display = 'none';
}));

// Form Submissions
document.getElementById('add-patient-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    try {
        const name = document.getElementById('new-pat-name').value.trim();
        const phone = document.getElementById('new-pat-phone').value.trim();
        const notes = document.getElementById('new-pat-notes').value.trim();

        // Register in Patients DB
        const { error: patError } = await supabase
            .from('patients')
            .insert([{
                name: name,
                phone: phone,
                notes: notes,
                visitdate: currentDateStr
            }]);
        if (patError) throw patError;

        // Register in Appointments so it shows up in "Today's Patients" Queue with all actions
        const { error: apptError } = await supabase
            .from('appointments')
            .insert([{
                name: name,
                phone: phone,
                problem: notes || 'Walk-in registration',
                date: currentDateStr,
                time: 'Walk-in',
                status: 'confirmed',
                attendance: 'present'
            }]);
        if (apptError) throw apptError;

        // Explicitly refresh both caches so the patient shows immediately
        // in the Patients Database tab and the Treatments sidebar
        await Promise.all([fetchPatients(), fetchAppointments()]);

        showToast('Walk-in patient registered and marked present', 'success');
        ui.modalContainer.style.display = 'none';
        e.target.reset();
    } catch(err) {
        showToast('Error registering patient', 'error');
        console.error(err);
        if (submitBtn) submitBtn.disabled = false;
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
});

document.getElementById('add-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const patVal = document.getElementById('payment-patient-id').value;
    if(!patVal) return showToast('Please select a patient', 'error');
    
    const [patId, patName] = patVal.split('|');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const { error } = await supabase
            .from('payments')
            .insert([{
                patientid: patId,
                patientname: patName,
                amount: Number(document.getElementById('payment-amount').value),
                method: document.getElementById('payment-method').value,
                createdat: currentDateStr // Record on the selected dashboard date
            }]);
        if (error) throw error;
        showToast('Payment successful', 'success');
        ui.modalContainer.style.display = 'none';
        e.target.reset();
    } catch(err) {
        showToast(err.message || 'Error recording payment', 'error');
        console.error('Payment Error:', err);
        if (submitBtn) submitBtn.disabled = false;
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
});

if(ui.addNewTreatmentBtn) {
    ui.addNewTreatmentBtn.addEventListener('click', () => {
        ui.treatmentForm.style.display = 'block';
        ui.treatmentFormTitle.textContent = "Add New Treatment";
        ui.tRecordId.value = '';
        ui.treatmentForm.reset();
        ui.tDetails.focus();
    });
}
if(ui.cancelTreatmentBtn) {
    ui.cancelTreatmentBtn.addEventListener('click', () => {
        ui.treatmentForm.reset();
        ui.treatmentForm.style.display = 'none';
        ui.tRecordId.value = '';
    });
}

ui.treatmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tId = ui.tRecordId.value;
    const submitBtn = ui.treatmentForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    
    try {
        if (tId) {
            // Update existing
            const { error } = await supabase
                .from('treatments')
                .update({
                    details: ui.tDetails.value.trim(),
                    medications: ui.tMeds.value.trim(),
                    notes: ui.tNotes.value.trim()
                })
                .eq('id', tId);
            if (error) throw error;
            showToast('Treatment record updated successfully', 'success');
        } else {
            // Insert new
            const { error } = await supabase
                .from('treatments')
                .insert([{
                    patientid: ui.tPatientId.value,
                    patientname: ui.tPatientName.textContent.replace('Treating: ', ''),
                    details: ui.tDetails.value.trim(),
                    medications: ui.tMeds.value.trim(),
                    notes: ui.tNotes.value.trim(),
                    date: currentDateStr
                }]);
            if (error) throw error;
            showToast('Treatment notes saved to medical records', 'success');
        }
        
        ui.treatmentForm.reset();
        ui.treatmentForm.style.display = 'none';
        
        // Refresh the patient's view immediately with fresh data
        await fetchTreatments();
        const currentPatientId = ui.tPatientId.value;
        const currentPatientName = ui.tPatientName.textContent.replace('Treating: ', '');
        
        if (window.selectPatientForTreatment) {
            window.selectPatientForTreatment(currentPatientId, currentPatientName, null);
        }
    } catch(err) {
        showToast(err.message || 'Error saving treatment data', 'error');
        console.error('Treatment Error:', err);
        if (submitBtn) submitBtn.disabled = false;
    }
});

window.deleteTreatment = (tId) => {
    ui.confirmMessage.innerHTML = `Are you sure you want to <strong>permanently delete</strong> this treatment record? This cannot be undone.`;
    ui.modalContainer.style.display = 'flex';
    document.querySelectorAll('.modal-card').forEach(m => m.style.display = 'none');
    ui.modalConfirm.style.display = 'block';

    ui.confirmOkBtn.onclick = async () => {
        ui.modalContainer.style.display = 'none';
        try {
            const { error } = await supabase.from('treatments').delete().eq('id', tId);
            if (error) throw error;
            showToast('Treatment record deleted', 'success');
            await fetchTreatments();
            const currentPatientId = ui.tPatientId.value;
            const currentPatientName = ui.tPatientName.textContent.replace('Treating: ', '');
            if (currentPatientId) {
                window.selectPatientForTreatment(currentPatientId, currentPatientName, null);
            }
        } catch(err) {
            showToast('Error deleting treatment record', 'error');
            console.error(err);
        }
    };

    ui.confirmCancelBtn.onclick = () => {
        ui.modalContainer.style.display = 'none';
    };
};

if (ui.editNoteForm) {
    ui.editNoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = ui.editNoteId.value;
        const newNotes = ui.editNoteText.value.trim();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        
        try {
            const { error } = await supabase
                .from('patients')
                .update({ notes: newNotes })
                .eq('id', id);
            if (error) throw error;
            
            // Refresh patiently to instantly update DOM
            await fetchPatients();
            
            showToast('Note updated successfully', 'success');
            ui.modalContainer.style.display = 'none';
            ui.editNoteForm.reset();
        } catch(err) {
            showToast(err.message || 'Error updating note', 'error');
            console.error('Note Error:', err);
            if (submitBtn) submitBtn.disabled = false;
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// ─── CHARTS (Analytics) ───
let charts = {};
function renderCharts() {
    if(!window.Chart) return;
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Re-usable color palette from CSS
    const primary = '#2563eb';
    const primaryLight = 'rgba(37, 99, 235, 0.1)';
    const success = '#10b981';
    const warning = '#f59e0b';
    const danger = '#ef4444';

    // ─── Range Calculation (Local Time) ───
    const timeFilterSelector = document.getElementById('analytics-time-filter');
    const timeFilter = timeFilterSelector ? timeFilterSelector.value : 'monthly';
    const endDate = parseLocalYYYYMMDD(currentDateStr);
    if (!endDate) return;
    endDate.setHours(23, 59, 59, 999);
    
    let startDate = new Date(endDate);
    let numPeriods = 7;
    let formatLabel = (d) => d.toLocaleDateString();
    let getPeriodKey = (d) => ''; 

    if (timeFilter === 'daily') {
        numPeriods = 7; 
        startDate.setDate(endDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        formatLabel = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        getPeriodKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    } else if (timeFilter === 'weekly') {
        numPeriods = 8; 
        startDate.setDate(endDate.getDate() - (7 * 7));
        startDate.setHours(0, 0, 0, 0);
        formatLabel = (d) => `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        getPeriodKey = (d) => {
            const diffDays = Math.floor((endDate - d) / (1000 * 60 * 60 * 24));
            const weekIndex = Math.floor(diffDays / 7);
            return `week-${weekIndex}`; 
        };
    } else { // monthly
        numPeriods = 12; 
        startDate.setMonth(endDate.getMonth() - 11);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        formatLabel = (d) => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        getPeriodKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;
    }

    const periods = [];
    const incomeDataMap = {};
    const trafficDataMap = {};
    
    // Distribution Counters (Pie Charts)
    let cash = 0, upi = 0, card = 0;
    let conf = 0, pending = 0, rej = 0;

    if (timeFilter === 'daily') {
        for(let i = numPeriods - 1; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - i);
            const key = getPeriodKey(d);
            periods.push({ key, label: formatLabel(d) });
            incomeDataMap[key] = 0; trafficDataMap[key] = 0;
        }
    } else if (timeFilter === 'weekly') {
        for(let i = numPeriods - 1; i >= 0; i--) {
            const d = new Date(endDate);
            d.setDate(d.getDate() - (i * 7));
            const key = `week-${i}`;
            periods.push({ key, label: formatLabel(d) });
            incomeDataMap[key] = 0; trafficDataMap[key] = 0;
        }
    } else { // monthly
        for(let i = numPeriods - 1; i >= 0; i--) {
            const d = new Date(endDate);
            d.setMonth(d.getMonth() - i);
            const key = getPeriodKey(d);
            periods.push({ key, label: formatLabel(d) });
            incomeDataMap[key] = 0; trafficDataMap[key] = 0;
        }
    }

    // Process Financials & Methodology Distribution
    _cachedPayments.forEach(data => {
        const d = data.createdat ? (typeof data.createdat === 'string' && data.createdat.includes('-') ? parseLocalYYYYMMDD(data.createdat.split('T')[0]) : new Date(data.createdat)) : null;
        if(d && d >= startDate && d <= endDate) {
            const key = getPeriodKey(d);
            if(incomeDataMap[key] !== undefined) incomeDataMap[key] += (Number(data.amount) || 0);
            
            const method = data.method;
            if(method === 'Cash') cash++;
            else if(method === 'UPI') upi++;
            else if(method === 'Card') card++;
        }
    });

    // Process Traffic
    _cachedPatients.forEach(p => {
        const d = p.visitdate ? parseLocalYYYYMMDD(p.visitdate) : (p.createdat ? new Date(p.createdat) : null);
        if(d && d >= startDate && d <= endDate) {
            const key = getPeriodKey(d);
            if(trafficDataMap[key] !== undefined) trafficDataMap[key]++;
        }
    });

    // Process Appointment Status Distribution
    _cachedAppts.forEach(d => {
        const dt = d.date ? parseLocalYYYYMMDD(d.date) : (d.createdat ? new Date(d.createdat) : null);
        if(dt && dt >= startDate && dt <= endDate) {
            if(d.status === 'confirmed') conf++;
            else if(d.status === 'pending') pending++;
            else if(d.status === 'rejected') rej++;
        }
    });

    const incomeLabels = periods.map(p => p.label);
    const incomeData = periods.map(p => incomeDataMap[p.key]);
    const trafficLabels = periods.map(p => p.label);
    const trafficData = periods.map(p => trafficDataMap[p.key]);

    // Render Income Trend
    const incCanvas = document.getElementById('incomeTrendChart');
    if(incCanvas) {
        if(charts.inc) charts.inc.destroy();
        charts.inc = new Chart(incCanvas, {
            type: 'line',
            data: {
                labels: incomeLabels,
                datasets: [{
                    label: 'Income (₹)',
                    data: incomeData,
                    borderColor: primary,
                    backgroundColor: primaryLight,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Render Status Distribution Chart (Pie)
    const appCanvas = document.getElementById('appointmentStatusChart');
    if(appCanvas) {
        if(charts.app) charts.app.destroy();
        charts.app = new Chart(appCanvas, {
            type: 'pie',
            data: {
                labels: ['Confirmed', 'Pending', 'Rejected'],
                datasets: [{
                    data: [conf, pending, rej],
                    backgroundColor: [success, warning, danger],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Render Methodology Distribution Chart (Doughnut)
    const pmCanvas = document.getElementById('paymentMethodChart');
    if(pmCanvas) {
        if(charts.pm) charts.pm.destroy();
        charts.pm = new Chart(pmCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Cash', 'UPI', 'Card'],
                datasets: [{
                    data: [cash, upi, card],
                    backgroundColor: [success, primary, warning],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Render Traffic Bar Chart
    const trafficCanvas = document.getElementById('dailyTrafficChart');
    if(trafficCanvas) {
        if(charts.tra) charts.tra.destroy();
        charts.tra = new Chart(trafficCanvas, {
            type: 'bar',
            data: {
                labels: trafficLabels,
                datasets: [{
                    label: 'Patient Traffic',
                    data: trafficData,
                    backgroundColor: success,
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
        });
    }
}

// Attach filter listener
if(document.getElementById('analytics-time-filter')) {
    document.getElementById('analytics-time-filter').addEventListener('change', renderCharts);
}
