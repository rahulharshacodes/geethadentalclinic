import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://njxoxiirdpfhxxtmrkci.supabase.co";
const supabaseKey = "sb_publishable_yKryW-vuqCcOUx2ULTO4XA_ErDKBCCx";
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Toast Notification ───
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast toast-' + type + ' toast-show';
    setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    
    // Sticky Navbar
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile Menu Toggle
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const mobileNav = document.querySelector('.mobile-nav');
    
    mobileBtn.addEventListener('click', () => {
        mobileNav.classList.toggle('active');
        const icon = mobileBtn.querySelector('i');
        if (mobileNav.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-xmark');
        } else {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-bars');
        }
    });

    // Close mobile menu on link click
    document.querySelectorAll('.mobile-nav a').forEach(link => {
        link.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            const icon = mobileBtn.querySelector('i');
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-bars');
        });
    });

    // Intersection Observer for scroll animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('appear');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right');
    animatedElements.forEach(el => observer.observe(el));


    // Before/After Comparison Slider Logic
    const slider = document.querySelector('.comparison-slider');
    const afterImage = document.getElementById('comparison-after');
    const handle = document.getElementById('comparison-handle');

    if (slider) {
        const slideMove = (e) => {
            let pos, x;
            
            // Get x coordinate
            x = e.pageX || (e.touches ? e.touches[0].pageX : 0);
            
            // Calculate cursor position relative to slider
            pos = x - slider.getBoundingClientRect().left - window.scrollX;
            
            // Prevent sliding outside of bounds
            if (pos < 0) pos = 0;
            if (pos > slider.offsetWidth) pos = slider.offsetWidth;
            
            // Update widths / positions
            const percentage = (pos / slider.offsetWidth) * 100;
            afterImage.style.clipPath = `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`;
            handle.style.left = percentage + "%";
        }

        // Automatically move on hover without clicking
        slider.addEventListener('mousemove', slideMove);
        slider.addEventListener('touchmove', slideMove, { passive: true });
    }

    // Custom Smooth Scrolling for all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                
                const headerOffset = 80;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerOffset;
                const startPosition = window.pageYOffset;
                const distance = targetPosition - startPosition;
                const duration = 1000; // 1 second duration
                let start = null;
                
                function step(timestamp) {
                    if (!start) start = timestamp;
                    const progress = timestamp - start;
                    
                    // EaseInOutCubic function
                    let easeProgress = progress / duration;
                    if (easeProgress > 1) easeProgress = 1;
                    
                    const ease = easeProgress < 0.5 
                        ? 4 * easeProgress * easeProgress * easeProgress 
                        : 1 - Math.pow(-2 * easeProgress + 2, 3) / 2;
                        
                    window.scrollTo(0, startPosition + distance * ease);
                    
                    if (progress < duration) {
                        window.requestAnimationFrame(step);
                    } else {
                        window.scrollTo(0, targetPosition);
                    }
                }
                
                window.requestAnimationFrame(step);
            }
        });
    });

    // Testimonial Carousel (3 items visible)
    const testimonialSlides = document.querySelectorAll('.testimonial-carousel .testimonial-card');
    if (testimonialSlides.length > 0) {
        let currentSlideIndex = 0;
        
        function updateCarousel() {
            testimonialSlides.forEach((slide, index) => {
                slide.classList.remove('active-slide', 'prev-slide', 'next-slide');
                
                if (index === currentSlideIndex) {
                    slide.classList.add('active-slide');
                } else if (index === (currentSlideIndex - 1 + testimonialSlides.length) % testimonialSlides.length) {
                    slide.classList.add('prev-slide');
                } else if (index === (currentSlideIndex + 1) % testimonialSlides.length) {
                    slide.classList.add('next-slide');
                }
            });
        }
        
        // Initial setup
        updateCarousel();
        
        setInterval(() => {
            currentSlideIndex = (currentSlideIndex + 1) % testimonialSlides.length;
            updateCarousel();
        }, 3000);
    }

    // Visual Clinic Tour Carousel
    const tourInner = document.querySelector('.tour-inner');
    const tourItems = document.querySelectorAll('.tour-item');
    const tourPrev = document.querySelector('.tour-prev');
    const tourNext = document.querySelector('.tour-next');

    if (tourInner && tourItems.length > 0) {
        let currentTourIndex = 0;
        const totalTourItems = tourItems.length;

        function updateTourCarousel() {
            const offset = -currentTourIndex * (100 / totalTourItems);
            tourInner.style.transform = `translateX(${offset}%)`;
        }

        tourNext.addEventListener('click', () => {
            currentTourIndex = (currentTourIndex + 1) % totalTourItems;
            updateTourCarousel();
        });

        tourPrev.addEventListener('click', () => {
            currentTourIndex = (currentTourIndex - 1 + totalTourItems) % totalTourItems;
            updateTourCarousel();
        });
    }

    // ─── Appointment Form → Firebase Firestore ───
    const appointmentForm = document.getElementById('appointmentForm');
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Clear previous validation states
            appointmentForm.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
            appointmentForm.querySelectorAll('.field-error').forEach(el => el.remove());
            
            const nameInput = document.getElementById('patName');
            const mobileInput = document.getElementById('patMobile');
            const dateInput = document.getElementById('patDate');
            const timeInput = document.getElementById('patTime');
            
            const name = nameInput.value.trim();
            const phone = mobileInput.value.trim();
            const date = dateInput.value;
            const time = timeInput.value;
            
            let hasError = false;

            // Validate name
            if (!name || name.length < 2) {
                showFieldError(nameInput, 'Please enter your full name');
                hasError = true;
            }
            
            // Validate phone — allow 10-digit Indian numbers with optional +91 / 0 prefix
            const phoneClean = phone.replace(/[\s\-()]/g, '');
            const phoneRegex = /^(\+91|91|0)?[6-9]\d{9}$/;
            if (!phoneClean || !phoneRegex.test(phoneClean)) {
                showFieldError(mobileInput, 'Please enter a valid 10-digit mobile number');
                hasError = true;
            }
            
            // Validate date — must be today or in the future
            if (!date) {
                showFieldError(dateInput, 'Please select a date');
                hasError = true;
            } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const selected = new Date(date);
                if (selected < today) {
                    showFieldError(dateInput, 'Please select today or a future date');
                    hasError = true;
                }
            }
            
            // Validate time
            if (!time) {
                showFieldError(timeInput, 'Please select a time slot');
                hasError = true;
            }
            
            if (hasError) {
                console.warn('Form validation failed. Errors found.');
                return;
            }

            console.log('Submitting appointment for:', name, phoneClean);

            // Show loading state
            const submitBtn = appointmentForm.querySelector('button[type="submit"]');
            const originalHTML = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

            try {
                const { error } = await supabase.from('appointments').insert([{
                    name: name,
                    phone: phoneClean, // Store cleaned number
                    date: date,
                    time: time,
                    problem: document.getElementById('patProblem').value.trim() || 'No description',
                    status: 'pending'
                }]);
                if (error) throw error;

                showToast('Appointment request sent! We will confirm shortly.', 'success');
                appointmentForm.reset();
            } catch (error) {
                console.error('Firestore error:', error);
                showToast('Something went wrong. Please try again or call us directly.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHTML;
            }
        });
    }

    // ─── Field-level error helper ───
    function showFieldError(input, message) {
        input.classList.add('input-error');
        const errorEl = document.createElement('span');
        errorEl.className = 'field-error';
        errorEl.textContent = message;
        input.parentElement.appendChild(errorEl);
    }

    // Set min date on date picker to today
    const dateInput = document.getElementById('patDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    // ─── Block confirmed time slots ───
    const patTimeSelect = document.getElementById('patTime');
    const slotStatus = document.getElementById('slot-status-summary');

    // Helper to parse "10:30 AM" to minutes from midnight
    function parseTimeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [time, period] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }

    async function updateBookedSlots(selectedDate) {
        if (!selectedDate || !patTimeSelect) return;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const isToday = selectedDate === todayStr;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        let blockedCount = 0;

        // Reset all options and block past times if today
        Array.from(patTimeSelect.options).forEach(opt => {
            if (!opt.value) return;
            opt.disabled = false;
            opt.textContent = opt.value; // Reset text

            if (isToday) {
                const slotMinutes = parseTimeToMinutes(opt.value);
                if (slotMinutes < currentMinutes + 1) { // Block if time passed
                    opt.disabled = true;
                    opt.textContent = opt.value + ' — Passed';
                    blockedCount++;
                }
            }
        });

        // Fetch confirmed appointments from Supabase
        const { data, error } = await supabase
            .from('appointments')
            .select('time, status, date')
            .eq('date', selectedDate)
            .eq('status', 'confirmed');

        if (!error && data) {
            const bookedTimes = new Set(data.map(a => a.time));
            Array.from(patTimeSelect.options).forEach(opt => {
                if (opt.value && bookedTimes.has(opt.value)) {
                    opt.disabled = true;
                    opt.textContent = opt.value + ' — Booked';
                    blockedCount++;
                }
            });
        }

        // Update Slot Status Summary (Colors and Text)
        if (slotStatus) {
            slotStatus.style.display = 'block';
            if (blockedCount > 0) {
                slotStatus.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${blockedCount} slots unavailable for this date.`;
                slotStatus.style.color = '#ef4444'; // Red for blocked
                slotStatus.style.background = '#fef2f2';
            } else {
                slotStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> All slots available!`;
                slotStatus.style.color = '#10b981'; // Green for available
                slotStatus.style.background = '#f0fdf4';
            }
        }

        // If currently selected slot is now disabled, reset selection
        if (patTimeSelect.value) {
            const selectedOpt = Array.from(patTimeSelect.options).find(o => o.value === patTimeSelect.value);
            if (selectedOpt && selectedOpt.disabled) {
                patTimeSelect.value = '';
            }
        }
    }

    if (dateInput && patTimeSelect) {
        dateInput.addEventListener('change', () => {
            updateBookedSlots(dateInput.value);
        });
    }
});
