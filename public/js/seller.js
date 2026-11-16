'use strict';

(function () {
  const {
    icon,
    request,
    formatRupiah,
    formatNumber,
    whatsappDisplay,
    toast,
    initials,
    requireUser,
    logout,
    resizeImage,
  } = window.GeprekOn;

  const SECTIONS = {
    overview: {
      title: 'Ringkasan',
      subtitle: 'Pantau produk dan stok milik toko Anda.',
    },
    products: {
      title: 'Produk saya',
      subtitle: 'Tambah, ubah, dan hapus produk yang tampil di katalog.',
    },
    categories: {
      title: 'Kategori',
      subtitle: 'Kelola kategori yang tersedia untuk produk Anda.',
    },
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  let seller = null;
  let products = [];
  let categories = [];
  let store = {};
  let searchTerm = '';
  let editingProductId = null;
  let imageUrl = '';
  let imageBusy = false;

  const productModal = document.getElementById('productModal');
  const productForm = document.getElementById('productForm');
  const productFormError = document.getElementById('productFormError');
  const productSubmitButton = document.getElementById('productSubmitButton');
  const imagePreview = document.getElementById('imagePreview');
  const imageInput = document.getElementById('productImageInput');
  const imageHint = document.getElementById('imageUploadHint');
  const categorySelect = document.getElementById('productCategoryInput');
  const newCategoryField = document.getElementById('newCategoryField');
  const newCategoryInput = document.getElementById('productNewCategoryInput');

  document.querySelectorAll('[data-icon]').forEach((element) => {
    element.insertAdjacentHTML('afterbegin', icon(element.dataset.icon));
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });

  for (const dialog of document.querySelectorAll('dialog.modal')) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  function showFormError(message) {
    productFormError.textContent = message;
    productFormError.classList.add('visible');
  }

  function clearFormError() {
    productFormError.textContent = '';
    productFormError.classList.remove('visible');
  }

  function emptyRow(columns, message) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = columns;
    cell.className = 'table-empty';
    cell.textContent = message;
    row.append(cell);
    return row;
  }

  function actionButton(label, iconName, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn btn-sm ${className}`;
    button.innerHTML = icon(iconName);
    button.append(document.createTextNode(label));
    button.addEventListener('click', onClick);
    return button;
  }

  /* Navigation ------------------------------------------------------------ */
  function activateSection(name) {
    if (!SECTIONS[name]) return;
    document.querySelectorAll('.dash-section').forEach((section) => {
      section.hidden = section.id !== `section-${name}`;
    });
    document.querySelectorAll('.nav-item[data-section]').forEach((button) => {
      button.classList.toggle('active', button.dataset.section === name);
    });
    document.getElementById('pageTitle').textContent = SECTIONS[name].title;
    document.getElementById('pageSubtitle').textContent = SECTIONS[name].subtitle;
    if (window.location.hash !== `#${name}`) {
      history.replaceState(null, '', `#${name}`);
    }
  }

  document.querySelectorAll('.nav-item[data-section]').forEach((button) => {
    button.addEventListener('click', () => activateSection(button.dataset.section));
  });

  /* Rendering ------------------------------------------------------------- */
  function paintSidebar() {
    document.getElementById('userName').textContent = seller.name;
    document.getElementById('userAvatar').textContent = initials(seller.name);
  }

  function paintStore() {
    document.getElementById('infoStoreName').textContent = store.store_name || '—';
    document.getElementById('infoWhatsapp').textContent = store.whatsapp_number
      ? whatsappDisplay(store.whatsapp_number)
      : 'Belum diatur admin';
    document.getElementById('infoAddress').textContent = store.store_address || '—';
    document.getElementById('infoHours').textContent = store.store_open_hours || '—';
  }

  function paintStats(stats) {
    document.getElementById('statProducts').textContent = formatNumber(
      stats.total_products
    );
    document.getElementById('statStock').textContent = formatNumber(stats.total_stock);
    document.getElementById('statLowStock').textContent = formatNumber(stats.low_stock);
    document.getElementById('statCategories').textContent = formatNumber(
      stats.total_categories
    );
    document.getElementById('statFeatured').textContent = formatNumber(
      stats.featured_products
    );
  }

  function paintLowStock() {
    const body = document.getElementById('lowStockTable');
    body.replaceChildren();
    const low = products
      .filter((product) => product.stock < 5)
      .sort((a, b) => a.stock - b.stock);

    if (low.length === 0) {
      body.append(emptyRow(4, 'Semua produk memiliki stok yang cukup.'));
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const product of low) {
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = product.name;
      nameCell.append(strong);
      row.append(nameCell);

      const categoryCell = document.createElement('td');
      categoryCell.textContent = product.category_name;
      row.append(categoryCell);

      const stockCell = document.createElement('td');
      stockCell.textContent = formatNumber(product.stock);
      row.append(stockCell);

      const statusCell = document.createElement('td');
      const status = document.createElement('span');
      status.className = 'status-dot off';
      status.textContent = product.stock === 0 ? 'Habis' : 'Menipis';
      statusCell.append(status);
      row.append(statusCell);

      fragment.append(row);
    }
    body.append(fragment);
  }

  function paintProducts() {
    const body = document.getElementById('productsTable');
    body.replaceChildren();

    const term = searchTerm.toLowerCase();
    const filtered = products.filter((product) => {
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.category_name.toLowerCase().includes(term)
      );
    });

    if (filtered.length === 0) {
      body.append(
        emptyRow(
          6,
          products.length === 0
            ? 'Belum ada produk. Tambahkan produk pertama Anda.'
            : 'Tidak ada produk yang cocok dengan pencarian.'
        )
      );
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const product of filtered) {
      const row = document.createElement('tr');

      const productCell = document.createElement('td');
      const main = document.createElement('div');
      main.className = 'cell-main';
      const image = document.createElement('img');
      image.className = 'thumb';
      image.src = product.image_url || '/img/products/placeholder.svg';
      image.alt = '';
      image.loading = 'lazy';
      const text = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = product.name;
      text.append(strong);
      if (product.description) {
        const description = document.createElement('span');
        description.textContent = product.description;
        text.append(description);
      }
      main.append(image, text);
      productCell.append(main);
      row.append(productCell);

      const categoryCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'badge badge-category';
      badge.textContent = product.category_name;
      categoryCell.append(badge);
      row.append(categoryCell);

      const priceCell = document.createElement('td');
      priceCell.className = 'nowrap';
      priceCell.textContent = formatRupiah(product.price);
      row.append(priceCell);

      const stockCell = document.createElement('td');
      stockCell.className = 'nowrap';
      stockCell.textContent = formatNumber(product.stock);
      if (product.stock < 5) stockCell.classList.add('muted');
      row.append(stockCell);

      const featuredCell = document.createElement('td');
      if (product.featured) {
        const featured = document.createElement('span');
        featured.className = 'badge badge-featured';
        featured.textContent = 'Unggulan';
        featuredCell.append(featured);
      } else {
        featuredCell.textContent = '—';
        featuredCell.classList.add('muted');
      }
      row.append(featuredCell);

      const actionsCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'table-actions';
      actions.append(
        actionButton('Edit', 'edit', 'btn-outline', () => openProductModal(product)),
        actionButton('Hapus', 'trash', 'btn-danger', () => deleteProduct(product))
      );
      actionsCell.append(actions);
      row.append(actionsCell);
      fragment.append(row);
    }
    body.append(fragment);
  }

  function paintCategories() {
    const body = document.getElementById('categoriesTable');
    body.replaceChildren();

    if (categories.length === 0) {
      body.append(emptyRow(3, 'Belum ada kategori. Tambahkan kategori pertama.'));
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const category of categories) {
      const row = document.createElement('tr');

      const nameCell = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = category.name;
      nameCell.append(strong);
      row.append(nameCell);

      const countCell = document.createElement('td');
      countCell.textContent = `${formatNumber(category.product_count)} produk`;
      row.append(countCell);

      const actionsCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'table-actions';
      actions.append(
        actionButton('Hapus', 'trash', 'btn-danger', () => deleteCategory(category))
      );
      actionsCell.append(actions);
      row.append(actionsCell);
      fragment.append(row);
    }
    body.append(fragment);
  }

  function paintCategoryOptions() {
    const current = categorySelect.value;
    categorySelect.replaceChildren();

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Pilih kategori';
    categorySelect.append(placeholder);

    for (const category of categories) {
      const option = document.createElement('option');
      option.value = String(category.id);
      option.textContent = category.name;
      categorySelect.append(option);
    }

    if (current && categories.some((category) => String(category.id) === current)) {
      categorySelect.value = current;
    }
  }

  /* Data loading ---------------------------------------------------------- */
  async function loadStats() {
    const data = await request('/api/seller/stats');
    paintStats(data.stats);
  }

  async function loadProducts() {
    const data = await request('/api/seller/products');
    products = data.products;
    paintProducts();
    paintLowStock();
  }

  async function loadCategories() {
    const data = await request('/api/seller/categories');
    categories = data.categories;
    paintCategories();
    paintCategoryOptions();
  }

  async function loadStore() {
    const data = await request('/api/store');
    store = data.store;
    paintStore();
  }

  async function refreshAll() {
    try {
      await Promise.all([loadStats(), loadProducts(), loadCategories(), loadStore()]);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        window.location.replace('/login?next=/seller');
        return;
      }
      toast(error.message, 'error');
    }
  }

  /* Images ---------------------------------------------------------------- */
  function paintImagePreview() {
    imagePreview.replaceChildren();
    imagePreview.classList.remove('is-busy');

    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = 'Pratinjau gambar produk';
      imagePreview.append(image);
    } else {
      imagePreview.append(document.createTextNode('Belum ada gambar'));
    }

    document.getElementById('removeImageButton').disabled = !imageUrl || imageBusy;
  }

  async function handleImageFile(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast('Format gambar harus JPG, PNG, atau WebP.', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast('Ukuran file asli maksimal 10 MB.', 'error');
      return;
    }

    imageBusy = true;
    imageHint.textContent = 'Memproses dan mengunggah gambar…';
    document.getElementById('pickImageButton').disabled = true;
    document.getElementById('removeImageButton').disabled = true;

    try {
      const resized = await resizeImage(file, 1280, 0.82);
      const formData = new FormData();
      formData.append('image', resized);
      const data = await request('/api/uploads', {
        method: 'POST',
        formData,
      });
      imageUrl = data.url;
      toast('Gambar berhasil diunggah.');
      imageHint.textContent =
        'JPG, PNG, atau WebP. Gambar diperkecil otomatis sebelum diunggah.';
    } catch (error) {
      toast(error.message, 'error');
      imageHint.textContent = 'Gagal memproses gambar. Coba file lain.';
    } finally {
      imageBusy = false;
      document.getElementById('pickImageButton').disabled = false;
      paintImagePreview();
      imageInput.value = '';
    }
  }

  /* Product modal --------------------------------------------------------- */
  function openProductModal(product = null) {
    editingProductId = product ? product.id : null;
    clearFormError();
    productForm.reset();
    newCategoryField.hidden = true;
    newCategoryInput.value = '';

    document.getElementById('productModalTitle').textContent = product
      ? 'Edit produk'
      : 'Tambah produk';
    document.getElementById('productModalSubtitle').textContent = product
      ? 'Perbarui detail produk. Perubahan langsung tampil di katalog.'
      : 'Lengkapi detail produk untuk ditampilkan di katalog.';

    document.getElementById('productNameInput').value = product ? product.name : '';
    document.getElementById('productPriceInput').value = product ? product.price : '';
    document.getElementById('productStockInput').value = product ? product.stock : '';
    document
      .getElementById('productDescriptionInput')
      .value = product ? product.description : '';
    document.getElementById('productFeaturedInput').checked = product
      ? product.featured
      : false;

    paintCategoryOptions();
    categorySelect.value = product ? String(product.category_id) : '';
    imageUrl = product ? product.image_url || '' : '';
    paintImagePreview();
    productSubmitButton.textContent = product ? 'Simpan perubahan' : 'Simpan produk';

    productModal.showModal();
    document.getElementById('productNameInput').focus();
  }

  async function deleteProduct(product) {
    if (
      !window.confirm(
        `Hapus produk "${product.name}"? Produk akan hilang dari katalog.`
      )
    ) {
      return;
    }
    try {
      await request(`/api/seller/products/${product.id}`, { method: 'DELETE' });
      toast('Produk dihapus.');
      await Promise.all([loadProducts(), loadStats(), loadCategories()]);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  productForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError();

    const name = document.getElementById('productNameInput').value.trim();
    const categoryId = categorySelect.value;
    const priceText = document.getElementById('productPriceInput').value.trim();
    const stockText = document.getElementById('productStockInput').value.trim();
    const description = document
      .getElementById('productDescriptionInput')
      .value.trim();
    const featured = document.getElementById('productFeaturedInput').checked;

    if (name.length === 0) {
      showFormError('Nama produk wajib diisi.');
      return;
    }
    if (!categoryId) {
      showFormError('Pilih kategori produk terlebih dahulu.');
      return;
    }
    if (!/^\d+$/.test(priceText) || Number(priceText) > 1_000_000_000) {
      showFormError('Harga harus angka bulat 0 atau lebih.');
      return;
    }
    if (!/^\d+$/.test(stockText) || Number(stockText) > 1_000_000_000) {
      showFormError('Stok harus bilangan bulat 0 atau lebih.');
      return;
    }
    if (imageBusy) {
      showFormError('Tunggu proses unggah gambar selesai.');
      return;
    }

    const payload = {
      name,
      category_id: Number(categoryId),
      price: Number(priceText),
      stock: Number(stockText),
      description,
      featured,
      image_url: imageUrl,
    };

    productSubmitButton.disabled = true;
    productSubmitButton.textContent = 'Menyimpan…';

    try {
      if (editingProductId) {
        await request(`/api/seller/products/${editingProductId}`, {
          method: 'PUT',
          body: payload,
        });
        toast('Produk diperbarui.');
      } else {
        await request('/api/seller/products', { method: 'POST', body: payload });
        toast('Produk baru ditambahkan.');
      }
      productModal.close();
      await Promise.all([loadProducts(), loadStats(), loadCategories()]);
    } catch (error) {
      showFormError(error.message);
    } finally {
      productSubmitButton.disabled = false;
      productSubmitButton.textContent = editingProductId
        ? 'Simpan perubahan'
        : 'Simpan produk';
    }
  });

  document.getElementById('addProductButton').addEventListener('click', () => {
    if (categories.length === 0) {
      toast('Tambahkan kategori terlebih dahulu.', 'error');
      activateSection('categories');
      return;
    }
    openProductModal();
  });

  document.getElementById('productSearch').addEventListener('input', (event) => {
    searchTerm = event.target.value.trim();
    paintProducts();
  });

  document.getElementById('openProductsFromLow').addEventListener('click', () => {
    activateSection('products');
  });

  /* Image controls -------------------------------------------------------- */
  document.getElementById('pickImageButton').addEventListener('click', () => {
    imageInput.click();
  });

  imageInput.addEventListener('change', () => {
    const [file] = imageInput.files;
    handleImageFile(file);
  });

  document.getElementById('removeImageButton').addEventListener('click', () => {
    imageUrl = '';
    imageInput.value = '';
    paintImagePreview();
  });

  /* Inline category creation --------------------------------------------- */
  document.getElementById('toggleNewCategory').addEventListener('click', () => {
    newCategoryField.hidden = !newCategoryField.hidden;
    if (!newCategoryField.hidden) newCategoryInput.focus();
  });

  async function createCategoryInline() {
    const name = newCategoryInput.value.trim();
    if (name.length < 2) {
      toast('Nama kategori minimal 2 karakter.', 'error');
      newCategoryInput.focus();
      return;
    }
    try {
      const data = await request('/api/seller/categories', {
        method: 'POST',
        body: { name },
      });
      await loadCategories();
      categorySelect.value = String(data.category.id);
      newCategoryInput.value = '';
      newCategoryField.hidden = true;
      toast('Kategori ditambahkan.');
      await loadStats();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  document
    .getElementById('createCategoryInline')
    .addEventListener('click', createCategoryInline);
  newCategoryInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      createCategoryInline();
    }
  });

  /* Category section ------------------------------------------------------ */
  async function addCategory() {
    const input = document.getElementById('newCategoryName');
    const name = input.value.trim();
    if (name.length < 2) {
      toast('Nama kategori minimal 2 karakter.', 'error');
      input.focus();
      return;
    }
    try {
      await request('/api/seller/categories', {
        method: 'POST',
        body: { name },
      });
      input.value = '';
      toast('Kategori ditambahkan.');
      await loadCategories();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function deleteCategory(category) {
    if (
      !window.confirm(
        `Hapus kategori "${category.name}"? Kategori yang masih dipakai produk tidak dapat dihapus.`
      )
    ) {
      return;
    }
    try {
      await request(`/api/seller/categories/${category.id}`, { method: 'DELETE' });
      toast('Kategori dihapus.');
      await loadCategories();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  document.getElementById('addCategoryButton').addEventListener('click', addCategory);
  document.getElementById('newCategoryName').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCategory();
    }
  });

  /* Input sanitising ------------------------------------------------------ */
  for (const id of ['productPriceInput', 'productStockInput']) {
    document.getElementById(id).addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '');
    });
  }

  /* Boot ------------------------------------------------------------------ */
  document.getElementById('logoutButton').addEventListener('click', () => logout());

  (async function boot() {
    const user = await requireUser('seller');
    if (!user) return;
    seller = user;
    paintSidebar();

    const initial = window.location.hash.replace('#', '');
    activateSection(SECTIONS[initial] ? initial : 'overview');

    await refreshAll();
  })();

  window.addEventListener('hashchange', () => {
    const name = window.location.hash.replace('#', '');
    if (SECTIONS[name]) activateSection(name);
  });

  setInterval(() => {
    if (document.visibilityState === 'visible' && seller) {
      loadProducts().catch(() => {});
      loadStats().catch(() => {});
    }
  }, 60000);
})();
