import { showToast } from './auth.js';
import { supabase } from './supabase-config.js';

// Global Data State
let activeChannels = [];
let currentDateStr = new Date().toISOString().split('T')[0];
let _cachedAppts = [];
let _cachedPatients = [];
let _cachedPayments = [];

// DOM Elements
const ui = {
    // Navigation & Context
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('.dashboard-section'),
    sectionTitle: document.getElementById('section-title'),
    sectionSubtitle: document.getElementById('section-subtitle'),
    currentDateText: document.getElementById('current-date-text'),
    badge: document.getElementById('appointment-badge'),

    // Modals
    modalContainer: document.getElementById('modal-container'),
    modalAddPatient: document.getElementById('modal-add-patient'),
    modalAddPayment: document.getElementById('modal-add-payment'),
    closeBtns: document.querySelectorAll('.close-modal'),

    // Tables
    overviewQueue: document.getElementById('today-queue-body'),
    appointmentsTable: document.getElementById('appointments-table-body'),
    patientsTable: document.getElementById('patients-table-body'),
    paymentsTable: document.getElementById('payments-table-body'),

    // Stat Cards
    statTodayAppts: document.getElementById('stat-today-appts'),
    statPatientsPresent: document.getElementById('stat-patients-present'),
    statPendingConfirm: document.getElementById('stat-pending-confirm'),
    statTotalRev: document.getElementById('stat-total-revenue'),
    statMonthlyInc: document.getElementById('stat-monthly-income'),
    
    // Filters
    apptFilter: document.getElementById('appointment-filter'),

    // Treatment Form
    treatmentList: document.getElementById('active-treatment-list'),
    treatmentPlaceholder: document.getElementById('treatment-editor-placeholder'),
    treatmentForm: document.getElementById('treatment-form'),
    tPatientName: document.getElementById('treatment-patient-name'),
    tPatientId: document.getElementById('treatment-patient-id'),
    tDetails: document.getElementById('treatment-details'),
    tMeds: document.getElementById('treatment-meds'),
    tNotes: document.getElementById('treatment-notes')
};

// Format Date string
function formatDateText() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    ui.currentDateText.textContent = new Date().toLocaleDateString('en-US', options);
}

// Clear all listeners (on logout)
function clearListeners() {
    activeChannels.forEach(channel => channel.unsubscribe());
    activeChannels = [];
}

// ─── INIT ───
document.addEventListener('auth-success', () => {
    formatDateText();
    initGlobalListeners();
    switchSection('overview');
});

document.addEventListener('auth-logout', () => {
    clearListeners();
    // Default back to first section visually
    ui.sections.forEach(s => s.classList.remove('active'));
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

function initGlobalListeners() {
    clearListeners();

    // Initial Fetch
    fetchAppointments();
    fetchPatients();
    fetchPayments();

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

    activeChannels.push(apptsChannel, patientsChannel, paymentsChannel);
}

function renderPatientsUI() {
    let patHtml = '';
    let presentCount = 0;
    let activeTreatmentsHtml = '';
    let paymentOptionsHtml = '<option value="">Select Patient</option>';
    
    _cachedPatients.forEach(data => {
        const id = data.id;
        const visitDateObj = data.createdat ? new Date(data.createdat).toLocaleDateString() : 'Walk-in';
        
        patHtml += `
            <tr>
                <td><strong>${data.name}</strong></td>
                <td>${data.phone}</td>
                <td>${visitDateObj}</td>
                <td>${data.notes || '-'}</td>
                <td><button class="btn btn-sm btn-primary" onclick="alert('View details for ${data.name}')">View</button></td>
            </tr>
        `;

        // Today's patients go to treatments list and payment dropdown
        if (data.visitDate === currentDateStr) {
            presentCount++;
            activeTreatmentsHtml += `
                <li class="active-patient-item" onclick="selectPatientForTreatment('${id}', '${data.name}')">
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

    _cachedPayments.forEach(data => {
        const amount = Number(data.amount) || 0;
        totalRev += amount;
        
        if (data.createdat) {
            const dateObj = new Date(data.createdat);
            if (dateObj.getMonth() === currentMonth) monthRev += amount;
            
            payHtml += `
                <tr>
                    <td><strong>${data.patientName}</strong></td>
                    <td>₹${amount}</td>
                    <td>${data.method}</td>
                    <td>${dateObj.toLocaleDateString()}</td>
                </tr>
            `;
        }
    });

    ui.paymentsTable.innerHTML = payHtml || '<tr><td colspan="4">No payments found.</td></tr>';
    ui.statTotalRev.textContent = `₹${totalRev.toLocaleString('en-IN')}`;
    ui.statMonthlyInc.textContent = `₹${monthRev.toLocaleString('en-IN')}`;
}

// Separate render function to allow filtering without refetching
function renderAppointmentsUI() {
    let pendingCount = 0;
    let todayCount = 0;
    let htmlAll = '';
    let htmlToday = '';

    const selectedFilter = ui.apptFilter.value; 

    _cachedAppts.forEach(data => {
        const id = data.id;
        
        if (data.status === 'pending') pendingCount++;
        if (data.date === currentDateStr) todayCount++;

        // Render main Appointments section based on filter
        if (selectedFilter === 'all' || selectedFilter === data.status) {
            htmlAll += `
                <tr>
                    <td><strong>${data.name}</strong></td>
                    <td>${data.phone}</td>
                    <td>${data.date}</td>
                    <td>${data.time}</td>
                    <td><span class="status-pill status-${data.status}">${data.status}</span></td>
                    <td>
                        ${data.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" onclick="updateApptStatus('${id}', 'confirmed')">Confirm</button>
                            <button class="btn btn-sm btn-danger" style="margin-left:8px;" onclick="updateApptStatus('${id}', 'rejected')">Reject</button>
                        ` : '-'}
                    </td>
                </tr>
            `;
        }

        // Render Overview Queue (Only today's, non-rejected)
        if (data.date === currentDateStr && data.status !== 'rejected') {
            const isPresent = data.attendance === 'present';
            const isAbsent = data.attendance === 'absent';
            
            htmlToday += `
                <tr>
                    <td><strong>${data.name}</strong></td>
                    <td>${data.time}</td>
                    <td>${data.phone}</td>
                    <td>
                        ${(!isPresent && !isAbsent) ? `
                            <button class="btn btn-sm btn-primary" onclick="markAttendance('${id}', 'present', '${data.name}', '${data.phone}')">Present</button>
                            <button class="btn btn-sm btn-danger" style="margin-left:8px;" onclick="markAttendance('${id}', 'absent')">Absent</button>
                        ` : `<span class="status-pill ${isPresent ? 'status-confirmed' : 'status-rejected'}">${(data.attendance || '').toUpperCase()}</span>`}
                    </td>
                </tr>
            `;
        }
    });

    ui.appointmentsTable.innerHTML = htmlAll || '<tr><td colspan="6" style="text-align:center;">No appointments found here.</td></tr>';
    ui.overviewQueue.innerHTML = htmlToday || '<tr><td colspan="4" style="text-align:center;">No appointments scheduled for today.</td></tr>';
    
    ui.statTodayAppts.textContent = todayCount;
    ui.statPendingConfirm.textContent = pendingCount;
    
    if (pendingCount > 0) {
        ui.badge.textContent = pendingCount;
        ui.badge.style.display = 'block';
    } else {
        ui.badge.style.display = 'none';
    }
}

// ─── GLOBAL WINDOW ACTIONS ───
window.updateApptStatus = async (id, status) => {
    try {
        const { error } = await supabase
            .from('appointments')
            .update({ status })
            .eq('id', id);
        if (error) throw error;
        showToast(`Appointment marked as ${status}`, status === 'confirmed' ? 'success' : 'error');
    } catch (e) {
        showToast('Error updating status', 'error');
    }
}

window.markAttendance = async (apptId, status, name, phone) => {
    try {
        const { error: attError } = await supabase
            .from('appointments')
            .update({ attendance: status })
            .eq('id', apptId);
        if (attError) throw attError;
        
        // Automatically migrate present patients to Patients Database
        if (status === 'present') {
            const { error: patError } = await supabase
                .from('patients')
                .insert([{
                    name: name,
                    phone: phone,
                    visitDate: currentDateStr,
                    notes: 'Arrived for appointment.'
                }]);
            if (patError) throw patError;
            showToast('Patient marked present & added to directory', 'success');
        } else {
            showToast('Patient marked absent', 'success');
        }
    } catch (e) {
        console.error(e);
        showToast('Failed to mark attendance', 'error');
    }
}

window.selectPatientForTreatment = (id, name) => {
    // Styling the active list
    document.querySelectorAll('.active-patient-item').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    ui.treatmentPlaceholder.style.display = 'none';
    ui.treatmentForm.style.display = 'block';
    
    ui.tPatientName.textContent = `Treating: ${name}`;
    ui.tPatientId.value = id;
    
    // Clear form
    ui.tDetails.value = '';
    ui.tMeds.value = '';
    ui.tNotes.value = '';
}

// ─── EVENT LISTENERS ───
ui.apptFilter.addEventListener('change', () => {
    renderAppointmentsUI();
});

// Modals
document.getElementById('open-add-patient').addEventListener('click', () => {
    ui.modalContainer.style.display = 'flex';
    ui.modalAddPatient.style.display = 'block';
    ui.modalAddPayment.style.display = 'none';
});

document.getElementById('open-payment-modal').addEventListener('click', () => {
    ui.modalContainer.style.display = 'flex';
    ui.modalAddPatient.style.display = 'none';
    ui.modalAddPayment.style.display = 'block';
});

ui.closeBtns.forEach(btn => btn.addEventListener('click', () => {
    ui.modalContainer.style.display = 'none';
}));

// Form Submissions
document.getElementById('add-patient-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const { error } = await supabase
            .from('patients')
            .insert([{
                name: document.getElementById('new-pat-name').value.trim(),
                phone: document.getElementById('new-pat-phone').value.trim(),
                notes: document.getElementById('new-pat-notes').value.trim(),
                visitDate: currentDateStr // Marking as Walk-In implies visit today
            }]);
        if (error) throw error;
        showToast('Patient successfully registered');
        ui.modalContainer.style.display = 'none';
        e.target.reset();
    } catch(err) {
        showToast('Error registering patient', 'error');
    }
});

document.getElementById('add-payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const patVal = document.getElementById('payment-patient-id').value;
    if(!patVal) return showToast('Please select a patient', 'error');
    
    const [patId, patName] = patVal.split('|');

    try {
        const { error } = await supabase
            .from('payments')
            .insert([{
                patientId: patId,
                patientName: patName,
                amount: Number(document.getElementById('payment-amount').value),
                method: document.getElementById('payment-method').value
            }]);
        if (error) throw error;
        showToast('Payment successful', 'success');
        ui.modalContainer.style.display = 'none';
        e.target.reset();
    } catch(err) {
        showToast('Error recording payment', 'error');
    }
});

ui.treatmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const { error } = await supabase
            .from('treatments')
            .insert([{
                patientId: ui.tPatientId.value,
                patientName: ui.tPatientName.textContent.replace('Treating: ', ''),
                details: ui.tDetails.value.trim(),
                medications: ui.tMeds.value.trim(),
                notes: ui.tNotes.value.trim(),
                date: currentDateStr
            }]);
        if (error) throw error;
        showToast('Treatment notes saved to medical records', 'success');
        ui.treatmentForm.reset();
        ui.treatmentForm.style.display = 'none';
        ui.treatmentPlaceholder.style.display = 'flex';
        document.querySelectorAll('.active-patient-item').forEach(el => el.classList.remove('selected'));
    } catch(err) {
        showToast('Error saving treatment data', 'error');
    }
});

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

    // Payment Methods Pie Chart
    let cash = 0, upi = 0, card = 0;
    _cachedPayments.forEach(data => {
        const method = data.method;
        if(method === 'Cash') cash++;
        else if(method === 'UPI') upi++;
        else if(method === 'Card') card++;
    });

    const pmCanvas = document.getElementById('paymentMethodChart');
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

    // Income Trend Chart (Mock historic data + Current Month)
    const incCanvas = document.getElementById('incomeTrendChart');
    if(charts.inc) charts.inc.destroy();
    charts.inc = new Chart(incCanvas, {
        type: 'line',
        data: {
            labels: ['October', 'November', 'December', 'January', 'February', 'Current'],
            datasets: [{
                label: 'Monthly Income (₹)',
                data: [35000, 48000, 42000, 56000, 51000, parseInt(ui.statMonthlyInc.innerText.replace(/[^0-9]/g, '')) || 0],
                borderColor: primary,
                backgroundColor: primaryLight,
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Appointment Status Pie Chart
    let conf = 45; // base mock to always show a chart slice
    let pending = parseInt(ui.statPendingConfirm.innerText) || 0;
    let rej = 5;

    const appCanvas = document.getElementById('appointmentStatusChart');
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

    // Daily Traffic Chart
    const currentPatients = parseInt(ui.statPatientsPresent.innerText) || 0;
    const trafficCanvas = document.getElementById('dailyTrafficChart');
    if(charts.tra) charts.tra.destroy();
    charts.tra = new Chart(trafficCanvas, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Today'],
            datasets: [{
                label: 'Patient Count',
                data: [18, 22, 14, 25, 20, currentPatients],
                backgroundColor: success,
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
