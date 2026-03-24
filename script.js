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
});
