const modal = document.querySelector("#auth-modal");
const dialog = modal.querySelector(".modal-container");
const openButton = document.querySelector("#open-modal");
const registerButton = document.querySelector("#register-modal-button");
const closeButton = document.querySelector("#close-modal");
const loginView = document.querySelector("#login-view");
const registerView = document.querySelector("#register-view");
const showRegisterButton = document.querySelector("#show-register");
const showLoginButton = document.querySelector("#show-login");
let isNavigating = false;
let previousFocus = null;
let previousOverflow = "";
let userScrollDirection = 0;
let previousTouchY = null;

dialog.inert = true;
dialog.setAttribute("aria-hidden", "true");

function openModal() {
  if (modal.classList.contains("is-open")) return;

  previousFocus = document.activeElement;
  previousOverflow = document.body.style.overflow;
  modal.classList.add("is-open");
  dialog.inert = false;
  dialog.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  dialog.querySelector("input")?.focus();
}

function showAuthView(view) {
  if (!loginView || !registerView) {
    openModal();
    return;
  }

  const isRegister = view === "register";
  loginView.hidden = isRegister;
  registerView.hidden = !isRegister;
  dialog.setAttribute(
    "aria-labelledby",
    isRegister ? "register-title" : "form-title",
  );
  if (!modal.classList.contains("is-open")) openModal();
  (isRegister
    ? registerView.querySelector("input")
    : loginView.querySelector("input")
  )?.focus();
}

function closeModal() {
  if (!modal.classList.contains("is-open")) return;

  modal.classList.remove("is-open");
  dialog.inert = true;
  dialog.setAttribute("aria-hidden", "true");
  document.body.style.overflow = previousOverflow;
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (
    previousFocus instanceof HTMLElement &&
    previousFocus.isConnected &&
    previousFocus !== closeButton
  ) {
    previousFocus.focus();
  }
}

openButton.addEventListener("click", () => showAuthView("login"));
if (registerButton) {
  registerButton.addEventListener("click", (event) => {
    event.preventDefault();
    showAuthView("register");
  });
}
showRegisterButton?.addEventListener("click", () => showAuthView("register"));
showLoginButton?.addEventListener("click", () => showAuthView("login"));
closeButton.addEventListener("click", closeModal);

window.addEventListener("load", () => {
  if (modal && !modal.classList.contains("is-open")) {
    setTimeout(() => openModal(), 150);
  }
});

document.addEventListener("click", (event) => {
  const link =
    event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    link.target === "_blank"
  ) {
    return;
  }

  const destination = new URL(link.href, window.location.href);
  const authPages = ["/login.html", "/register.html"];
  if (
    destination.origin !== window.location.origin ||
    !authPages.includes(destination.pathname) ||
    destination.pathname === window.location.pathname
  ) {
    return;
  }

  event.preventDefault();
  if (isNavigating) return;
  isNavigating = true;
  showPageLoader();
  window.setTimeout(() => {
    window.location.assign(destination.href);
  }, 450);
});

modal.addEventListener("click", (event) => {
  if (event.target === modal && modal.classList.contains("is-open"))
    closeModal();
});

window.addEventListener(
  "wheel",
  (event) => {
    userScrollDirection = Math.sign(event.deltaY);
  },
  { passive: true },
);

window.addEventListener(
  "touchstart",
  (event) => {
    previousTouchY = event.touches[0]?.clientY ?? null;
  },
  { passive: true },
);

window.addEventListener(
  "touchmove",
  (event) => {
    const currentTouchY = event.touches[0]?.clientY;
    if (currentTouchY === undefined || previousTouchY === null) return;
    userScrollDirection = currentTouchY < previousTouchY ? 1 : -1;
    previousTouchY = currentTouchY;
  },
  { passive: true },
);

window.addEventListener(
  "touchend",
  () => {
    previousTouchY = null;
  },
  { passive: true },
);

function showPageLoader() {
  const overlay = document.createElement("div");
  overlay.className = "page-loader";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");

  const animation = document.createElement("span");
  animation.className = "loader";
  animation.setAttribute("aria-hidden", "true");
  overlay.append(animation);

  const label = document.createElement("span");
  label.className = "visually-hidden";
  label.textContent = "Loading page";
  overlay.append(label);
  document.body.append(overlay);
}

document.addEventListener("keydown", (event) => {
  if (["ArrowDown", "PageDown", " "].includes(event.key))
    userScrollDirection = 1;
  if (["ArrowUp", "PageUp"].includes(event.key)) userScrollDirection = -1;
});

window.addEventListener(
  "scroll",
  () => {
    const currentScrollY = window.scrollY;
    const scrollingDown = userScrollDirection > 0;
    userScrollDirection = 0;

    if (
      !modal.classList.contains("is-open") &&
      scrollingDown &&
      currentScrollY > window.innerHeight / 3
    ) {
      openModal();
    }
  },
  { passive: true },
);

document.addEventListener("keydown", (event) => {
  if (!modal.classList.contains("is-open")) return;

  if (event.key === "Escape") {
    closeModal();
    return;
  }

  if (event.key !== "Tab") return;
  const focusable = [
    ...dialog.querySelectorAll(
      "a[href], button:not(:disabled), input:not(:disabled)",
    ),
  ].filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
