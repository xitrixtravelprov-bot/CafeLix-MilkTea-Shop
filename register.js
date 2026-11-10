import { supabase } from "./supabase-client.js";

const elements = {
  form: document.querySelector("#register-form"),
  email: document.querySelector('#register-form [name="email"]'),
  employeeId: document.querySelector('#register-form [name="employeeId"]'),
  username: document.querySelector('#register-form [name="username"]'),
  role: document.querySelector('#register-form [name="role"]'),
  password: document.querySelector('#register-form [name="password"]'),
  confirmPassword: document.querySelector(
    '#register-form [name="confirmPassword"]',
  ),
  togglePassword: document.querySelector("#register-form .text-button"),
  registerButton: document.querySelector("#register-button"),
  registerLabel: document.querySelector("#register-label"),
  message: document.querySelector("#register-message"),
};

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();
  elements.email.value = elements.email.value.trim().toLowerCase();
  elements.employeeId.value = elements.employeeId.value.trim().toUpperCase();
  elements.username.value = elements.username.value.trim().toLowerCase();

  if (!["http:", "https:"].includes(window.location.protocol)) {
    showMessage(
      "Open this page through localhost (for example, VS Code Live Server) before registering. Email verification cannot return to a file:// page.",
    );
    return;
  }

  if (!/^EMP-\d{3}$/.test(elements.employeeId.value)) {
    showMessage("Employee ID must use the format EMP-001.");
    elements.employeeId.focus();
    return;
  }

  if (elements.password.value !== elements.confirmPassword.value) {
    showMessage("Passwords do not match.");
    elements.confirmPassword.focus();
    return;
  }

  setLoading(true);
  try {
    const selectedRole = elements.role.value;
    const { data: validationRows, error: validationError } = await supabase.rpc(
      "validate_registration",
      {
        p_employee_id: elements.employeeId.value,
        p_username: elements.username.value,
        p_role: selectedRole,
      },
    );
    if (validationError) throw validationError;
    if (validationRows?.[0]?.issue) throw new Error(validationRows[0].issue);

    const { data, error } = await supabase.auth.signUp({
      email: elements.email.value.trim(),
      password: elements.password.value,
      options: {
        data: profileFromForm(),
        emailRedirectTo: new URL(
          "index.html?email_confirmed=1",
          window.location.href,
        ).href,
      },
    });

    if (error) throw error;
    if (!data.user)
      throw new Error("Supabase did not return a user for this registration.");
    if (data.user.identities?.length === 0) {
      throw new Error(
        "This email may already be registered. Try signing in or use a different email.",
      );
    }

    if (!data.session) {
      showMessage(
        `${selectedRole === "admin" ? "Admin" : "Employee"} account created. Open the confirmation link in your email, then sign in.`,
        true,
      );
    } else {
      showMessage(
        `${selectedRole === "admin" ? "Admin" : "Employee"} account created. You can now sign in.`,
        true,
      );
    }
    elements.form.reset();
    elements.role.value = "employee";
  } catch (error) {
    showMessage(registrationErrorMessage(error));
  } finally {
    setLoading(false);
  }
});

elements.employeeId.addEventListener("input", () => {
  const start = elements.employeeId.selectionStart;
  const end = elements.employeeId.selectionEnd;
  elements.employeeId.value = elements.employeeId.value.toUpperCase();
  elements.employeeId.setSelectionRange(start, end);
});

elements.username.addEventListener("input", () => {
  const start = elements.username.selectionStart;
  const end = elements.username.selectionEnd;
  elements.username.value = elements.username.value.trimStart().toLowerCase();
  elements.username.setSelectionRange(start, end);
});

elements.togglePassword.addEventListener("click", () => {
  const showPassword = elements.password.type === "password";
  const inputType = showPassword ? "text" : "password";
  elements.password.type = inputType;
  elements.confirmPassword.type = inputType;
  elements.togglePassword.textContent = showPassword ? "Hide" : "Show";
  elements.togglePassword.setAttribute("aria-pressed", String(showPassword));
});

function profileFromForm() {
  return {
    employee_id: elements.employeeId.value.trim(),
    username: elements.username.value.trim().toLowerCase(),
    role: elements.role.value,
  };
}

function setLoading(isLoading) {
  elements.registerButton.disabled = isLoading;
  elements.registerLabel.textContent = isLoading
    ? "Creating account…"
    : "Create account";
}

function registrationErrorMessage(error) {
  if (!error || typeof error !== "object")
    return "Could not create your account.";

  const registrationError = error;
  const detail = [
    registrationError.code,
    registrationError.message,
    registrationError.details,
    registrationError.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    detail.includes("profiles_username_unique") ||
    (detail.includes("duplicate key") && detail.includes("username"))
  ) {
    return "That username is already taken. Please choose another one.";
  }
  if (
    detail.includes("profiles_employee_id_unique") ||
    (detail.includes("duplicate key") && detail.includes("employee_id"))
  ) {
    return "That Employee ID is already in use. Please enter a different one.";
  }
  if (
    detail.includes("email") &&
    (detail.includes("already") ||
      detail.includes("registered") ||
      detail.includes("duplicate"))
  ) {
    return "This email may already be registered. Try signing in or use a different email.";
  }
  if (detail.includes("database error saving new user")) {
    const databaseDetail = [registrationError.details, registrationError.hint]
      .filter((value) => typeof value === "string" && value.trim())
      .join(" ");
    return databaseDetail
      ? `Supabase could not save the account: ${databaseDetail}`
      : "Supabase could not save the account. Make sure the latest supabase-profiles.sql ran successfully in the Supabase SQL Editor; check Supabase Auth logs for the exact database trigger error.";
  }
  return registrationError instanceof Error
    ? registrationError.message
    : "Could not create your account.";
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
}
