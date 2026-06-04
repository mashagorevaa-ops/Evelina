const body = document.body;
const header = document.querySelector(".site-header");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
const progressBar = document.querySelector(".scroll-progress-bar");
const backToTopButton = document.querySelector(".back-to-top");
const toastStack = document.querySelector("#toast-stack");

const selectAll = document.querySelector("#select-all");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");
const cartItemsContainer = document.querySelector(".cart-items");
const cartEmpty = document.querySelector("#cart-empty");
const favoritesGrid = document.querySelector("#favorites-grid");
const favoritesEmpty = document.querySelector("#favorites-empty");
const favoritesCount = document.querySelector("#favorites-count");

const modal = document.querySelector("#product-modal");
const modalImage = document.querySelector("#modal-image");
const modalTitle = document.querySelector("#product-modal-title");
const modalDescription = document.querySelector("#modal-description");
const modalSize = document.querySelector("#modal-size");
const modalPrice = document.querySelector("#modal-price");
const modalFavorite = document.querySelector("#modal-favorite");
const modalCart = document.querySelector("#modal-cart");

const STORAGE_KEY = "urbanchic-state-v1";
const productStore = new Map();
const favorites = new Set();
const defaultCartState = [];
let activeProductId = null;
let lastFocusedElement = null;

body.classList.add("is-ready");

function setNavExpanded(isOpen) {
  if (!header || !navToggle) {
    return;
  }

  header.classList.toggle("nav-open", isOpen);
  body.classList.toggle("nav-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
  navToggle.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
}

function closeNavigation() {
  setNavExpanded(false);
}

function isInteractiveTarget(element) {
  return Boolean(element.closest("button, label, input, select, textarea, a"));
}

function showToast(message) {
  if (!toastStack) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastStack.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

function formatPrice(value) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function getCartItems() {
  return Array.from(document.querySelectorAll("[data-cart-item]"));
}

function isInCart(productId) {
  return Boolean(document.querySelector(`[data-cart-item][data-product-id="${productId}"]`));
}

function readProductData(element) {
  return {
    id: element.dataset.productId,
    title: element.dataset.title,
    size: element.dataset.size,
    price: Number(element.dataset.price || 0),
    image: element.dataset.image,
    description: element.dataset.description,
  };
}

function registerProducts() {
  document.querySelectorAll("[data-product-id]").forEach((element) => {
    const product = readProductData(element);

    if (!product.id || productStore.has(product.id)) {
      return;
    }

    productStore.set(product.id, product);
  });

  getCartItems().forEach((item) => {
    const productId = item.dataset.productId;

    if (!productId || defaultCartState.some((entry) => entry.id === productId)) {
      return;
    }

    defaultCartState.push({
      id: productId,
      checked: item.querySelector("input")?.checked ?? true,
    });
  });
}

function createCartItem(product, checked = true) {
  const article = document.createElement("article");
  article.className = "cart-item product-card reveal is-visible";
  article.dataset.cartItem = "";
  article.dataset.productCard = "";
  article.dataset.productId = product.id;
  article.dataset.title = product.title;
  article.dataset.size = product.size;
  article.dataset.price = String(product.price);
  article.dataset.image = product.image;
  article.dataset.description = product.description;
  article.tabIndex = 0;
  article.setAttribute("role", "button");

  article.innerHTML = `
    <label class="item-check">
      <input type="checkbox" ${checked ? "checked" : ""} />
      <span></span>
    </label>
    <img src="${product.image}" alt="${product.title}" />
    <div class="cart-item-copy">
      <h2>${product.title}</h2>
      <p>Размер: ${product.size}</p>
      <strong>${formatPrice(product.price)}</strong>
    </div>
    <div class="cart-actions">
      <button
        class="favorite-toggle"
        type="button"
        data-product-id="${product.id}"
        aria-label="Добавить в избранное"
      >
        ☆
      </button>
      <button
        class="remove-item"
        type="button"
        data-product-id="${product.id}"
        aria-label="Удалить"
      >
        🗑
      </button>
    </div>
  `;

  return article;
}

function getCartState() {
  return getCartItems().map((item) => ({
    id: item.dataset.productId,
    checked: item.querySelector("input")?.checked ?? true,
  }));
}

function saveState() {
  const state = {
    favorites: Array.from(favorites),
    cart: getCartState(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors so the UI stays functional in restricted environments.
  }
}

function restoreState() {
  let storedState = null;

  try {
    storedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    storedState = null;
  }

  const storedFavorites = Array.isArray(storedState?.favorites) ? storedState.favorites : [];
  const storedCart = Array.isArray(storedState?.cart) ? storedState.cart : defaultCartState;

  favorites.clear();
  storedFavorites.forEach((productId) => {
    if (productStore.has(productId)) {
      favorites.add(productId);
    }
  });

  if (cartItemsContainer) {
    cartItemsContainer.innerHTML = "";

    storedCart.forEach((entry) => {
      const product = productStore.get(entry.id);

      if (!product) {
        return;
      }

      cartItemsContainer.append(createCartItem(product, entry.checked !== false));
    });
  }
}

function updateFavoriteButtonsState() {
  document.querySelectorAll(".favorite-toggle").forEach((button) => {
    const productId = button.dataset.productId;
    const isActive = favorites.has(productId);

    button.classList.toggle("is-active", isActive);
    button.textContent = isActive ? "★" : "☆";
    button.setAttribute(
      "aria-label",
      isActive ? "Убрать из избранного" : "Добавить в избранное",
    );
  });

  if (modalFavorite && activeProductId) {
    const isActive = favorites.has(activeProductId);
    modalFavorite.textContent = isActive ? "Убрать из избранного" : "В избранное";
  }
}

function updateModalCartButton() {
  if (!modalCart || !activeProductId) {
    return;
  }

  modalCart.textContent = isInCart(activeProductId) ? "Открыть в корзине" : "В корзину";
}

function renderFavorites() {
  if (!favoritesGrid || !favoritesEmpty || !favoritesCount) {
    return;
  }

  const items = Array.from(favorites)
    .map((productId) => productStore.get(productId))
    .filter(Boolean);

  favoritesGrid.innerHTML = "";
  favoritesCount.textContent = String(items.length);
  favoritesEmpty.hidden = items.length > 0;

  items.forEach((product) => {
    const article = document.createElement("article");
    article.className = "favorite-card product-card reveal is-visible";
    article.dataset.productCard = "";
    article.dataset.productId = product.id;
    article.dataset.title = product.title;
    article.dataset.size = product.size;
    article.dataset.price = String(product.price);
    article.dataset.image = product.image;
    article.dataset.description = product.description;
    article.tabIndex = 0;
    article.setAttribute("role", "button");

    article.innerHTML = `
      <img src="${product.image}" alt="${product.title}" />
      <div class="favorite-card-copy">
        <h2>${product.title}</h2>
        <p>Размер: ${product.size}</p>
        <strong>${formatPrice(product.price)}</strong>
      </div>
      <div class="favorite-card-actions">
        <button
          class="favorite-toggle is-active"
          type="button"
          data-product-id="${product.id}"
          aria-label="Убрать из избранного"
        >
          ★
        </button>
        <button class="favorite-add-cart" type="button" data-product-id="${product.id}">
          ${isInCart(product.id) ? "Открыть в корзине" : "В корзину"}
        </button>
      </div>
    `;

    favoritesGrid.append(article);
  });

  updateFavoriteButtonsState();
}

function updateCartSummary() {
  const items = getCartItems();

  if (!cartCount || !cartTotal) {
    return;
  }

  const selectedItems = items.filter((item) => item.querySelector("input")?.checked);
  const total = selectedItems.reduce((sum, item) => sum + Number(item.dataset.price || 0), 0);

  cartCount.textContent = String(selectedItems.length);
  cartTotal.textContent = formatPrice(total);

  if (selectAll) {
    const everyChecked = items.length > 0 && selectedItems.length === items.length;
    selectAll.checked = everyChecked;
    selectAll.disabled = items.length === 0;
  }

  if (cartEmpty) {
    cartEmpty.hidden = items.length > 0;
  }

  saveState();
}

function toggleFavorite(productId) {
  if (!productStore.has(productId)) {
    return;
  }

  const product = productStore.get(productId);

  if (favorites.has(productId)) {
    favorites.delete(productId);
    showToast(`${product.title} удалён из избранного`);
  } else {
    favorites.add(productId);
    showToast(`${product.title} добавлен в избранное`);
  }

  renderFavorites();
  updateFavoriteButtonsState();
  saveState();
}

function scrollToProductInCart(productId) {
  const item = document.querySelector(`[data-cart-item][data-product-id="${productId}"]`);

  if (!item) {
    return false;
  }

  item.scrollIntoView({ behavior: "smooth", block: "center" });
  item.classList.add("is-highlighted");

  window.setTimeout(() => {
    item.classList.remove("is-highlighted");
  }, 1200);

  return true;
}

function addProductToCart(productId) {
  if (isInCart(productId)) {
    closeProductModal();
    renderFavorites();
    updateModalCartButton();
    window.requestAnimationFrame(() => {
      scrollToProductInCart(productId);
    });
    showToast("Товар уже находится в корзине");
    return;
  }

  const product = productStore.get(productId);

  if (!product || !cartItemsContainer) {
    return;
  }

  cartItemsContainer.append(createCartItem(product));
  updateCartSummary();
  renderFavorites();
  updateFavoriteButtonsState();
  updateModalCartButton();
  showToast(`${product.title} добавлен в корзину`);
}

function removeProductFromCart(productId) {
  const item = document.querySelector(`[data-cart-item][data-product-id="${productId}"]`);

  if (!item) {
    return;
  }

  item.remove();
  updateCartSummary();
  renderFavorites();
  updateModalCartButton();
  showToast("Товар удалён из корзины");
}

function openProductModal(productId) {
  const product = productStore.get(productId);

  if (!modal || !product || !modalImage || !modalTitle || !modalDescription || !modalSize || !modalPrice) {
    return;
  }

  activeProductId = productId;
  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modalImage.src = product.image;
  modalImage.alt = product.title;
  modalTitle.textContent = product.title;
  modalDescription.textContent = product.description;
  modalSize.textContent = product.size;
  modalPrice.textContent = formatPrice(product.price);

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  body.classList.add("modal-open");

  updateFavoriteButtonsState();
  updateModalCartButton();

  window.requestAnimationFrame(() => {
    modal.querySelector("[data-modal-close]")?.focus();
  });
}

function closeProductModal() {
  if (!modal || !modal.classList.contains("is-open")) {
    return;
  }

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  body.classList.remove("modal-open");
  activeProductId = null;

  if (lastFocusedElement?.isConnected) {
    lastFocusedElement.focus();
  }

  lastFocusedElement = null;
}

if (header && navToggle) {
  navToggle.addEventListener("click", () => {
    setNavExpanded(!header.classList.contains("nav-open"));
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", closeNavigation);
  });
}

registerProducts();
restoreState();
updateCartSummary();
renderFavorites();
updateFavoriteButtonsState();

if (selectAll) {
  selectAll.addEventListener("change", () => {
    getCartItems().forEach((item) => {
      const checkbox = item.querySelector("input");

      if (checkbox) {
        checkbox.checked = selectAll.checked;
      }
    });

    updateCartSummary();
  });
}

const revealGroups = [
  ".section-topline",
  ".about-copy",
  ".about-image",
  ".feature-pill",
  ".feature-card",
  ".blog-card",
  ".orders-outline",
  ".favorites-section",
  ".cart-section",
  ".site-footer",
];

const revealItems = revealGroups.flatMap((selector) =>
  Array.from(document.querySelectorAll(selector)),
);

revealItems.forEach((item, index) => {
  item.classList.add("reveal", `reveal-delay-${index % 4}`);
});

if ("IntersectionObserver" in window && revealItems.length) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -40px 0px",
    },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const sectionIds = ["home", "blog", "profile", "favorites", "cart", "support"];
const trackedSections = sectionIds
  .map((id) => document.querySelector(`[data-section="${id}"]`))
  .filter(Boolean);

function setActiveNav(id) {
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.navLink === id);
  });
}

if ("IntersectionObserver" in window && trackedSections.length && navLinks.length) {
  const navObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (!visibleEntries.length) {
        return;
      }

      setActiveNav(visibleEntries[0].target.dataset.section);
    },
    {
      threshold: [0.2, 0.45, 0.7],
      rootMargin: "-20% 0px -45% 0px",
    },
  );

  trackedSections.forEach((section) => navObserver.observe(section));
}

function updateScrollUi() {
  const scrollTop = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollHeight > 0 ? Math.min((scrollTop / scrollHeight) * 100, 100) : 0;

  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }

  if (header) {
    header.classList.toggle("is-scrolled", scrollTop > 18);
  }

  if (backToTopButton) {
    backToTopButton.classList.toggle("is-visible", scrollTop > 520);
  }
}

document.addEventListener("click", (event) => {
  if (header && navToggle && !header.contains(event.target)) {
    closeNavigation();
  }

  const closeTrigger = event.target.closest("[data-modal-close]");
  if (closeTrigger) {
    closeProductModal();
    return;
  }

  const favoriteButton = event.target.closest(".favorite-toggle");
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.productId);
    return;
  }

  const removeButton = event.target.closest(".remove-item");
  if (removeButton) {
    removeProductFromCart(removeButton.dataset.productId);
    return;
  }

  const addCartButton = event.target.closest(".favorite-add-cart");
  if (addCartButton) {
    addProductToCart(addCartButton.dataset.productId);
    return;
  }

  const productCard = event.target.closest("[data-product-card]");
  if (productCard && !isInteractiveTarget(event.target)) {
    openProductModal(productCard.dataset.productId);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-cart-item] input[type='checkbox']")) {
    updateCartSummary();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNavigation();
    closeProductModal();
  }

  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const card = event.target.closest("[data-product-card]");

  if (!card || isInteractiveTarget(event.target)) {
    return;
  }

  event.preventDefault();
  openProductModal(card.dataset.productId);
});

if (modalFavorite) {
  modalFavorite.addEventListener("click", () => {
    if (activeProductId) {
      toggleFavorite(activeProductId);
    }
  });
}

if (modalCart) {
  modalCart.addEventListener("click", () => {
    if (!activeProductId) {
      return;
    }

    addProductToCart(activeProductId);
  });
}

window.addEventListener("scroll", updateScrollUi, { passive: true });
window.addEventListener("load", updateScrollUi);
updateScrollUi();

if (backToTopButton) {
  backToTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
