// ===== PITCH PAGE JAVASCRIPT =====

document.addEventListener('DOMContentLoaded', () => {
    // Tab System
    initTabs();

    // Smooth Scroll
    initSmoothScroll();

    // Navbar Scroll Effect
    initNavbarScroll();

    // Scroll Animations
    initScrollAnimations();

    // Stats Counter Animation
    initStatsCounter();
});

// ===== TAB SYSTEM =====
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Remove active class from all
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked
            btn.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });
}

// ===== SMOOTH SCROLL =====
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const navbarHeight = 80;
                const targetPosition = target.offsetTop - navbarHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ===== NAVBAR SCROLL EFFECT =====
function initNavbarScroll() {
    const navbar = document.querySelector('.pitch-navbar');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Add/remove shadow on scroll
        if (currentScroll > 50) {
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        } else {
            navbar.style.boxShadow = 'none';
        }

        // Update active nav link based on section
        updateActiveNavLink();

        lastScroll = currentScroll;
    });
}

// ===== UPDATE ACTIVE NAV LINK =====
function updateActiveNavLink() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    const scrollPosition = window.pageYOffset + 100;

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');

        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

// ===== SCROLL ANIMATIONS =====
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all cards and sections
    const animatedElements = document.querySelectorAll(
        '.stat-card, .story-card, .model-card, .use-case-card, .flow-node, .eval-card'
    );

    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ===== STATS COUNTER ANIMATION =====
function initStatsCounter() {
    const statNumbers = document.querySelectorAll('.stat-number');
    let hasAnimated = false;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !hasAnimated) {
                animateNumbers();
                hasAnimated = true;
            }
        });
    }, { threshold: 0.5 });

    const statsSection = document.querySelector('.stats-grid');
    if (statsSection) {
        observer.observe(statsSection);
    }

    function animateNumbers() {
        statNumbers.forEach(stat => {
            const text = stat.textContent;
            const hasPlus = text.includes('+');
            const hasB = text.includes('B') || text.includes('฿');
            const numberMatch = text.match(/[\d.]+/);

            if (!numberMatch) return;

            const finalNumber = parseFloat(numberMatch[0]);
            const duration = 2000; // 2 seconds
            const steps = 60;
            const increment = finalNumber / steps;
            let current = 0;

            const timer = setInterval(() => {
                current += increment;
                if (current >= finalNumber) {
                    current = finalNumber;
                    clearInterval(timer);
                }

                // Format number based on original format
                let displayValue = current.toFixed(1);
                if (text.includes('วินาที')) {
                    displayValue = Math.round(current);
                }

                // Reconstruct the text
                let finalText = displayValue;
                if (hasB && current === finalNumber) {
                    finalText = '฿' + displayValue + 'B';
                } else if (hasB) {
                    finalText = '฿' + displayValue + 'B';
                }
                if (hasPlus) finalText += '+';
                if (text.includes('M')) finalText = displayValue + 'M+';
                if (text.includes('วินาที')) finalText = displayValue + ' วินาที';

                stat.textContent = finalText;

                // Add pulse effect
                if (current === finalNumber) {
                    stat.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        stat.style.transform = 'scale(1)';
                    }, 200);
                }
            }, duration / steps);
        });
    }
}

// ===== SPEED BAR ANIMATION =====
window.addEventListener('load', () => {
    const speedBars = document.querySelectorAll('.bar-fill');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                speedBars.forEach(bar => {
                    const width = bar.style.width;
                    bar.style.width = '0%';
                    setTimeout(() => {
                        bar.style.width = width;
                    }, 100);
                });
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const speedSection = document.querySelector('.speed-comparison');
    if (speedSection) {
        observer.observe(speedSection);
    }
});

// ===== GRADIENT ORBS MOUSE FOLLOW =====
document.addEventListener('mousemove', (e) => {
    const orbs = document.querySelectorAll('.gradient-orb');
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    orbs.forEach((orb, index) => {
        const speed = (index + 1) * 0.02;
        const x = (mouseX - window.innerWidth / 2) * speed;
        const y = (mouseY - window.innerHeight / 2) * speed;

        orb.style.transform = `translate(${x}px, ${y}px)`;
    });
});

// ===== PARALLAX EFFECT =====
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.hero-content');

    parallaxElements.forEach(el => {
        const speed = 0.3;
        el.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// ===== DEMO SCREENSHOT PLACEHOLDER =====
// You can replace this with actual screenshot embedding
const demoScreenshot = document.querySelector('.screenshot-placeholder');
if (demoScreenshot) {
    demoScreenshot.addEventListener('click', () => {
        window.open('/demo', '_blank');
    });
    demoScreenshot.style.cursor = 'pointer';
}

// ===== PRINT FUNCTIONALITY =====
function printPitch() {
    window.print();
}

// ===== EXPORT TO PDF (Optional) =====
function exportToPDF() {
    // This would require a library like html2pdf.js
    console.log('Export to PDF functionality - implement with html2pdf.js');
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
    // Tab navigation with arrow keys
    if (e.key === 'ArrowRight') {
        const activTab = document.querySelector('.tab-btn.active');
        const nextTab = activTab?.nextElementSibling;
        if (nextTab && nextTab.classList.contains('tab-btn')) {
            nextTab.click();
        }
    } else if (e.key === 'ArrowLeft') {
        const activeTab = document.querySelector('.tab-btn.active');
        const prevTab = activeTab?.previousElementSibling;
        if (prevTab && prevTab.classList.contains('tab-btn')) {
            prevTab.click();
        }
    }
});

// ===== UTILITY FUNCTIONS =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Add resize handling with debounce
window.addEventListener('resize', debounce(() => {
    // Handle responsive adjustments if needed
    console.log('Window resized');
}, 250));
