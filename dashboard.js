import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://cqkeduifsqcjlqthlvbp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dpRn1H_a7HDLsDDehcyp3g_OQ9mfzCe";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const requiredRole = document.body.dataset.requiredRole;
const elements = {
  status: document.querySelector("#access-status"),
  email: document.querySelector("#account-email"),
  username: document.querySelector("#account-username"),
  signOut: document.querySelector("#sign-out-button"),
  cartPanel: document.querySelector("#cart-panel"),
  cartCount: document.querySelector("#cart-count"),
  cartStatus: document.querySelector("#cart-status"),
  cartItems: document.querySelector("#cart-items"),
  cartTotal: document.querySelector("#cart-total"),
  paymentMethod: document.querySelector("#payment-method"),
  orderType: document.querySelector("#order-type"),
  cashPaymentFields: document.querySelector("#cash-payment-fields"),
  cashReceived: document.querySelector("#cash-received"),
  changeDue: document.querySelector("#change-due"),
  gcashPaymentFields: document.querySelector("#gcash-payment-fields"),
  gcashReferenceNumber: document.querySelector("#gcash-reference-number"),
  checkoutButton: document.querySelector("#checkout-button"),
  salesPanel: document.querySelector("#sales-panel"),
  salesHistoryStatus: document.querySelector("#sales-history-status"),
  salesHistoryList: document.querySelector("#sales-history-list"),
  refreshSales: document.querySelector("#refresh-sales-button"),
  employeeManagement: document.querySelector("#employee-management"),
  employeeList: document.querySelector("#employee-list"),
  employeeListStatus: document.querySelector("#employee-list-status"),
  refreshUsers: document.querySelector("#refresh-users-button"),
  productManagement: document.querySelector("#product-management"),
  productForm: document.querySelector("#product-form"),
  productName: document.querySelector("#product-name"),
  productSize: document.querySelector("#product-size"),
  productPrice: document.querySelector("#product-price"),
  productImage: document.querySelector("#product-image"),
  saveProductButton: document.querySelector("#save-product-button"),
  productFormStatus: document.querySelector("#product-form-status"),
  productCatalog: document.querySelector("#product-catalog"),
  productCatalogStatus: document.querySelector("#product-catalog-status"),
  productList: document.querySelector("#product-list"),
  refreshProducts: document.querySelector("#refresh-products-button"),
};
let currentUserId = null;
const cart = new Map();
let checkoutInProgress = false;
const pageForRole = {
  admin: "admin-panel.html",
  employee: "employee-dashboard.html",
};

elements.signOut.addEventListener("click", async () => {
  elements.signOut.disabled = true;
  const { error } = await supabase.auth.signOut();
  if (error) {
    elements.status.textContent = error.message;
    elements.status.classList.add("error");
    elements.signOut.disabled = false;
    return;
  }
  window.location.replace("login.html");
});

elements.refreshUsers?.addEventListener("click", loadEmployees);
elements.refreshSales?.addEventListener("click", () =>
  loadSalesHistory(currentUserId),
);
elements.checkoutButton?.addEventListener("click", completeOrder);
elements.paymentMethod?.addEventListener("change", updatePaymentFields);
elements.cashReceived?.addEventListener("input", updateChangeDue);
elements.productForm?.addEventListener("submit", createProduct);
elements.refreshProducts?.addEventListener("click", loadProducts);

try {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    window.location.replace("login.html");
  } else {
    const user = sessionData.session.user;
    currentUserId = user.id;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, approval_status, username")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || !pageForRole[profile.role]) {
      throw new Error("Your account does not have a valid dashboard role.");
    }

    if (profile.role !== requiredRole) {
      window.location.replace(pageForRole[profile.role]);
    } else if (
      requiredRole === "employee" &&
      profile.approval_status !== "approved"
    ) {
      const statusMessage =
        {
          pending: "Your account is waiting for Admin approval.",
          declined:
            "Your account registration was declined. Contact the Admin.",
          removed: "Your account access has been removed. Contact the Admin.",
        }[profile.approval_status] ?? "Your employee account is not approved.";
      elements.email.textContent = user.email ?? "";
      if (elements.username) {
        elements.username.textContent = profile.username
          ? `Username: ${profile.username}`
          : "Username not set";
      }
      elements.status.textContent = statusMessage;
      elements.status.classList.add("error");
      elements.signOut.hidden = false;
    } else {
      elements.email.textContent = user.email ?? "";
      if (elements.username) {
        elements.username.textContent = profile.username
          ? `Username: ${profile.username}`
          : "Username not set";
      }
      elements.status.textContent = "";
      elements.signOut.hidden = false;
      if (requiredRole === "employee") {
        elements.productCatalog.hidden = false;
        elements.cartPanel.hidden = false;
        renderCart();
        await loadProducts();
        elements.salesPanel.hidden = false;
        await loadSalesHistory(user.id);
      } else if (requiredRole === "admin") {
        elements.productManagement.hidden = false;
        elements.employeeManagement.hidden = false;
        await loadEmployees();
      }
    }
  }
} catch (error) {
  elements.status.textContent =
    error instanceof Error
      ? error.message
      : "Could not verify dashboard access.";
  elements.status.classList.add("error");
}

async function createProduct(event) {
  event.preventDefault();
  elements.productFormStatus.classList.remove("error");
  elements.productFormStatus.textContent = "";

  const productName = elements.productName.value.trim();
  const productSize = elements.productSize.value.trim();
  const productPrice = Number(elements.productPrice.value);
  const image = elements.productImage.files?.[0];
  if (
    !productName ||
    !productSize ||
    !Number.isFinite(productPrice) ||
    productPrice <= 0 ||
    !image
  ) {
    elements.productFormStatus.textContent =
      "Enter a product name, size, price greater than zero, and choose an image.";
    elements.productFormStatus.classList.add("error");
    return;
  }
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(image.type)
  ) {
    elements.productFormStatus.textContent =
      "Choose a JPG, PNG, WEBP, or GIF image.";
    elements.productFormStatus.classList.add("error");
    return;
  }
  if (image.size > 5 * 1024 * 1024) {
    elements.productFormStatus.textContent =
      "The image must be 5 MB or smaller.";
    elements.productFormStatus.classList.add("error");
    return;
  }

  elements.saveProductButton.disabled = true;
  elements.productFormStatus.textContent = "Uploading product image…";
  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const extension = extensionByType[image.type];
  const imagePath = `${currentUserId}/${crypto.randomUUID()}.${extension}`;
  let uploaded = false;

  try {
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(imagePath, image, { contentType: image.type, upsert: false });
    if (uploadError) throw uploadError;
    uploaded = true;

    const { data: imageData } = supabase.storage
      .from("product-images")
      .getPublicUrl(imagePath);
    const { error: insertError } = await supabase.from("products").insert({
      product_name: productName,
      size: productSize,
      price: productPrice,
      image_path: imagePath,
      image_url: imageData.publicUrl,
      created_by: currentUserId,
    });
    if (insertError) throw insertError;

    elements.productForm.reset();
    elements.productFormStatus.textContent = "Product saved.";
  } catch (error) {
    if (uploaded) {
      const { error: cleanupError } = await supabase.storage
        .from("product-images")
        .remove([imagePath]);
      if (cleanupError) {
        console.error(
          "Could not remove the uploaded image after product creation failed.",
          cleanupError,
        );
      }
    }
    elements.productFormStatus.textContent =
      error instanceof Error ? error.message : "Could not save this product.";
    elements.productFormStatus.classList.add("error");
  } finally {
    elements.saveProductButton.disabled = false;
  }
}

async function loadProducts() {
  elements.productCatalogStatus.classList.remove("error");
  elements.productCatalogStatus.textContent = "Loading products…";
  elements.productList.replaceChildren();
  elements.refreshProducts.disabled = true;

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, product_name, size, price, image_url, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      elements.productCatalogStatus.textContent =
        "No products have been added yet.";
      return;
    }

    elements.productCatalogStatus.textContent = "";
    for (const product of data) {
      const card = document.createElement("article");
      card.className = "product-card";
      const image = document.createElement("img");
      image.src = product.image_url;
      image.alt = product.product_name;
      image.loading = "lazy";
      const details = document.createElement("div");
      details.className = "product-card-details";
      const name = document.createElement("h3");
      name.textContent = product.product_name;
      const size = document.createElement("p");
      size.textContent = `Size: ${product.size}`;
      const price = document.createElement("p");
      price.textContent =
        product.price == null
          ? "Price not set. Ask the Admin to add this product with a price."
          : formatCurrency(product.price);
      details.append(name, size, price);
      card.append(image, details);

      if (product.price != null && Number(product.price) > 0) {
        const cartForm = document.createElement("form");
        cartForm.className = "product-cart-form";
        cartForm.addEventListener("submit", (event) =>
          addToCart(event, product),
        );

        const quantityLabel = document.createElement("label");
        quantityLabel.className = "input-block";
        const quantityCaption = document.createElement("span");
        quantityCaption.className = "input-label";
        quantityCaption.textContent = "Quantity";
        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.name = "quantity";
        quantityInput.min = "1";
        quantityInput.step = "1";
        quantityInput.value = "1";
        quantityInput.required = true;
        quantityInput.disabled = checkoutInProgress;
        quantityLabel.append(quantityCaption, quantityInput);

        const addButton = document.createElement("button");
        addButton.className = "input-button";
        addButton.type = "submit";
        addButton.textContent = "Add to Cart";
        addButton.disabled = checkoutInProgress;
        cartForm.append(quantityLabel, addButton);

        const addStatus = document.createElement("p");
        addStatus.className = "product-cart-status";
        addStatus.setAttribute("role", "status");
        addStatus.setAttribute("aria-live", "polite");
        card.append(cartForm, addStatus);
      }

      elements.productList.append(card);
    }
  } catch (error) {
    elements.productCatalogStatus.textContent =
      error instanceof Error ? error.message : "Could not load products.";
    elements.productCatalogStatus.classList.add("error");
  } finally {
    elements.refreshProducts.disabled = checkoutInProgress;
  }
}

async function loadSalesHistory(userId) {
  if (!userId) return;
  elements.salesHistoryStatus.classList.remove("error");
  elements.salesHistoryStatus.textContent = "Loading sales history…";
  elements.salesHistoryList.replaceChildren();

  const { data, error } = await supabase
    .from("sales")
    .select(
      "product_name, quantity, unit_price, total, payment_method, order_type, cash_received, change_due, gcash_reference_number, sold_at",
    )
    .eq("employee_id", userId)
    .order("sold_at", { ascending: false });

  if (error) {
    elements.salesHistoryStatus.textContent = error.message;
    elements.salesHistoryStatus.classList.add("error");
    return;
  }

  if (!data?.length) {
    elements.salesHistoryStatus.textContent = "No sales recorded yet.";
    return;
  }

  elements.salesHistoryStatus.textContent = `${data.length} sale${data.length === 1 ? "" : "s"} recorded.`;
  for (const entry of data) {
    const row = document.createElement("tr");
    appendCell(
      row,
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(entry.sold_at)),
    );
    appendCell(row, entry.product_name);
    appendCell(row, String(entry.quantity));
    appendCell(row, formatCurrency(entry.unit_price));
    appendCell(row, formatCurrency(entry.total));
    appendCell(row, entry.payment_method);
    appendCell(row, entry.order_type);
    appendCell(
      row,
      entry.cash_received == null ? "—" : formatCurrency(entry.cash_received),
    );
    appendCell(
      row,
      entry.change_due == null ? "—" : formatCurrency(entry.change_due),
    );
    appendCell(row, entry.gcash_reference_number ?? "—");
    elements.salesHistoryList.append(row);
  }
}

function addToCart(event, product) {
  event.preventDefault();
  const form = event.currentTarget;
  const quantityInput = form.querySelector('input[name="quantity"]');
  const addStatus = form.nextElementSibling;
  const quantity = Number(quantityInput.value);

  addStatus.classList.remove("error");
  addStatus.textContent = "";
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    addStatus.textContent = "Enter a whole-number quantity greater than zero.";
    addStatus.classList.add("error");
    return;
  }

  const existing = cart.get(product.id);
  cart.set(product.id, {
    product,
    quantity: quantity + (existing?.quantity ?? 0),
  });
  quantityInput.value = "1";
  addStatus.textContent = "Added to cart.";
  renderCart();
}

function renderCart() {
  elements.cartItems.replaceChildren();
  let itemCount = 0;
  let total = 0;

  for (const [productId, item] of cart) {
    itemCount += item.quantity;
    total += Number(item.product.price) * item.quantity;

    const row = document.createElement("article");
    row.className = "cart-item";
    const details = document.createElement("div");
    details.className = "cart-item-details";
    const name = document.createElement("h3");
    name.textContent = item.product.product_name;
    const description = document.createElement("p");
    description.textContent = `Size: ${item.product.size} · ${formatCurrency(item.product.price)} each`;
    details.append(name, description);

    const quantityLabel = document.createElement("label");
    quantityLabel.className = "cart-quantity";
    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "1";
    quantityInput.step = "1";
    quantityInput.value = String(item.quantity);
    quantityInput.disabled = checkoutInProgress;
    quantityInput.setAttribute(
      "aria-label",
      `Quantity for ${item.product.product_name}`,
    );
    quantityInput.addEventListener("change", () => {
      const nextQuantity = Number(quantityInput.value);
      if (!Number.isSafeInteger(nextQuantity) || nextQuantity < 1) {
        quantityInput.value = String(item.quantity);
        elements.cartStatus.textContent =
          "Cart quantities must be whole numbers greater than zero.";
        elements.cartStatus.classList.add("error");
        return;
      }
      item.quantity = nextQuantity;
      renderCart();
    });
    quantityLabel.append(quantityInput);

    const removeButton = document.createElement("button");
    removeButton.className = "cart-remove-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.disabled = checkoutInProgress;
    removeButton.addEventListener("click", () => {
      cart.delete(productId);
      renderCart();
    });
    row.append(details, quantityLabel, removeButton);
    elements.cartItems.append(row);
  }

  elements.cartCount.textContent = String(itemCount);
  elements.cartTotal.textContent = formatCurrency(total);
  elements.checkoutButton.disabled = cart.size === 0 || checkoutInProgress;
  updateChangeDue();
  if (cart.size === 0) {
    elements.cartStatus.classList.remove("error");
    elements.cartStatus.textContent = "Your cart is empty.";
  } else {
    elements.cartStatus.classList.remove("error");
    elements.cartStatus.textContent = `${itemCount} item${itemCount === 1 ? "" : "s"} in your cart.`;
  }
}

async function completeOrder() {
  if (cart.size === 0) return;

  const paymentMethod = elements.paymentMethod.value;
  const orderType = elements.orderType.value;
  const gcashReferenceNumber = elements.gcashReferenceNumber.value.trim();
  const totalCents = getCartTotalCents();
  const receivedAmount =
    elements.cashReceived.value === ""
      ? null
      : Number(elements.cashReceived.value);
  const receivedCents =
    elements.cashReceived.value === ""
      ? null
      : Math.round(receivedAmount * 100);
  if (!["Cash", "GCash"].includes(paymentMethod)) {
    elements.cartStatus.textContent =
      "Select Cash or GCash as the payment method.";
    elements.cartStatus.classList.add("error");
    elements.paymentMethod.focus();
    return;
  }
  if (
    paymentMethod === "Cash" &&
    (receivedAmount === null ||
      !Number.isFinite(receivedAmount) ||
      !Number.isSafeInteger(receivedCents) ||
      Math.abs(receivedAmount * 100 - receivedCents) > 1e-7 ||
      receivedCents < totalCents)
  ) {
    elements.cartStatus.textContent =
      "Enter the amount received. It must be at least the order total.";
    elements.cartStatus.classList.add("error");
    elements.cashReceived.focus();
    return;
  }
  if (paymentMethod === "GCash" && !gcashReferenceNumber) {
    elements.cartStatus.textContent = "Enter the GCash reference number.";
    elements.cartStatus.classList.add("error");
    elements.gcashReferenceNumber.focus();
    return;
  }
  if (!["Dine-in", "Takeout"].includes(orderType)) {
    elements.cartStatus.textContent =
      "Select Dine-in or Takeout as the order type.";
    elements.cartStatus.classList.add("error");
    elements.orderType.focus();
    return;
  }

  elements.checkoutButton.disabled = true;
  elements.checkoutButton.textContent = "Completing…";
  checkoutInProgress = true;
  setCartControlsDisabled(true);
  elements.paymentMethod.disabled = true;
  elements.orderType.disabled = true;
  elements.refreshProducts.disabled = true;
  elements.cartStatus.classList.remove("error");
  elements.cartStatus.textContent = "Saving your order…";
  try {
    const saleRows = Array.from(cart.values(), ({ product, quantity }) => ({
      employee_id: currentUserId,
      product_id: product.id,
      quantity,
      payment_method: paymentMethod,
      order_type: orderType,
      cash_received: paymentMethod === "Cash" ? receivedCents / 100 : null,
      change_due:
        paymentMethod === "Cash" ? (receivedCents - totalCents) / 100 : null,
      gcash_reference_number:
        paymentMethod === "GCash" ? gcashReferenceNumber : null,
    }));
    const { error } = await supabase.from("sales").insert(saleRows);
    if (error) throw error;

    cart.clear();
    elements.paymentMethod.value = "";
    elements.orderType.value = "";
    elements.cashReceived.value = "";
    elements.gcashReferenceNumber.value = "";
    updatePaymentFields();
    renderCart();
    elements.cartStatus.textContent =
      "Order complete. Sales History has been updated.";
    await loadSalesHistory(currentUserId);
  } catch (error) {
    elements.cartStatus.textContent =
      error instanceof Error
        ? error.message
        : "Could not complete the order. Your cart has been kept.";
    elements.cartStatus.classList.add("error");
  } finally {
    checkoutInProgress = false;
    setCartControlsDisabled(false);
    elements.paymentMethod.disabled = false;
    elements.orderType.disabled = false;
    elements.cashReceived.disabled = false;
    elements.gcashReferenceNumber.disabled = false;
    elements.refreshProducts.disabled = false;
    elements.checkoutButton.textContent = "Complete order";
    elements.checkoutButton.disabled = cart.size === 0;
  }
}

function setCartControlsDisabled(disabled) {
  for (const control of elements.productList.querySelectorAll(
    ".product-cart-form input, .product-cart-form button",
  )) {
    control.disabled = disabled;
  }
  elements.cashReceived.disabled = disabled;
  elements.gcashReferenceNumber.disabled = disabled;
}

function getCartTotalCents() {
  let totalCents = 0;
  for (const { product, quantity } of cart.values()) {
    totalCents += Math.round(Number(product.price) * 100) * quantity;
  }
  return totalCents;
}

function updatePaymentFields() {
  const isCash = elements.paymentMethod.value === "Cash";
  const isGCash = elements.paymentMethod.value === "GCash";
  elements.cashPaymentFields.hidden = !isCash;
  elements.cashReceived.required = isCash;
  if (!isCash) elements.cashReceived.value = "";
  elements.gcashPaymentFields.hidden = !isGCash;
  elements.gcashReferenceNumber.required = isGCash;
  if (!isGCash) elements.gcashReferenceNumber.value = "";
  updateChangeDue();
}

function updateChangeDue() {
  const amountCents =
    elements.cashReceived.value === ""
      ? null
      : Math.round(Number(elements.cashReceived.value) * 100);
  const changeCents =
    amountCents === null ? 0 : amountCents - getCartTotalCents();
  elements.changeDue.textContent = formatCurrency(
    Math.max(changeCents, 0) / 100,
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value));
}

async function loadEmployees() {
  elements.employeeListStatus.classList.remove("error");
  elements.employeeListStatus.textContent = "Loading employee accounts…";
  elements.employeeList.replaceChildren();
  elements.refreshUsers.disabled = true;

  try {
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) throw error;

    const employees = (data ?? []).filter((user) => user.role === "employee");
    if (employees.length === 0) {
      elements.employeeListStatus.textContent = "No employee accounts found.";
      return;
    }

    for (const employee of employees) {
      elements.employeeList.append(createEmployeeRow(employee));
    }
    elements.employeeListStatus.textContent = `${employees.length} employee account${employees.length === 1 ? "" : "s"}.`;
  } catch (error) {
    elements.employeeListStatus.textContent =
      error instanceof Error
        ? error.message
        : "Could not load employee accounts.";
    elements.employeeListStatus.classList.add("error");
  } finally {
    elements.refreshUsers.disabled = false;
  }
}

function createEmployeeRow(employee) {
  const row = document.createElement("tr");
  appendCell(row, employee.email || "—");
  appendCell(row, employee.employee_id || "—");
  appendCell(row, employee.username || "—");

  const statusCell = document.createElement("td");
  const statusBadge = document.createElement("span");
  statusBadge.className = `status-badge status-${employee.approval_status}`;
  statusBadge.textContent = employee.approval_status;
  statusCell.append(statusBadge);
  row.append(statusCell);

  const actionCell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "user-actions";
  if (employee.approval_status !== "approved") {
    actions.append(createActionButton("Approve", "approved", employee.id));
  }
  if (employee.approval_status !== "declined") {
    actions.append(createActionButton("Decline", "declined", employee.id));
  }
  if (employee.approval_status !== "removed") {
    actions.append(createActionButton("Remove", "removed", employee.id, true));
  }
  actionCell.append(actions);
  row.append(actionCell);
  return row;
}

function appendCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
}

function createActionButton(label, status, userId, isDestructive = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = isDestructive
    ? "user-action-button destructive"
    : "user-action-button";
  button.textContent = label;
  button.addEventListener("click", () =>
    updateEmployeeStatus(userId, status, button),
  );
  return button;
}

async function updateEmployeeStatus(userId, status, button) {
  if (
    status === "removed" &&
    !window.confirm(
      "Remove this employee's access? This will not permanently delete their Auth account.",
    )
  ) {
    return;
  }

  button.disabled = true;
  elements.employeeListStatus.classList.remove("error");
  elements.employeeListStatus.textContent = "Updating account…";
  try {
    const { error } = await supabase.rpc("admin_set_employee_status", {
      p_user_id: userId,
      p_status: status,
    });
    if (error) throw error;
    await loadEmployees();
  } catch (error) {
    elements.employeeListStatus.textContent =
      error instanceof Error
        ? error.message
        : "Could not update the employee account.";
    elements.employeeListStatus.classList.add("error");
    button.disabled = false;
  }
}
