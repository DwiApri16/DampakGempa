


    function showSlide(n) {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === n - 1);
      });
      currentSlide = n;
    }

    // Dark Mode Toggle (localStorage)
    document.addEventListener('DOMContentLoaded', () => {
      const toggle = document.getElementById('darkModeToggle');
      const savedMode = localStorage.getItem('darkMode');

      if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
        toggle.checked = true;
      }

      toggle.addEventListener('change', function () {
        if (this.checked) {
          document.body.classList.add('dark-mode');
          localStorage.setItem('darkMode', 'enabled');
        } else {
          document.body.classList.remove('dark-mode');
          localStorage.setItem('darkMode', 'disabled');
        }
      });
    });

    // Menu Mobile Toggle
    document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobileNav');

    hamburger.addEventListener('click', () => {
        mobileNav.classList.toggle('show');
    });

    // Tutup menu jika klik di luar menu saat terbuka
    document.addEventListener('click', (e) => {
        if (
        mobileNav.classList.contains('show') &&
        !mobileNav.contains(e.target) &&
        !hamburger.contains(e.target)
        ) {
        mobileNav.classList.remove('show');
        }
    });
    });
