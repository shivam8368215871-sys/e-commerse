const BASE_URL = "http://127.0.0.1:5000";
// Change this to your Render URL when deploying e.g:
// const BASE_URL = "https://twodots-api.onrender.com";

function getToken() {
  return localStorage.getItem("twoDotsToken") || "";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}

// ── CART ──────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem("twoDotsCart") || "[]");

function saveCart() {
  localStorage.setItem("twoDotsCart", JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badges = document.querySelectorAll(".cart-badge");
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  badges.forEach(badge => {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
  });
}

function addToCart(productId, name, price, image, selectedSize = "M") {
  const id = Number(productId);
  const fullImageUrl = new URL(image, window.location.href).href;
  const existing = cart.find(i => i.id === id && i.size === selectedSize);
  if (existing) { existing.qty += 1; }
  else { cart.push({ id, name, price, image: fullImageUrl, size: selectedSize, qty: 1 }); }
  saveCart();
  showCartFeedback("Added to bag!");
}

function removeOne(id, size) {
  const numId = Number(id);
  const item = cart.find(i => i.id === numId && i.size === size);
  if (item && item.qty > 1) { item.qty--; }
  else { cart = cart.filter(i => !(i.id === numId && i.size === size)); }
  saveCart();
  if (document.getElementById("cartItems")) renderCart();
}

function removeItem(id, size) {
  cart = cart.filter(i => !(i.id === Number(id) && i.size === size));
  saveCart();
  if (document.getElementById("cartItems")) renderCart();
}

function addOne(id, size) {
  const item = cart.find(i => i.id === Number(id) && i.size === size);
  if (item) { item.qty++; saveCart(); }
  if (document.getElementById("cartItems")) renderCart();
}

function renderCart() {
  const container  = document.getElementById("cartItems");
  const emptyState = document.getElementById("emptyState");
  const cartContent= document.getElementById("cartContent");
  const subtotalEl = document.getElementById("subtotal");
  const totalEl    = document.getElementById("totalAmount");
  if (!container) return;

  if (cart.length === 0) {
    if (emptyState)  emptyState.style.display  = "block";
    if (cartContent) cartContent.style.display = "none";
    return;
  }
  if (emptyState)  emptyState.style.display  = "none";
  if (cartContent) cartContent.style.display = "block";

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <a href="product.html?id=${item.id}">
        <img src="${item.image}" alt="${item.name}">
      </a>
      <div class="cart-item-info">
        <a href="product.html?id=${item.id}" style="text-decoration:none;color:inherit;">
          <h4 class="cart-item-name">${item.name}</h4>
        </a>
        <div class="size-tag">Size: ${item.size}</div>
        <div class="qty-controls">
          <button class="qty-btn qty-minus" onclick="removeOne('${item.id}','${item.size}')">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn qty-plus" onclick="addOne('${item.id}','${item.size}')">+</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:end;">
          <button class="remove-btn" onclick="removeItem('${item.id}','${item.size}')">
            <i class="fas fa-trash"></i> Remove
          </button>
          <div class="item-price">₹${item.price * item.qty}</div>
        </div>
      </div>
    </div>
  `).join("");

  if (subtotalEl) subtotalEl.textContent = "₹" + subtotal;
  if (totalEl)    totalEl.textContent    = "₹" + subtotal;
}

function showCartFeedback(message) {
  const existing = document.querySelector('.cart-feedback');
  if (existing) existing.remove();
  const feedback = document.createElement('div');
  feedback.className = 'cart-feedback';
  feedback.style.cssText = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    background:#00b3a6; color:white; padding:16px 24px;
    border-radius:12px; font-weight:600; z-index:10000;
    box-shadow:0 8px 25px rgba(0,179,166,0.4); font-size:16px;
  `;
  feedback.textContent = message;
  document.body.appendChild(feedback);
  setTimeout(() => { if (feedback.parentNode) feedback.remove(); }, 1500);
}

// ── AUTH ──────────────────────────────────────────────
async function signup() {
  const name   = document.getElementById("name").value.trim();
  const dob    = document.getElementById("dob").value;
  const phone  = document.getElementById("phone").value.trim();
  const email  = document.getElementById("email").value.trim();
  const pass   = document.getElementById("pass").value;
  const gender = document.getElementById("gender").value || "Not specified";
  const btn    = document.getElementById("signupBtn");

  if (!name || !dob || !phone || !email || !pass) return alert("Please fill all required fields");
  if (phone.length !== 10) return alert("Enter valid 10-digit phone number");
  if (pass.length < 6) return alert("Password must be 6+ characters");

  btn.innerHTML = '<div class="loading-spinner"></div>Creating Account...';
  btn.disabled = true;

  try {
    const res = await fetch(`${BASE_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dob, phone, email, password: pass, gender })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Signup failed");
    alert("Account created successfully!");
    location.href = "login.html";
  } catch (err) { alert(err.message); }

  btn.innerHTML = 'Create Account';
  btn.disabled = false;
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const pass  = document.getElementById("pass").value;
  const btn   = document.getElementById("loginBtn");

  if (!email || !pass) return alert("Please fill all fields");

  btn.innerHTML = '<div class="loading-spinner"></div>Logging in...';
  btn.disabled = true;

  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem("twoDotsToken", data.token);
    localStorage.setItem("twoDotsUser", JSON.stringify(data.user));
    alert("Welcome back, " + (data.user.name?.split(" ")[0] || "User") + "!");
    location.href = "account.html";
  } catch (err) { alert(err.message); }

  btn.innerHTML = 'Login Now';
  btn.disabled = false;
}

// ── ORDERS ────────────────────────────────────────────
async function placeOrderAPI(orderData) {
  const token = getToken();
  if (!token) { alert("Please login to place an order"); location.href = "login.html"; return { success: false }; }
  try {
    const res = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(orderData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Order failed");
    return { success: true, orderId: data.orderId };
  } catch (err) { return { success: false, error: err.message }; }
}

async function fetchOrders() {
  try {
    const res = await fetch(`${BASE_URL}/orders`, { headers: authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// ── PROFILE ───────────────────────────────────────────
async function saveProfileAPI(profileData) {
  try {
    const res = await fetch(`${BASE_URL}/profile`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(profileData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update failed");
    localStorage.setItem("twoDotsUser", JSON.stringify(data.user));
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// ── FEEDBACK ──────────────────────────────────────────
async function submitFeedbackAPI(text) {
  try {
    const res = await fetch(`${BASE_URL}/feedback`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// ── PROFILE ICON ──────────────────────────────────────
function updateProfileIcon() {
  const user   = JSON.parse(localStorage.getItem("twoDotsUser") || "{}");
  const btn    = document.getElementById("profileBottomBtn");
  const avatar = document.getElementById("profileAvatarImg");
  const text   = document.getElementById("profileText");
  if (!btn) return;

  if (user.email) {
    const photo = user.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name||"You")}&background=00d4c4&color=fff&bold=true&size=128`;
    if (avatar) avatar.src = photo;
    if (text)   text.textContent = user.name?.split(" ")[0] || "Account";
    btn.href = "account.html";
    btn.classList.add("active");
  } else {
    if (avatar) avatar.src = "https://ui-avatars.com/api/?name=?&background=ddd&color=999&bold=true";
    if (text)   text.textContent = "Account";
    btn.href = "login.html";
    btn.classList.remove("active");
  }
}

// ── WISHLIST ──────────────────────────────────────────
window.toggleWishlist = (product) => {
  let wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");
  const exists = wishlist.find(p => p.id === product.id);
  if (exists) { wishlist = wishlist.filter(p => p.id !== product.id); alert("Removed from wishlist"); }
  else { wishlist.push(product); alert("Added to wishlist!"); }
  localStorage.setItem("wishlist", JSON.stringify(wishlist));
  document.dispatchEvent(new Event("wishlistUpdated"));
};

// ── PRODUCT SECTIONS ──────────────────────────────────
let allProducts = [];

function renderSection(id, arr) {
  const container = document.getElementById(id);
  if (!container || arr.length === 0) return;
  container.innerHTML = arr.slice(0, 10).map(p => `
    <a href="product.html?id=${p.id}" class="product-card" style="text-decoration:none;color:inherit;">
      <div style="position:relative;">
        <img src="${p.image}" loading="lazy" alt="${p.name}">
        ${p.new ? `<div class="new-tag" style="position:absolute;top:16px;left:16px;background:#d4af37;color:#000;padding:8px 16px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;z-index:2;">NEW</div>` : ''}
      </div>
      <div class="info">
        <p class="name">${p.name}</p>
        <div class="price-row">
          <span class="price">₹${p.price}</span>
          ${p.oldPrice ? `<span class="old-price">₹${p.oldPrice}</span>` : ''}
          ${p.discount ? `<span class="discount">${p.discount}</span>` : ''}
        </div>
      </div>
    </a>
  `).join('');
}

function setupCatalogPage(products, byCategory) {
  const urlParams = new URLSearchParams(location.search);
  const filter = urlParams.get("filter");
  let currentList = filter && byCategory[filter] ? byCategory[filter] : [...products];

  const grid    = document.getElementById("catalogGrid");
  const countEl = document.querySelector(".count");

  const render = (items) => {
    if (countEl) countEl.textContent = items.length + " Products";
    if (!grid) return;
    if (items.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:100px;color:#999;">No products found</p>`;
      return;
    }
    grid.innerHTML = items.map(p => `
      <a href="product.html?id=${p.id}" class="catalog-card">
        <div style="position:relative;">
          <img src="${p.image}" alt="${p.name}">
          ${p.new ? `<div class="luxury-badge" style="position:absolute;top:16px;left:16px;background:#d4af37;color:#000;padding:8px 16px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;z-index:2;">NEW</div>` : ''}
        </div>
        <div class="card-info">
          <h3>${p.name}</h3>
          <div class="price-row">
            <span class="price">₹${p.price}</span>
            ${p.oldPrice ? `<span class="old-price">₹${p.oldPrice}</span>` : ''}
            ${p.discount ? `<span class="discount">${p.discount}</span>` : ''}
          </div>
        </div>
      </a>
    `).join('');
  };

  render(currentList);

  document.querySelectorAll(".pill").forEach(pill => {
    pill.addEventListener("click", function() {
      document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
      this.classList.add("active");
      const val = this.dataset.sort;
      let sorted = [...currentList];
      if (val === "priceLow")  sorted.sort((a, b) => a.price - b.price);
      if (val === "priceHigh") sorted.sort((a, b) => b.price - a.price);
      if (val === "new")       sorted = sorted.filter(p => p.new);
      render(sorted);
    });
  });

  document.getElementById("filterBtn")?.addEventListener("click", () => {
    document.getElementById("filterPanel").classList.add("active");
    document.getElementById("filterOverlay").classList.add("active");
    document.body.style.overflow = "hidden";
  });
  ["closeFilter", "filterOverlay"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", () => {
      document.getElementById("filterPanel").classList.remove("active");
      document.getElementById("filterOverlay").classList.remove("active");
      document.body.style.overflow = "auto";
    });
  });
}

// ── HERO SLIDER ───────────────────────────────────────
function initHeroSlider() {
  const heroSlider = document.getElementById("heroSlider");
  if (!heroSlider) return;
  const wrapper = heroSlider.querySelector(".slides-wrapper");
  const slides  = heroSlider.querySelectorAll(".slide");
  const dots    = heroSlider.querySelectorAll(".dot");
  let currentIndex = 0, autoPlay, startX = 0, startY = 0, isScrolling = false;

  const goToSlide = (index) => {
    wrapper.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
    currentIndex = index;
  };
  const startAutoPlay = () => { autoPlay = setInterval(() => goToSlide((currentIndex + 1) % slides.length), 5000); };
  const stopAutoPlay  = () => clearInterval(autoPlay);

  dots.forEach((dot, i) => dot.addEventListener("click", () => { goToSlide(i); stopAutoPlay(); startAutoPlay(); }));
  heroSlider.addEventListener("touchstart", e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; isScrolling = false; stopAutoPlay(); }, { passive: true });
  heroSlider.addEventListener("touchmove", e => {
    const diffX = Math.abs(e.touches[0].clientX - startX);
    const diffY = Math.abs(e.touches[0].clientY - startY);
    if (diffY > diffX) { isScrolling = true; return; }
    if (!isScrolling) e.preventDefault();
  }, { passive: false });
  heroSlider.addEventListener("touchend", e => {
    if (!isScrolling) {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) diff > 0 ? goToSlide((currentIndex + 1) % slides.length) : goToSlide((currentIndex - 1 + slides.length) % slides.length);
    }
    startX = 0; startY = 0; isScrolling = false; startAutoPlay();
  });
  goToSlide(0);
  startAutoPlay();
}

// ── HAMBURGER MENU ────────────────────────────────────
function initHamburgerMenu() {
  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.add("active");
    document.getElementById("overlay").classList.add("active");
  });
  ["closeBtn", "overlay"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", () => {
      document.getElementById("sidebar").classList.remove("active");
      document.getElementById("overlay").classList.remove("active");
    });
  });
}

// ── MAIN INIT ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  updateProfileIcon();
  if (document.getElementById("cartItems")) renderCart();
  window.addEventListener("storage", (e) => { if (e.key === "twoDotsUser") updateProfileIcon(); });

  fetch(`${BASE_URL}/products`)
    .then(res => res.json())
    .then(data => {
      allProducts = data.map(p => ({ ...p, new: p.new === true, color: p.color || "black", price: parseInt(p.price) || 0 }));
      const byCategory = {
        printed:   allProducts.filter(p => p.category === "printed"),
        women:     allProducts.filter(p => p.category === "women"),
        oversized: allProducts.filter(p => p.category === "oversized"),
        simple:    allProducts.filter(p => p.category === "simple"),
        new:       allProducts.filter(p => p.new)
      };
      if (document.getElementById("new")) {
        renderSection("new", byCategory.new);
        renderSection("printed", byCategory.printed);
        renderSection("women", byCategory.women);
        renderSection("oversized", byCategory.oversized);
      }
      if (document.getElementById("catalogGrid")) setupCatalogPage(allProducts, byCategory);
      initHeroSlider();
      initHamburgerMenu();
    })
    .catch(() => {
      // Fallback to local products.json
      fetch("products.json").then(r => r.json()).then(data => {
        allProducts = data;
        const byCategory = {
          printed:   allProducts.filter(p => p.category === "printed"),
          women:     allProducts.filter(p => p.category === "women"),
          oversized: allProducts.filter(p => p.category === "oversized"),
          simple:    allProducts.filter(p => p.category === "simple"),
          new:       allProducts.filter(p => p.new)
        };
        if (document.getElementById("new")) {
          renderSection("new", byCategory.new);
          renderSection("printed", byCategory.printed);
          renderSection("women", byCategory.women);
          renderSection("oversized", byCategory.oversized);
        }
        if (document.getElementById("catalogGrid")) setupCatalogPage(allProducts, byCategory);
        initHeroSlider();
        initHamburgerMenu();
      });
    });
});

// ── EXPORTS ───────────────────────────────────────────
window.addToCart       = addToCart;
window.removeOne       = removeOne;
window.removeItem      = removeItem;
window.addOne          = addOne;
window.renderCart      = renderCart;
window.updateCartBadge = updateCartBadge;
window.updateProfileIcon = updateProfileIcon;
window.login           = login;
window.signup          = signup;
window.placeOrderAPI   = placeOrderAPI;
window.fetchOrders     = fetchOrders;
window.saveProfileAPI  = saveProfileAPI;
window.submitFeedbackAPI = submitFeedbackAPI;
window.BASE_URL        = BASE_URL;