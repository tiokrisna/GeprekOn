'use strict';

(function () {
  const {
    icon,
    request,
    formatRupiah,
    formatNumber,
    whatsappLink,
    whatsappDisplay,
    debounce,
    currentUser,
    logout,
    dashboardFor,
    toast,
  } = window.GeprekOn;

  const PLACEHOLDER = '/img/products/placeholder.svg';

  const state = {
    search: '',
    category: 'all',
    sort: 'featured',
    categories: [],
    store: {
      store_name: 'GeprekOn',
      whatsapp_number: '',
      store_address: '',
      store_open_hours: '',
    },
  };

  const grid = document.getElementById('productGrid');
  const chips = document.getElementById('categoryChips');
  const resultCount = document.getElementById('resultCount');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');

  document.querySelectorAll('[data-icon]').forEach((element) => {
    element.insertAdjacentHTML('afterbegin', icon(element.dataset.icon));
  });
  document.getElementById('year').textContent = new Date().getFullYear();

  function emptyState({ title, text, withReset }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'empty-state';

    const iconBox = document.createElement('div');
    iconBox.className = 'empty-icon';
    iconBox.innerHTML = icon('search');
    wrapper.append(iconBox);

    const heading = document.createElement('h3');
    heading.textContent = title;
    wrapper.append(heading);

    const description = document.createElement('p');
    description.textContent = text;
    wrapper.append(description);

    if (withReset) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'btn btn-outline';
      reset.textContent = 'Tampilkan semua menu';
      reset.addEventListener('click', () => {
        state.search = '';
        state.category = 'all';
        state.sort = 'featured';
        searchInput.value = '';
        sortSelect.value = 'featured';
        renderChips();
        loadCatalog();
      });
      wrapper.append(reset);
    }

    return wrapper;
  }

  function renderProducts(products) {
    grid.replaceChildren();

    if (products.length === 0) {
      grid.append(
        emptyState({
          title: 'Menu tidak ditemukan',
          text: 'Coba kata kunci lain atau pilih kategori yang berbeda.',
          withReset: true,
        })
      );
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const product of products) {
      const card = document.createElement('article');
      card.className = 'product-card';

      const media = document.createElement('div');
      media.className = 'product-media';

      const image = document.createElement('img');
      image.src = product.image_url || PLACEHOLDER;
      image.alt = `Foto ${product.name}`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener(
        'error',
        () => {
          image.src = PLACEHOLDER;
        },
        { once: true }
      );
      media.append(image);

      if (product.featured) {
        const featured = document.createElement('span');
        featured.className = 'badge badge-featured';
        featured.textContent = '★ Unggulan';
        media.append(featured);
      }

      const category = document.createElement('span');
      category.className = 'badge badge-category';
      category.textContent = product.category_name;
      media.append(category);
      card.append(media);

      const body = document.createElement('div');
      body.className = 'product-body';

      const title = document.createElement('h3');
      title.textContent = product.name;
      body.append(title);

      const description = document.createElement('p');
      description.className = 'product-desc';
      description.textContent = product.description || 'Tanpa deskripsi.';
      body.append(description);

      const seller = document.createElement('p');
      seller.className = 'product-seller';
      seller.textContent = 'Dijual oleh ';
      const sellerName = document.createElement('strong');
      sellerName.textContent = product.seller_name;
      seller.append(sellerName);
      body.append(seller);

      const foot = document.createElement('div');
      foot.className = 'product-foot';

      const priceBox = document.createElement('div');
      const price = document.createElement('div');
      price.className = 'price';
      price.textContent = formatRupiah(product.price);
      priceBox.append(price);

      const stock = document.createElement('div');
      stock.className = `stock${product.stock > 0 && product.stock < 5 ? ' low' : ''}`;
      stock.textContent =
        product.stock > 0
          ? `Stok ${formatNumber(product.stock)}`
          : 'Stok habis';
      priceBox.append(stock);
      foot.append(priceBox);

      if (product.stock > 0 && state.store.whatsapp_number) {
        const message =
          `Halo ${state.store.store_name}, saya ingin memesan *${product.name}* ` +
          `(${formatRupiah(product.price)}). Apakah stok tersedia?`;
        const link = document.createElement('a');
        link.className = 'btn btn-wa';
        link.href = whatsappLink(state.store.whatsapp_number, message);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute(
          'aria-label',
          `Pesan ${product.name} melalui WhatsApp`
        );
        link.innerHTML = icon('wa');
        link.append(document.createTextNode('Pesan'));
        foot.append(link);
      } else {
        const unavailable = document.createElement('span');
        unavailable.className = 'btn btn-outline';
        unavailable.textContent = product.stock > 0 ? 'WA belum aktif' : 'Habis';
        foot.append(unavailable);
      }

      body.append(foot);
      card.append(body);
      fragment.append(card);
    }

    grid.append(fragment);
  }

  function renderChips() {
    chips.replaceChildren();

    const all = document.createElement('button');
    all.type = 'button';
    all.className = `chip${state.category === 'all' ? ' active' : ''}`;
    all.dataset.category = 'all';
    all.textContent = 'Semua kategori';
    all.addEventListener('click', () => selectCategory('all'));
    chips.append(all);

    for (const category of state.categories) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chip${String(state.category) === String(category.id) ? ' active' : ''}`;
      button.dataset.category = category.id;
      button.textContent = category.name;

      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = category.product_count;
      button.append(count);

      button.addEventListener('click', () => selectCategory(category.id));
      chips.append(button);
    }
  }

  function selectCategory(categoryId) {
    state.category = categoryId;
    renderChips();
    loadCatalog();
  }

  async function loadCatalog() {
    grid.setAttribute('aria-busy', 'true');
    resultCount.textContent = 'Memuat produk…';

    const params = new URLSearchParams();
    if (state.search) params.set('search', state.search);
    if (state.category !== 'all') params.set('category', state.category);
    params.set('sort', state.sort);

    try {
      const data = await request(`/api/catalog?${params.toString()}`);
      state.store = data.store;
      paintStore(data.store);

      resultCount.textContent =
        data.total === 0
          ? 'Tidak ada produk yang cocok'
          : `${data.total} produk ditemukan`;
      renderProducts(data.products);
    } catch (error) {
      grid.replaceChildren();
      resultCount.textContent = 'Gagal memuat katalog';
      grid.append(
        emptyState({
          title: 'Katalog belum bisa dimuat',
          text: error.message,
          withReset: false,
        })
      );
    } finally {
      grid.removeAttribute('aria-busy');
    }
  }

  async function loadCategories() {
    try {
      const data = await request('/api/categories');
      state.categories = data.categories;
      renderChips();
    } catch {
      state.categories = [];
    }
  }

  function paintStore(store) {
    if (!store) return;
    const name = store.store_name || 'GeprekOn';
    document.getElementById('storeAddress').textContent =
      store.store_address || 'Alamat belum diatur';
    document.getElementById('storeHours').textContent =
      store.store_open_hours || 'Jam buka belum diatur';
    document.getElementById('storeWhatsapp').textContent = store.whatsapp_number
      ? whatsappDisplay(store.whatsapp_number)
      : 'Nomor belum diatur';
    document.getElementById('storeNameLabel').textContent = name;

    const button = document.getElementById('storeWhatsappButton');
    if (store.whatsapp_number) {
      button.href = whatsappLink(
        store.whatsapp_number,
        `Halo ${name}, saya ingin bertanya tentang menu di katalog.`
      );
      button.removeAttribute('aria-disabled');
      button.style.removeProperty('opacity');
      button.style.removeProperty('pointer-events');
    } else {
      button.href = '#';
      button.setAttribute('aria-disabled', 'true');
      button.style.opacity = '0.6';
      button.style.pointerEvents = 'none';
    }
  }

  async function paintSession() {
    const container = document.getElementById('authActions');
    const user = await currentUser();
    container.replaceChildren();

    if (!user) {
      const login = document.createElement('a');
      login.className = 'btn btn-ghost';
      login.href = '/login';
      login.textContent = 'Masuk';

      const register = document.createElement('a');
      register.className = 'btn btn-primary';
      register.href = '/login?mode=register';
      register.textContent = 'Daftar';

      container.append(login, register);
      return;
    }

    const pill = document.createElement('span');
    pill.className = 'role-pill';
    const dot = document.createElement('span');
    dot.className = 'dot';
    pill.append(dot);
    const roleLabel =
      user.role === 'admin'
        ? 'Admin'
        : user.role === 'seller'
          ? 'Seller'
          : 'Pembeli';
    pill.append(document.createTextNode(`${roleLabel} · ${user.name}`));
    container.append(pill);

    if (user.role === 'admin' || user.role === 'seller') {
      const dashboard = document.createElement('a');
      dashboard.className = 'btn btn-outline btn-sm';
      dashboard.href = dashboardFor(user.role);
      dashboard.textContent = 'Dashboard';
      container.append(dashboard);
    }

    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'btn btn-ghost btn-sm';
    signOut.innerHTML = icon('logout');
    signOut.append(document.createTextNode('Keluar'));
    signOut.addEventListener('click', () => logout());
    container.append(signOut);
  }

  searchInput.addEventListener(
    'input',
    debounce(() => {
      state.search = searchInput.value.trim();
      loadCatalog();
    }, 280)
  );

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    loadCatalog();
  });

  renderChips();
  paintSession();
  Promise.all([loadCategories(), loadCatalog()]).catch(() => {
    toast('Sebagian data gagal dimuat.', 'error');
  });
})();
