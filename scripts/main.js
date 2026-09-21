 /* =========================================================
   NAVIGATION 
========================================================= */
 
 const header = document.querySelector(".site-header");
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");

  /* Add a class when the page is scrolled */
  window.addEventListener("scroll", () => {
    if (window.scrollY > 30) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });

  /* Open and close the mobile navigation */
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("active");

    menuToggle.classList.toggle("active", isOpen);

    menuToggle.setAttribute("aria-expanded", isOpen);
    menuToggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu"
    );
  });

  /* Close the mobile menu after clicking a navigation link */
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      menuToggle.classList.remove("active");

      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open navigation menu");
    });
  });

  /* Center the About section */
  const heroAboutLink = document.querySelector('.hero a[href="#about"]');
  const aboutSection = document.getElementById("about");

  if (heroAboutLink && aboutSection) {
    heroAboutLink.addEventListener("click", (event) => {
      event.preventDefault();
      aboutSection.scrollIntoView({ behavior: "smooth", block: "center" });
      history.replaceState(null, "", "#about");
    });
  }


/* =========================================================
   AUTO-HIDE NAVIGATION ON DESKTOP
========================================================= */

let hideNavTimeout;
const isMobile = () => window.innerWidth <= 650;

// Hide the navbar after a short period of inactivity
function hideNavigation() {
  if (!isMobile() && !header.matches(":hover")) {
    header.classList.add("nav-hidden");
  }
}

// Show the navbar
function showNavigation() {
  header.classList.remove("nav-hidden");

  // Reset the hiding timer
  clearTimeout(hideNavTimeout);

  // Hide after 3 seconds if the mouse is not over the navbar
  if (!isMobile()) {
    hideNavTimeout = setTimeout(hideNavigation, 3000);
  }
}

/* Detect mouse movement */
document.addEventListener("mousemove", (event) => {
  if (isMobile()) return;

  // Reveal the navbar when the mouse reaches the top 80px
  if (event.clientY <= 80) {
    showNavigation();
  }
});

/* Keep navbar visible while hovering over it */
header.addEventListener("mouseenter", () => {
  if (!isMobile()) {
    clearTimeout(hideNavTimeout);
    header.classList.remove("nav-hidden");
  }
});

/* Start hiding when the mouse leaves the navbar */
header.addEventListener("mouseleave", () => {
  if (!isMobile()) {
    hideNavTimeout = setTimeout(hideNavigation, 1500);
  }
});

/* Initially hide after 3 seconds */
if (!isMobile()) {
  hideNavTimeout = setTimeout(hideNavigation, 3000);
}

/* =========================================================
   COUNTDOWN TIMER FOR ADF EVENT
========================================================= */
const countdown = document.getElementById("countdown");

if (countdown) {
  const eventStart = new Date(2027, 1, 23, 0, 0, 0).getTime(); //year month day hour minute second
  const days = document.getElementById("days");
  const hours = document.getElementById("hours");
  const mins = document.getElementById("minutes");
  const seconds = document.getElementById("seconds");
  const countdownLabel = countdown.previousElementSibling;
  let countdownInt;

  function updateCountdown() {
    const remaining = eventStart - Date.now();

    if (remaining <= 0) {
      days.textContent = "00";
      hours.textContent = "00";
      mins.textContent = "00";
      seconds.textContent = "00";

      if (countdownLabel) {
        countdownLabel.textContent = "EVENT IS UNDERWAY";
      }

      clearInterval(countdownInt);
      return;
    }

    days.textContent = String(Math.floor(remaining / (1000 * 60 * 60 * 24))).padStart(2, "0");
    hours.textContent = String(Math.floor((remaining / (1000 * 60 * 60)) % 24)).padStart(2, "0");
    mins.textContent = String(Math.floor((remaining / (1000 * 60)) % 60)).padStart(2, "0");
    seconds.textContent = String(Math.floor((remaining / 1000) % 60)).padStart(2, "0");
  }

  updateCountdown();
  countdownInt = setInterval(updateCountdown, 1000);
}

/* Close promotional lightboxes without moving the page */
document.querySelectorAll(".gallery-lightbox-close").forEach((closeLink) => {
  closeLink.addEventListener("click", (event) => {
    event.preventDefault();
    closeLink.closest(".gallery-lightbox").classList.add("is-closed");
    history.replaceState(null, "", window.location.pathname + window.location.search);
  });
});

document.querySelectorAll(".promotion-gallery-card").forEach((galleryLink) => {
  galleryLink.addEventListener("click", () => {
    const lightbox = document.querySelector(galleryLink.hash);

    if (lightbox) {
      lightbox.classList.remove("is-closed");
    }
  });
});

/* =========================================================
   REGISTRATION FORM SUBMISSION
========================================================= */

const registrationForm = document.getElementById("registrationForm");

if (registrationForm) {
  const studentNumberInput = document.getElementById("student-number");

  if (studentNumberInput) {
    studentNumberInput.addEventListener("input", () => {
      studentNumberInput.value = studentNumberInput.value.replace(/\D/g, "").slice(0, 8);
    });
  }

  const statusEl = document.getElementById("registrationStatus");
  const submitBtn = document.getElementById("registrationSubmit");

  const showStatus = (message, type) => {
    statusEl.textContent = message;
    statusEl.classList.remove("success", "error");
    statusEl.classList.add("visible", type);
  };

  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";

    try {
      const response = await fetch(registrationForm.action, {
        method: "POST",
        body: new FormData(registrationForm),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showStatus(data.error || "Something went wrong. Please try again.", "error");
        return;
      }

      showStatus(data.message || "You're registered!", "success");
      registrationForm.reset();
    } catch (err) {
      showStatus("Could not reach the server. Please check your connection and try again.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Register";
    }
  });
}

/* =========================================================
   CONTACT FORM SUBMISSION
========================================================= */

const contactForm = document.getElementById("contactForm");

if (contactForm) {
  const successEl = document.getElementById("contactSuccess");
  const errorEl = document.getElementById("contactError");
  const submitBtn = document.getElementById("contactSubmit");

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    successEl.classList.remove("visible");
    errorEl.classList.remove("visible");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        errorEl.textContent = data.error || "Something went wrong. Please try again.";
        errorEl.classList.add("visible");
        return;
      }

      successEl.textContent = data.message || "Message sent!";
      successEl.classList.add("visible");
      contactForm.reset();
    } catch (err) {
      errorEl.textContent = "Could not reach the server. Please check your connection and try again.";
      errorEl.classList.add("visible");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send message";
    }
  });
}

/* =========================================================
   SERVICES PAGE: FAQ SECTION
========================================================= */

const faqItems = document.querySelectorAll(".adf-faq-item");

faqItems.forEach((item) => {

  const question = item.querySelector(".adf-faq-question");

  question.addEventListener("click", () => {

    item.classList.toggle("active");

  });

});