 //This file contains the animation/behavior of navigation 
 
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