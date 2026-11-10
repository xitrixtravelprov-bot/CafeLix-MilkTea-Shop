import { supabase } from "./supabase-client.js";

const elements = {
  form: document.querySelector("#auth-form"),
  email: document.querySelector("#email"),
  password: document.querySelector("#password"),
  forgotPasswordLink: document.querySelector("#forgot-password-link"),
  togglePassword: document.querySelector("#toggle-password"),
  loginButton: document.querySelector("#login-button"),
  loginLabel: document.querySelector("#login-label"),
  message: document.querySelector("#auth-message"),
  resendVerificationButton: document.querySelector(
    "#resend-verification-button",
  ),
  accountPanel: document.querySelector("#account-panel"),
  accountEmail: document.querySelector("#account-email"),
  signOutButton: document.querySelector("#sign-out-button"),
};

const currentUrl = new URL(window.location.href);
const emailConfirmationPending =
  currentUrl.searchParams.get("email_confirmed") === "1";
const callbackParams = new URLSearchParams(currentUrl.hash.slice(1));
const callbackError =
  currentUrl.searchParams.get("error_description") ??
  callbackParams.get("error_description");

if (callbackError) {
  showMessage(`Email verification failed: ${callbackError}`);
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  setLoginLoading(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: elements.email.value.trim(),
      password: elements.password.value,
    });

    if (error) throw error;
    await redirectToDashboard(data.user);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sign in.";
    elements.resendVerificationButton.hidden = !isEmailNotConfirmed(error);
    showMessage(message);
  } finally {
    setLoginLoading(false);
  }
});

elements.resendVerificationButton.addEventListener("click", async () => {
  const email = elements.email.value.trim();
  if (!email) {
    showMessage("Enter your email address first.");
    elements.email.focus();
    return;
  }
  if (!["http:", "https:"].includes(window.location.protocol)) {
    showMessage(
      "Open this page through localhost (for example, VS Code Live Server) before requesting verification.",
    );
    return;
  }

  elements.resendVerificationButton.disabled = true;
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: new URL(
          "index.html?email_confirmed=1",
          window.location.href,
        ).href,
      },
    });

    if (error) throw error;
    showMessage(
      "A new verification email was sent. Check your inbox and spam folder.",
      true,
    );
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : "Could not resend the verification email.",
    );
  } finally {
    elements.resendVerificationButton.disabled = false;
  }
});

elements.forgotPasswordLink.addEventListener("click", async (event) => {
  event.preventDefault();
  const email = elements.email.value.trim();

  if (!email) {
    showMessage("Enter your email address first so we can send a reset link.");
    elements.email.focus();
    return;
  }

  if (!["http:", "https:"].includes(window.location.protocol)) {
    showMessage(
      "Open this page through localhost (for example, VS Code Live Server) before requesting a password reset.",
    );
    return;
  }

  elements.forgotPasswordLink.classList.add("is-loading");
  elements.forgotPasswordLink.textContent = "Sending…";

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("index.html", window.location.href).href,
    });

    if (error) throw error;
    showMessage(
      "A password reset email has been sent. Check your inbox for instructions.",
      true,
    );
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : "Could not send the password reset email.",
    );
  } finally {
    elements.forgotPasswordLink.classList.remove("is-loading");
    elements.forgotPasswordLink.textContent = "Forgot password?";
  }
});

elements.togglePassword.addEventListener("click", () => {
  const showPassword = elements.password.type === "password";
  elements.password.type = showPassword ? "text" : "password";
  elements.togglePassword.textContent = showPassword ? "Hide" : "Show";
  elements.togglePassword.setAttribute("aria-pressed", String(showPassword));
});

elements.signOutButton.addEventListener("click", async () => {
  elements.signOutButton.disabled = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    updateAccount(null);
    showMessage("You’ve signed out.", true);
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : "Could not sign out. Please try again.",
    );
  } finally {
    elements.signOutButton.disabled = false;
  }
});

const { data, error } = await supabase.auth.getSession();
if (error) {
  showMessage(error.message);
} else if (emailConfirmationPending && data.session?.user) {
  window.history.replaceState({}, "", window.location.pathname);
  showMessage("Email verified. Opening your dashboard…", true);
  try {
    await redirectToDashboard(data.session.user);
  } catch (redirectError) {
    updateAccount(data.session.user);
    showMessage(
      redirectError instanceof Error
        ? `Email verified, but dashboard access could not be checked: ${redirectError.message}`
        : "Email verified, but dashboard access could not be checked.",
    );
  }
} else {
  updateAccount(data.session?.user ?? null);
}

supabase.auth.onAuthStateChange((_event, session) => {
  updateAccount(session?.user ?? null);
});

function updateAccount(user) {
  elements.accountPanel.hidden = !user;
  elements.accountEmail.textContent = user ? `Signed in as ${user.email}` : "";
  elements.form.hidden = Boolean(user);
  document.querySelector(".mode-prompt").hidden = Boolean(user);
  if (user) elements.resendVerificationButton.hidden = true;
}

async function redirectToDashboard(user) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!profile || !["admin", "employee"].includes(profile.role)) {
    throw new Error("Your account does not have a valid dashboard role.");
  }

  if (profile.role === "employee" && profile.approval_status !== "approved") {
    const message =
      {
        pending: "Your account is waiting for Admin approval.",
        declined: "Your account registration was declined. Contact the Admin.",
        removed: "Your account access has been removed. Contact the Admin.",
      }[profile.approval_status] ?? "Your employee account is not approved.";
    throw new Error(message);
  }

  window.location.assign(
    profile.role === "admin" ? "admin-panel.html" : "employee-dashboard.html",
  );
}

function setLoginLoading(isLoading) {
  elements.loginButton.disabled = isLoading;
  elements.loginLabel.textContent = isLoading ? "Signing in…" : "Sign in";
}

function showMessage(text, isSuccess = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("success", isSuccess);
  elements.message.hidden = false;
}

function clearMessage() {
  elements.message.textContent = "";
  elements.message.classList.remove("success");
  elements.message.hidden = true;
  elements.resendVerificationButton.hidden = true;
}

function isEmailNotConfirmed(error) {
  if (!error || typeof error !== "object") return false;
  const authError = error;
  return (
    authError.code === "email_not_confirmed" ||
    (typeof authError.message === "string" &&
      authError.message.toLowerCase().includes("email not confirmed"))
  );
}
