import {
  ensureLoginTimedate,
  recordLogoutTimedate,
  supabase,
} from "./supabase-client.js";
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
  adminSalesPeriod: document.querySelector("#admin-sales-period"),
  adminSalesRevenue: document.querySelector("#admin-sales-revenue"),
  adminSalesCount: document.querySelector("#admin-sales-count"),
  adminSalesUnits: document.querySelector("#admin-sales-units"),
  refreshAdminSales: document.querySelector("#refresh-admin-sales-button"),
  loginLogoutLogsList: document.querySelector("#login-logout-logs-list"),
  loginLogoutLogsStatus: document.querySelector("#login-logout-logs-status"),
  refreshLoginLogoutLogs: document.querySelector(
    "#refresh-login-logout-logs-button",
  ),
  employeeManagement: document.querySelector("#employee-management"),
  employeeList: document.querySelector("#employee-list"),
  employeeListStatus: document.querySelector("#employee-list-status"),
  refreshUsers: document.querySelector("#refresh-users-button"),
  productManagement: document.querySelector("#product-management"),
  productForm: document.querySelector("#product-form"),
  productName: document.querySelector("#product-name"),
  productCategory: document.querySelector("#product-category"),
  productQuantity: document.querySelector("#product-quantity"),
  productImage: document.querySelector("#product-image"),
  productVariantsList: document.querySelector("#product-variants-list"),
  categorySizeHelp: document.querySelector("#category-size-help"),
  addProductSize: document.querySelector("#add-product-size-button"),
  saveProductButton: document.querySelector("#save-product-button"),
  productFormStatus: document.querySelector("#product-form-status"),
  productCatalog: document.querySelector("#product-catalog"),
  productCatalogStatus: document.querySelector("#product-catalog-status"),
  productList: document.querySelector("#product-list"),
  refreshProducts: document.querySelector("#refresh-products-button"),
  adminProductsList: document.querySelector("#admin-products-list"),
  adminProductsStatus: document.querySelector("#admin-products-status"),
  categorySizesList: document.querySelector("#category-sizes-list"),
  categorySizesStatus: document.querySelector("#category-sizes-status"),
  refreshAdminProducts: document.querySelector(
    "#refresh-admin-products-button",
  ),
  deleteProductsList: document.querySelector("#delete-products-list"),
  deleteProductsStatus: document.querySelector("#delete-products-status"),
  refreshDeleteProducts: document.querySelector(
    "#refresh-delete-products-button",
  ),
};
let categorySizeOptions = null;
const dashboardNav = document.querySelector(".dashboard-nav");
const dashboardViews = [...document.querySelectorAll(".dashboard-view")];
let currentUserId = null;
const cart = new Map();
let checkoutInProgress = false;
const pageForRole = {
  admin: "admin-panel.html",
  employee: "employee-dashboard.html",
};

dashboardNav?.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("button[data-dashboard-view]");
  if (!button || button.disabled) return;
  const viewId = button.dataset.dashboardView;
  showDashboardView(viewId);
  if (viewId === "sales-panel" && requiredRole === "admin") {
    loadAdminSalesHistory(elements.adminSalesPeriod.value);
  }
  if (viewId === "delete-products-panel" && requiredRole === "admin") {
    loadDeletableProducts();
  }
  if (viewId === "login-logout-logs" && requiredRole === "admin") {
    loadLoginLogoutLogs();
  }
});

function showDashboardView(viewId) {
  const selectedView = dashboardViews.find((view) => view.id === viewId);
  if (!selectedView) return;

  dashboardViews.forEach((view) => {
    view.hidden = view !== selectedView;
  });
  dashboardNav?.querySelectorAll("button[data-dashboard-view]").forEach((button) => {
    const isCurrent = button.dataset.dashboardView === viewId;
    button.classList.toggle("active", isCurrent);
    if (isCurrent) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

function enableDashboardNavigation() {
  dashboardNav?.querySelectorAll("button[data-dashboard-view]").forEach((button) => {
    button.disabled = false;
  });
  const currentButton = dashboardNav?.querySelector(
    "button[data-dashboard-view].active",
  );
  if (currentButton) showDashboardView(currentButton.dataset.dashboardView);
}

elements.signOut.addEventListener("click", async () => {
  elements.signOut.disabled = true;
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user) {
      await recordLogoutTimedate(sessionData.session.user);
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.replace("login.html");
  } catch (error) {
    elements.status.textContent =
      error instanceof Error ? error.message : "Could not sign out.";
    elements.status.classList.add("error");
    elements.signOut.disabled = false;
  }
});

elements.refreshUsers?.addEventListener("click", loadEmployees);
elements.refreshAdminProducts?.addEventListener("click", loadAdminProducts);
elements.refreshDeleteProducts?.addEventListener("click", loadDeletableProducts);
elements.refreshSales?.addEventListener("click", () =>
  loadSalesHistory(currentUserId),
);
elements.refreshAdminSales?.addEventListener("click", () =>
  loadAdminSalesHistory(elements.adminSalesPeriod.value),
);
elements.refreshLoginLogoutLogs?.addEventListener("click", loadLoginLogoutLogs);
elements.adminSalesPeriod?.addEventListener("change", () =>
  loadAdminSalesHistory(elements.adminSalesPeriod.value),
);
elements.checkoutButton?.addEventListener("click", completeOrder);
elements.paymentMethod?.addEventListener("change", updatePaymentFields);
elements.cashReceived?.addEventListener("input", updateChangeDue);
elements.gcashReferenceNumber?.addEventListener("input", () => {
  elements.gcashReferenceNumber.value =
    elements.gcashReferenceNumber.value.replace(/\D/g, "").slice(0, 13);
});
elements.productForm?.addEventListener("submit", createProduct);
elements.productCategory?.addEventListener("change", loadCategorySizes);
elements.addProductSize?.addEventListener("click", () =>
  appendProductVariantRow(),
);
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
    await ensureLoginTimedate(user);
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
      enableDashboardNavigation();
      if (requiredRole === "employee") {
        elements.productCatalog.hidden = false;
        elements.cartPanel.hidden = false;
        renderCart();
        await loadProducts();
        await loadSalesHistory(user.id);
      } else if (requiredRole === "admin") {
        await loadEmployees();
        await loadAdminProducts();
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

async function loadCategorySizes() {
  const category = elements.productCategory.value.trim();
  categorySizeOptions = null;
  elements.productVariantsList.replaceChildren();
  elements.productFormStatus.classList.remove("error");
  if (!category) {
    elements.categorySizeHelp.textContent =
      "Enter a category to load its shared sizes. For a new category, add the sizes this product offers.";
    elements.addProductSize.hidden = false;
    return;
  }

  elements.categorySizeHelp.textContent = "Loading sizes for this category…";
  elements.addProductSize.disabled = true;
  try {
    const { data, error } = await supabase
      .from("category_sizes")
      .select("category, size, stock_quantity")
      .order("size");
    if (error) throw error;

    categorySizeOptions = (data ?? []).filter(
      (option) =>
        option.category.trim().toLowerCase() === category.toLowerCase(),
    );
    if (categorySizeOptions.length > 0) {
      elements.categorySizeHelp.textContent =
        "Sizes and their quantities are shared by every flavor in this category. Set a price for each size.";
      elements.addProductSize.hidden = true;
      categorySizeOptions.forEach(({ size, stock_quantity }) =>
        appendProductVariantRow({
          size,
          sizeQuantity: stock_quantity,
          locked: true,
        }),
      );
    } else {
      elements.categorySizeHelp.textContent =
        "This is a new category. Add each shared size and its stock quantity.";
      elements.addProductSize.hidden = false;
      appendProductVariantRow();
    }
  } catch (error) {
    categorySizeOptions = null;
    elements.categorySizeHelp.textContent =
      error instanceof Error ? error.message : "Could not load category sizes.";
    elements.categorySizeHelp.classList.add("error");
    elements.productFormStatus.textContent =
      "Could not load shared category sizes. Run the updated supabase-profiles.sql and try again.";
    elements.productFormStatus.classList.add("error");
  } finally {
    elements.addProductSize.disabled = false;
  }
}

function appendProductVariantRow({
  size = "",
  sizeQuantity = 0,
  locked = false,
} = {}) {
  if (categorySizeOptions?.length && !locked) return;

  const row = document.createElement("tr");
  const sizeCell = document.createElement("td");
  const sizeInput = document.createElement("input");
  sizeInput.className = "inventory-quantity-input";
  sizeInput.type = "text";
  sizeInput.maxLength = 40;
  sizeInput.value = size;
  sizeInput.required = true;
  sizeInput.disabled = locked;
  sizeInput.setAttribute("aria-label", "Size name");
  sizeCell.append(sizeInput);
  row.append(sizeCell);

  for (const [label, min, step, value, disabled] of [
    ["Price", "0.01", "0.01", "", false],
    ["Shared size quantity", "0", "1", String(sizeQuantity), locked],
  ]) {
    const cell = document.createElement("td");
    const input = document.createElement("input");
    input.className = "inventory-quantity-input";
    input.type = "number";
    input.min = min;
    input.step = step;
    input.value = value;
    input.required = true;
    input.disabled = disabled;
    input.setAttribute("aria-label", `${label} for ${size || "size"}`);
    cell.append(input);
    row.append(cell);
  }

  const actionCell = document.createElement("td");
  if (!locked) {
    const removeButton = document.createElement("button");
    removeButton.className = "inventory-save-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      row.remove();
    });
    actionCell.append(removeButton);
  }
  row.append(actionCell);
  elements.productVariantsList.append(row);
}

function readProductVariants() {
  return [...elements.productVariantsList.rows].map((row) => {
    const [sizeInput, priceInput, quantityInput] = row.querySelectorAll("input");
    return {
      size: sizeInput.value.trim(),
      price: Number(priceInput.value),
      size_quantity: Number(quantityInput.value),
    };
  });
}

async function createProduct(event) {
  event.preventDefault();
  elements.productFormStatus.classList.remove("error");
  elements.productFormStatus.textContent = "";

  const productName = elements.productName.value.trim();
  const productCategory = elements.productCategory.value.trim();
  const productQuantity = Number(elements.productQuantity.value);
  const variants = readProductVariants();
  const image = elements.productImage.files?.[0];
  const sizes = variants.map((variant) => variant.size.toLowerCase());
  if (
    !productName ||
    !productCategory ||
    !Number.isSafeInteger(productQuantity) ||
    productQuantity < 0 ||
    categorySizeOptions === null ||
    variants.length === 0 ||
    variants.some(
      (variant) =>
        !variant.size ||
        variant.size.length > 40 ||
        !Number.isFinite(variant.price) ||
        variant.price <= 0 ||
        !Number.isSafeInteger(variant.size_quantity) ||
        variant.size_quantity < 0,
    ) ||
    new Set(sizes).size !== sizes.length ||
    (categorySizeOptions.length > 0 &&
      (sizes.length !== categorySizeOptions.length ||
        categorySizeOptions.some((option) =>
          !sizes.includes(option.size.toLowerCase()),
        ))) ||
    !image
  ) {
    elements.productFormStatus.textContent =
      "Enter a product quantity, a valid price for every category size, and shared size quantities for a new category, then choose an image.";
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
    const { error: insertError } = await supabase.rpc(
      "admin_create_product",
      {
        p_product_name: productName,
        p_category: productCategory,
        p_product_quantity: productQuantity,
        p_image_path: imagePath,
        p_image_url: imageData.publicUrl,
        p_variants: variants,
      },
    );
    if (insertError) throw insertError;

    elements.productForm.reset();
    categorySizeOptions = null;
    elements.productVariantsList.replaceChildren();
    elements.categorySizeHelp.textContent =
      "Size stock is shared by every flavor in the same category.";
    elements.addProductSize.hidden = false;
    elements.productFormStatus.textContent =
      `Flavor saved with ${productQuantity} units and ${variants.length} shared size${variants.length === 1 ? "" : "s"}.`;
    await loadAdminProducts();
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

async function attachProductAvailability(products) {
  const groupIds = [...new Set(products.map((product) => product.product_group_id))];
  const categories = [...new Set(products.map((product) => product.category))];
  const [groupsResult, sizesResult] = await Promise.all([
    supabase
      .from("product_groups")
      .select("id, product_quantity")
      .in("id", groupIds),
    supabase
      .from("category_sizes")
      .select("category, size, stock_quantity")
      .in("category", categories),
  ]);
  if (groupsResult.error) throw groupsResult.error;
  if (sizesResult.error) throw sizesResult.error;

  const groupQuantities = new Map(
    (groupsResult.data ?? []).map((group) => [
      group.id,
      Number(group.product_quantity),
    ]),
  );
  const sizeQuantities = new Map(
    (sizesResult.data ?? []).map((size) => [
      `${size.category.toLowerCase()}\u0000${size.size.toLowerCase()}`,
      Number(size.stock_quantity),
    ]),
  );

  for (const product of products) {
    product.product_quantity = groupQuantities.get(product.product_group_id) ?? 0;
    product.size_quantity =
      sizeQuantities.get(
        `${product.category.toLowerCase()}\u0000${product.size.toLowerCase()}`,
      ) ?? 0;
    product.available_quantity = Math.min(
      product.product_quantity,
      product.size_quantity,
    );
    product.stock_quantity = product.available_quantity;
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
      .select(
        "id, product_group_id, product_name, category, size, price, image_url, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      elements.productCatalogStatus.textContent =
        "No products have been added yet.";
      return;
    }

    await attachProductAvailability(data);
    for (const product of data) {
      const cartItem = cart.get(product.id);
      if (cartItem) cartItem.product = product;
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
      const category = document.createElement("p");
      category.textContent = `Category: ${product.category}`;
      const size = document.createElement("p");
      size.textContent = `Size: ${product.size}`;
      const productStock = document.createElement("p");
      productStock.textContent = `Product QTY: ${product.product_quantity}`;
      const sizeStock = document.createElement("p");
      sizeStock.textContent = `Shared ${product.size} QTY: ${product.size_quantity}`;
      const price = document.createElement("p");
      price.textContent =
        product.price == null
          ? "Price not set. Ask the Admin to add this product with a price."
          : formatCurrency(product.price);
      const stock = document.createElement("p");
      stock.className = Number(product.available_quantity) > 0
        ? "stock-status"
        : "stock-status out-of-stock";
      stock.textContent = Number(product.available_quantity) > 0
        ? `Available to sell: ${product.available_quantity}`
        : "Out of stock";
      details.append(
        name,
        category,
        size,
        price,
        productStock,
        sizeStock,
        stock,
      );
      card.append(image, details);

      if (
        product.price != null &&
        Number(product.price) > 0 &&
        Number(product.available_quantity) > 0
      ) {
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
        quantityInput.max = String(product.available_quantity);
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
      "id, product_name, quantity, unit_price, total, payment_method, order_type, cash_received, change_due, gcash_reference_number, gcash_status, gcash_confirmed_amount, gcash_confirmed_at, sold_at",
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
  renderSalesHistoryRows(data);
}

async function loadAdminSalesHistory(period) {
  if (!elements.adminSalesPeriod) return;

  elements.salesHistoryStatus.classList.remove("error");
  elements.salesHistoryStatus.textContent = "Loading sales history…";
  elements.salesHistoryList.replaceChildren();
  elements.adminSalesRevenue.textContent = formatCurrency(0);
  elements.adminSalesCount.textContent = "0";
  elements.adminSalesUnits.textContent = "0";
  elements.refreshAdminSales.disabled = true;

  try {
    const range = getSalesPeriodRange(period);
    const sales = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      let query = supabase
        .from("sales")
        .select(
          "id, product_name, quantity, unit_price, total, payment_method, order_type, cash_received, change_due, gcash_reference_number, gcash_status, gcash_confirmed_amount, gcash_confirmed_at, sold_at",
        );
      if (range) {
        query = query.gte("sold_at", range.start.toISOString()).lt(
          "sold_at",
          range.end.toISOString(),
        );
      }

      const { data, error } = await query
        .order("sold_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      sales.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }

    const revenueCents = sales.reduce((sum, entry) => {
      const isPaid =
        entry.payment_method !== "GCash" ||
        entry.gcash_status === "confirmed";
      return isPaid ? sum + Math.round(Number(entry.total) * 100) : sum;
    }, 0);
    const unitsSold = sales.reduce(
      (sum, entry) => sum + Number(entry.quantity),
      0,
    );
    elements.adminSalesRevenue.textContent = formatCurrency(
      revenueCents / 100,
    );
    elements.adminSalesCount.textContent = String(sales.length);
    elements.adminSalesUnits.textContent = String(unitsSold);
    elements.salesHistoryStatus.textContent = sales.length
      ? `${sales.length} sale item${sales.length === 1 ? "" : "s"} in this period. Revenue includes Cash and confirmed GCash sales; pending GCash is excluded.`
      : "No sales found for this period. If you expect sales here, run the updated supabase-profiles.sql in the Supabase SQL Editor to enable Admin read access.";
    renderSalesHistoryRows(sales);
  } catch (error) {
    elements.salesHistoryStatus.textContent =
      error instanceof Error ? error.message : "Could not load sales history.";
    elements.salesHistoryStatus.classList.add("error");
  } finally {
    elements.refreshAdminSales.disabled = false;
  }
}

function getSalesPeriodRange(period) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);

  switch (period) {
    case "day":
      end.setDate(end.getDate() + 1);
      break;
    case "week":
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
      break;
    case "month":
      start.setDate(1);
      end.setFullYear(start.getFullYear(), start.getMonth() + 1, 1);
      break;
    case "year":
      start.setMonth(0, 1);
      end.setFullYear(start.getFullYear() + 1, 0, 1);
      break;
    case "all":
      return null;
    default:
      throw new Error("Choose a valid sales period.");
  }

  return { start, end };
}

function renderSalesHistoryRows(data) {
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
    const status = entry.payment_method === "GCash"
      ? entry.gcash_status === "confirmed"
        ? "Confirmed"
        : "Pending"
      : "Paid";
    appendCell(row, status);
    appendCell(
      row,
      entry.gcash_confirmed_amount == null
        ? "—"
        : formatCurrency(entry.gcash_confirmed_amount),
    );
    appendCell(
      row,
      entry.gcash_confirmed_at
        ? new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(entry.gcash_confirmed_at))
        : "—",
    );
    const actionCell = document.createElement("td");
    if (
      entry.payment_method === "GCash" &&
      entry.gcash_status === "pending"
    ) {
      const confirmButton = document.createElement("button");
      confirmButton.className = "user-action-button";
      confirmButton.type = "button";
      confirmButton.textContent = "Confirm";
      confirmButton.addEventListener("click", () =>
        confirmGcashSale(entry, confirmButton),
      );
      actionCell.append(confirmButton);
    } else {
      actionCell.textContent = "—";
    }
    row.append(actionCell);
    elements.salesHistoryList.append(row);
  }
}

async function confirmGcashSale(sale, button) {
  if (
    !window.confirm(
      `Confirm GCash payment of ${formatCurrency(sale.total)} for ${sale.product_name}? This will save the amount and current date/time.`,
    )
  ) {
    return;
  }

  button.disabled = true;
  elements.salesHistoryStatus.classList.remove("error");
  elements.salesHistoryStatus.textContent = "Confirming GCash payment…";
  try {
    const { error } = await supabase.rpc("confirm_gcash_sale", {
      p_sale_id: sale.id,
    });
    if (error) throw error;

    if (requiredRole === "admin") {
      await loadAdminSalesHistory(elements.adminSalesPeriod.value);
    } else {
      await loadSalesHistory(currentUserId);
    }
    elements.salesHistoryStatus.textContent =
      `GCash payment confirmed. ${formatCurrency(sale.total)} and the confirmation date/time were saved.`;
  } catch (error) {
    elements.salesHistoryStatus.textContent = describeError(
      error,
      "Could not confirm GCash payment.",
    );
    elements.salesHistoryStatus.classList.add("error");
    button.disabled = false;
  }
}

async function loadAdminProducts() {
  if (!elements.adminProductsList) return;
  elements.adminProductsStatus.classList.remove("error");
  elements.categorySizesStatus.classList.remove("error");
  elements.adminProductsStatus.textContent = "Loading product quantities…";
  elements.categorySizesStatus.textContent = "Loading shared size quantities…";
  elements.adminProductsList.replaceChildren();
  elements.categorySizesList.replaceChildren();
  elements.refreshAdminProducts.disabled = true;

  try {
    const [groupsResult, sizesResult] = await Promise.all([
      supabase
        .from("product_groups")
        .select("id, product_name, category, product_quantity")
        .order("created_at", { ascending: false }),
      supabase
        .from("category_sizes")
        .select("id, category, size, stock_quantity")
        .order("category")
        .order("size"),
    ]);
    if (groupsResult.error) throw groupsResult.error;
    if (sizesResult.error) throw sizesResult.error;
    const groups = groupsResult.data ?? [];
    const sizes = sizesResult.data ?? [];

    if (!groups.length) {
      elements.adminProductsStatus.textContent = "No products have been added yet.";
    }

    for (const product of groups) {
      const row = document.createElement("tr");
      appendCell(row, product.product_name);
      appendCell(row, product.category);
      const quantityCell = document.createElement("td");
      const quantityInput = createInventoryInput(
        product.product_quantity,
        `Product QTY for ${product.product_name}`,
      );
      quantityCell.append(quantityInput);
      row.append(quantityCell);

      row.append(
        createInventoryAction((button) =>
          updateProductStock(product, quantityInput, button),
        ),
      );
      elements.adminProductsList.append(row);
    }
    if (groups.length) {
      elements.adminProductsStatus.textContent =
        `${groups.length} flavor${groups.length === 1 ? "" : "s"}. Product QTY is shared across its sizes.`;
    }

    for (const categorySize of sizes) {
      const row = document.createElement("tr");
      appendCell(row, categorySize.category);
      appendCell(row, categorySize.size);
      const quantityCell = document.createElement("td");
      const quantityInput = createInventoryInput(
        categorySize.stock_quantity,
        `Shared ${categorySize.size} quantity for ${categorySize.category}`,
      );
      quantityCell.append(quantityInput);
      row.append(quantityCell);
      row.append(
        createInventoryAction((button) =>
          updateCategorySizeStock(categorySize, quantityInput, button),
        ),
      );
      elements.categorySizesList.append(row);
    }
    elements.categorySizesStatus.textContent = sizes.length
      ? `${sizes.length} shared category size${sizes.length === 1 ? "" : "s"}. These quantities are shared by all flavors in each category.`
      : "Create a product category to add shared sizes.";
  } catch (error) {
    elements.adminProductsStatus.textContent =
      error instanceof Error ? error.message : "Could not load product stock.";
    elements.adminProductsStatus.classList.add("error");
    elements.categorySizesStatus.textContent =
      "Could not load shared size quantities.";
    elements.categorySizesStatus.classList.add("error");
  } finally {
    elements.refreshAdminProducts.disabled = false;
  }
}

async function loadDeletableProducts() {
  elements.deleteProductsStatus.classList.remove("error");
  elements.deleteProductsStatus.textContent = "Loading products…";
  elements.deleteProductsList.replaceChildren();
  elements.refreshDeleteProducts.disabled = true;

  try {
    const { data, error } = await supabase
      .from("product_groups")
      .select("id, product_name, category, product_quantity, image_path")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      elements.deleteProductsStatus.textContent = "No products to delete.";
      return;
    }

    for (const product of data) {
      const row = document.createElement("tr");
      appendCell(row, product.product_name);
      appendCell(row, product.category);
      appendCell(row, String(product.product_quantity));
      const actionCell = document.createElement("td");
      const button = document.createElement("button");
      button.className = "user-action-button destructive";
      button.type = "button";
      button.textContent = "Delete";
      button.addEventListener("click", () =>
        deleteProduct(product, row, button),
      );
      actionCell.append(button);
      row.append(actionCell);
      elements.deleteProductsList.append(row);
    }
    elements.deleteProductsStatus.textContent =
      `${data.length} product${data.length === 1 ? "" : "s"}. Deleting a product keeps its recorded sales history.`;
  } catch (error) {
    elements.deleteProductsStatus.textContent =
      error instanceof Error ? error.message : "Could not load products.";
    elements.deleteProductsStatus.classList.add("error");
  } finally {
    elements.refreshDeleteProducts.disabled = false;
  }
}

async function deleteProduct(product, row, button) {
  if (
    !window.confirm(
      `Delete "${product.product_name}" from ${product.category}? This removes its catalog sizes and flavor stock. Shared category sizes and recorded sales history stay.`,
    )
  ) {
    return;
  }

  button.disabled = true;
  elements.deleteProductsStatus.classList.remove("error");
  elements.deleteProductsStatus.textContent =
    `Deleting ${product.product_name}…`;
  try {
    const { data: imagePath, error } = await supabase.rpc(
      "admin_delete_product",
      { p_product_group_id: product.id },
    );
    if (error) throw error;

    row.remove();
    await loadAdminProducts();
    const { error: imageError } = await supabase.storage
      .from("product-images")
      .remove([imagePath]);
    if (imageError) {
      elements.deleteProductsStatus.textContent =
        `Product deleted, but its image could not be removed: ${imageError.message}`;
      elements.deleteProductsStatus.classList.add("error");
    } else {
      elements.deleteProductsStatus.textContent =
        `${product.product_name} was deleted. Shared category sizes were kept.`;
    }
    if (!elements.deleteProductsList.rows.length) {
      elements.deleteProductsStatus.textContent =
        imageError
          ? elements.deleteProductsStatus.textContent
          : "Product deleted. No products remain.";
    }
  } catch (error) {
    console.error("Could not delete product.", error);
    const errorMessage = describeError(
      error,
      "Could not delete this product. Check the browser console for details.",
    );
    elements.deleteProductsStatus.textContent = errorMessage;
    elements.deleteProductsStatus.classList.add("error");
    button.disabled = false;
  }
}

function describeError(error, fallback) {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const parts = ["message", "details", "hint", "code"]
      .map((key) => error[key])
      .filter((value) => typeof value === "string" && value.trim());
    if (parts.length) return [...new Set(parts)].join(" — ");
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch (serializationError) {
      console.error("Could not serialize product deletion error.", serializationError);
    }
  }
  return fallback;
}

function createInventoryInput(value, label) {
  const input = document.createElement("input");
  input.className = "inventory-quantity-input";
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.value = String(value);
  input.setAttribute("aria-label", label);
  return input;
}

function createInventoryAction(onSave) {
  const cell = document.createElement("td");
  const button = document.createElement("button");
  button.className = "inventory-save-button";
  button.type = "button";
  button.textContent = "Save QTY";
  button.addEventListener("click", () => onSave(button));
  cell.append(button);
  return cell;
}

async function updateProductStock(product, input, button) {
  const stockQuantity = Number(input.value);
  if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0) {
    elements.adminProductsStatus.textContent =
      "Product QTY must be a whole number of zero or more.";
    elements.adminProductsStatus.classList.add("error");
    input.focus();
    return;
  }

  button.disabled = true;
  elements.adminProductsStatus.classList.remove("error");
  elements.adminProductsStatus.textContent = "Saving Product QTY…";
  try {
    const { error } = await supabase.rpc("admin_update_product_quantity", {
      p_product_group_id: product.id,
      p_product_quantity: stockQuantity,
    });
    if (error) throw error;
    elements.adminProductsStatus.textContent = `Product QTY updated for ${product.product_name}.`;
    await loadAdminProducts();
  } catch (error) {
    elements.adminProductsStatus.textContent =
      error instanceof Error ? error.message : "Could not update product stock.";
    elements.adminProductsStatus.classList.add("error");
  } finally {
    button.disabled = false;
  }
}

async function updateCategorySizeStock(categorySize, input, button) {
  const stockQuantity = Number(input.value);
  if (!Number.isSafeInteger(stockQuantity) || stockQuantity < 0) {
    elements.categorySizesStatus.textContent =
      "Shared Size QTY must be a whole number of zero or more.";
    elements.categorySizesStatus.classList.add("error");
    input.focus();
    return;
  }

  button.disabled = true;
  elements.categorySizesStatus.classList.remove("error");
  elements.categorySizesStatus.textContent = "Saving shared Size QTY…";
  try {
    const { error } = await supabase.rpc("admin_update_category_size_quantity", {
      p_category_size_id: categorySize.id,
      p_size_quantity: stockQuantity,
    });
    if (error) throw error;
    elements.categorySizesStatus.textContent =
      `Shared ${categorySize.size} QTY updated for ${categorySize.category}.`;
    await loadAdminProducts();
  } catch (error) {
    elements.categorySizesStatus.textContent =
      error instanceof Error ? error.message : "Could not update shared Size QTY.";
    elements.categorySizesStatus.classList.add("error");
  } finally {
    button.disabled = false;
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
  const nextQuantity = quantity + (existing?.quantity ?? 0);
  if (nextQuantity > Number(product.stock_quantity)) {
    addStatus.textContent =
      `Only ${product.stock_quantity} unit${Number(product.stock_quantity) === 1 ? "" : "s"} available in stock.`;
    addStatus.classList.add("error");
    return;
  }
  cart.set(product.id, {
    product,
    quantity: nextQuantity,
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
    quantityInput.max = String(item.product.stock_quantity);
    quantityInput.step = "1";
    quantityInput.value = String(item.quantity);
    quantityInput.disabled = checkoutInProgress;
    quantityInput.setAttribute(
      "aria-label",
      `Quantity for ${item.product.product_name}`,
    );
    quantityInput.addEventListener("change", () => {
      const nextQuantity = Number(quantityInput.value);
      if (
        !Number.isSafeInteger(nextQuantity) ||
        nextQuantity < 1 ||
        nextQuantity > Number(item.product.stock_quantity)
      ) {
        quantityInput.value = String(item.quantity);
        elements.cartStatus.textContent =
          `Cart quantities must be whole numbers from 1 to ${item.product.stock_quantity}.`;
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
  if (!["Dine-in", "Takeout"].includes(orderType)) {
    elements.cartStatus.textContent =
      "Select Dine-in or Takeout as the order type.";
    elements.cartStatus.classList.add("error");
    elements.orderType.focus();
    return;
  }
  if (
    paymentMethod === "GCash" &&
    gcashReferenceNumber &&
    !/^\d{13}$/.test(gcashReferenceNumber)
  ) {
    elements.cartStatus.textContent =
      "GCash reference number must contain exactly 13 digits.";
    elements.cartStatus.classList.add("error");
    elements.gcashReferenceNumber.focus();
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
        paymentMethod === "GCash" && gcashReferenceNumber
          ? gcashReferenceNumber
          : null,
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
    await loadProducts();
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
  elements.gcashReferenceNumber.required = false;
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

async function loadLoginLogoutLogs() {
  elements.loginLogoutLogsStatus.classList.remove("error");
  elements.loginLogoutLogsStatus.textContent = "Loading login/logout logs…";
  elements.loginLogoutLogsList.replaceChildren();
  elements.refreshLoginLogoutLogs.disabled = true;

  try {
    const { data, error } = await supabase
      .from("login_logout_logs")
      .select("id,user_email,username,role,LoginTimedate,logouttimedate")
      .order("LoginTimedate", { ascending: false })
      .limit(250);
    if (error) throw error;

    if (!data?.length) {
      elements.loginLogoutLogsStatus.textContent = "No login/logout logs found.";
      return;
    }

    for (const entry of data) {
      const row = document.createElement("tr");
      appendCell(row, entry.user_email || "—");
      appendCell(row, entry.username || "—");
      appendCell(row, entry.role || "—");
      appendCell(row, formatLogDate(entry.LoginTimedate));
      appendCell(
        row,
        entry.logouttimedate
          ? formatLogDate(entry.logouttimedate)
          : "Not logged out",
      );
      elements.loginLogoutLogsList.append(row);
    }
    elements.loginLogoutLogsStatus.textContent =
      `Showing ${data.length} most recent login session${data.length === 1 ? "" : "s"}.`;
  } catch (error) {
    elements.loginLogoutLogsStatus.textContent =
      error instanceof Error
        ? error.message
        : "Could not load login/logout logs.";
    elements.loginLogoutLogsStatus.classList.add("error");
  } finally {
    elements.refreshLoginLogoutLogs.disabled = false;
  }
}

function formatLogDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
