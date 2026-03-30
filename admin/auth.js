import { supabase } from './supabase-config.js';

// DOM Elements
const loginPage = document.getElementById('login-page');
const dashboardApp = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');
const loginBtnBtn = document.getElementById('login-btn');

// Helper to show toasts (matches dashboard style)
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast toast-' + type + ' toast-show';
    setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 4000);
}

// Authentication State Observer
supabase.auth.onAuthStateChange((event, session) => {
    const user = session?.user;
    if (user) {
        // User is signed in
        loginPage.style.display = 'none';
        dashboardApp.style.display = 'flex';
        // Dispatch custom event so dashboard.js knows to start fetching data
        document.dispatchEvent(new CustomEvent('auth-success', { detail: { user } }));
    } else {
        // User is signed out
        loginPage.style.display = 'flex';
        dashboardApp.style.display = 'none';
        document.dispatchEvent(new CustomEvent('auth-logout'));
    }
});

// Handle Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        loginError.textContent = '';
        loginBtnBtn.disabled = true;
        const originalText = loginBtnBtn.innerHTML;
        loginBtnBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showToast('Login successful', 'success');
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'Invalid email or password. Please try again.';
        } finally {
            loginBtnBtn.disabled = false;
            loginBtnBtn.innerHTML = originalText;
        }
    });
}

// Handle Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            showToast('Logged out successfully', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            showToast('Error logging out', 'error');
        }
    });
}
