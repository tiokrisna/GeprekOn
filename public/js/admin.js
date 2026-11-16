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
  } = window.GeprekOn;

  const SECTIONS = {
    overview: {
      title: 'Ringkasan',
      subtitle: 'Pantau pengguna dan kondisi katalog GeprekOn.',
    },
    users: {
      title: 'Kelola pengguna',
      subtitle: 'Atur akun admin, seller, dan pembeli.',
    },
    categories: {
      title: 'Kategori',
      subtitle: 'Kelola kategori yang tampil di katalog dan form seller.',
    },
    settings: {
      title: 'Pengaturan toko',
      subtitle: 'Nama toko, WhatsApp, dan informasi katalog.',
    },
  };

  let admin = null;
  let users = [];
  let categories = [];
  let overviewProducts = [];
  let editingUserId = null;
  let passwordTargetId = null;

  const userModal = document.getElementById('userModal');
  const passwordModal = document.getElementById('passwordModal');
  const userForm = document.getElementById('userForm');
  const userFormError = document.getElementById('userFormError');
  const passwordForm = document.getElementById('passwordForm');
  const passwordFormError = document.getElementById('passwordFormError');
  const userSubmitButton = document.getElementById('userSubmitButton');
  const passwordSubmitButton = document.getElementById('passwordSubmitButton');

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

  function showFormError(element, message) {
    element.textContent = message;
    element.classList.add('visible');
  }

  function clearFormError(element) {
    element.textContent = '';
    element.classList.remove('visible');
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${value.replace(' ', 'T')}Z`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
    document.getElementById('userName').textContent = admin.name;
    document.getElementById('userAvatar').textContent = initials(admin.name);
  }

  function paintStory(store) {
    if (!store) return;
    document.getElementById('infoStoreName').textContent = store.store_name || '—';
    document.getElementById('infoWhatsapp').textContent = store.whatsapp_number
      ? whatsappDisplay(store.whatsapp_number)
      : 'Belum diatur';
    document.getElementById('infoAddress').textContent = store.store_address || '—';
    document.getElementById('infoHours').textContent = store.store_open_hours || '—';

    document.getElementById('storeNameInput').value = store.store_name || '';
    document.getElementById('whatsappInput').value = store.whatsapp_number || '';
    document.getElementById('addressInput').value = store.store_address || '';
    document.getElementById('hoursInput').value = store.store_open_hours || '';
  }

  function paintStats(stats, store) {
    document.getElementById('statUsers').textContent = formatNumber(stats.users.total);
    document.getElementById('statUsersNote').textContent =
      `${formatNumber(stats.users.admins)} admin`;
    document.getElementById('statSellers').textContent = formatNumber(stats.users.sellers);
    document.getElementById('statBuyers').textContent = formatNumber(stats.users.buyers);
    document.getElementById('statProducts').textContent = formatNumber(stats.products);
    document.getElementById('statStock').textContent = formatNumber(stats.total_stock);
    document.getElementById('statInactive').textContent = formatNumber(stats.users.inactive);
    document.getElementById('statCategories').textContent =
      `${formatNumber(stats.categories)} kategori`;
    paintStory(store);
  }

  function paintOverviewProducts() {
    const body = document.getElementById('overviewProducts');
    body.replaceChildren();

    if (overviewProducts.length === 0) {
      body.append(emptyRow(5, 'Belum ada produk di katalog.'));
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const product of overviewProducts) {
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
      if (product.featured) {
        const featured = document.createElement('span');
        featured.textContent = 'Unggulan';
        text.append(featured);
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

      const sellerCell = document.createElement('td');
      sellerCell.textContent = product.seller_name;
      row.append(sellerCell);

      const priceCell = document.createElement('td');
      priceCell.className = 'nowrap';
      priceCell.textContent = formatRupiah(product.price);
      row.append(priceCell);

      const stockCell = document.createElement('td');
      stockCell.className = 'nowrap';
      stockCell.textContent = formatNumber(product.stock);
      if (product.stock < 5) stockCell.classList.add('muted');
      row.append(stockCell);

      fragment.append(row);
    }
    body.append(fragment);
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

  function paintUsers() {
    const body = document.getElementById('usersTable');
    body.replaceChildren();

    if (users.length === 0) {
      body.append(emptyRow(6, 'Belum ada pengguna.'));
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const user of users) {
      const row = document.createElement('tr');

      const userCell = document.createElement('td');
      const main = document.createElement('div');
      main.className = 'cell-main';
      const avatar = document.createElement('span');
      avatar.className = 'avatar';
      avatar.textContent = initials(user.name);
      const text = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = user.name;
      const email = document.createElement('span');
      email.textContent = user.email;
      text.append(strong, email);
      main.append(avatar, text);
      userCell.append(main);
      row.append(userCell);

      const roleCell = document.createElement('td');
      const role = document.createElement('span');
      role.className = `badge role-badge ${user.role}`;
      role.textContent =
        user.role === 'admin' ? 'Admin' : user.role === 'seller' ? 'Seller' : 'Pembeli';
      roleCell.append(role);
      row.append(roleCell);

      const statusCell = document.createElement('td');
      const status = document.createElement('span');
      status.className = `status-dot${user.is_active ? '' : ' off'}`;
      status.textContent = user.is_active ? 'Aktif' : 'Nonaktif';
      statusCell.append(status);
      row.append(statusCell);

      const productCell = document.createElement('td');
      productCell.textContent = user.role === 'seller' ? formatNumber(user.product_count) : '—';
      row.append(productCell);

      const createdCell = document.createElement('td');
      createdCell.className = 'nowrap muted';
      createdCell.textContent = formatDate(user.created_at);
      row.append(createdCell);

      const actionsCell = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'table-actions';

      actions.append(
        actionButton('Edit', 'edit', 'btn-outline', () => openUserModal(user)),
        actionButton('Password', 'key', 'btn-outline', () => openPasswordModal(user))
      );

      const deleteButton = actionButton('Hapus', 'trash', 'btn-danger', () => {
        const warning =
          user.role === 'seller' && user.product_count > 0
            ? ` Semua ${user.product_count} produk seller ini juga akan terhapus.`
            : '';
        if (
          window.confirm(
            `Hapus akun ${user.name} (${user.email})?${warning} Tindakan ini tidak dapat dibatalkan.`
          )
        ) {
          deleteUser(user);
        }
      });
      if (user.id === admin.id) {
        deleteButton.disabled = true;
        deleteButton.title = 'Tidak dapat menghapus akun sendiri';
      }
      actions.append(deleteButton);

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
      body.append(emptyRow(3, 'Belum ada kategori.'));
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

  /* Data loading ---------------------------------------------------------- */
  async function loadStats() {
    const data = await request('/api/admin/stats');
    paintStats(data.stats, data.store);
  }

  async function loadUsers() {
    const data = await request('/api/admin/users');
    users = data.users;
    paintUsers();
  }

  async function loadCategories() {
    const data = await request('/api/admin/categories');
    categories = data.categories;
    paintCategories();
  }

  async function loadOverviewProducts() {
    const data = await request('/api/admin/products');
    overviewProducts = data.products;
    paintOverviewProducts();
  }

  async function refreshAll() {
    try {
      await Promise.all([
        loadStats(),
        loadUsers(),
        loadCategories(),
        loadOverviewProducts(),
      ]);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        window.location.replace('/login?next=/admin');
        return;
      }
      toast(error.message, 'error');
    }
  }

  /* User actions ---------------------------------------------------------- */
  function openUserModal(user = null) {
    editingUserId = user ? user.id : null;
    clearFormError(userFormError);
    userForm.reset();

    document.getElementById('userModalTitle').textContent = user
      ? 'Edit pengguna'
      : 'Tambah pengguna';
    document.getElementById('userModalSubtitle').textContent = user
      ? 'Perbarui data, peran, atau status akun.'
      : 'Buat akun baru dan tentukan perannya.';

    document.getElementById('userNameInput').value = user ? user.name : '';
    document.getElementById('userEmailInput').value = user ? user.email : '';
    document.getElementById('userRoleInput').value = user ? user.role : 'seller';
    document.getElementById('userActiveInput').checked = user ? user.is_active : true;
    document.getElementById('userPasswordField').hidden = Boolean(user);
    document.getElementById('userPasswordInput').required = !user;
    document.getElementById('userPasswordInput').value = '';
    userSubmitButton.textContent = user ? 'Simpan perubahan' : 'Simpan pengguna';

    userModal.showModal();
    document.getElementById('userNameInput').focus();
  }

  function openPasswordModal(user) {
    passwordTargetId = user.id;
    passwordForm.reset();
    clearFormError(passwordFormError);
    document.getElementById('passwordModalSubtitle').textContent =
      `Atur password baru untuk ${user.name} (${user.email}).`;
    passwordModal.showModal();
    document.getElementById('newPasswordInput').focus();
  }

  async function deleteUser(user) {
    try {
      await request(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      toast(`Akun ${user.name} dihapus.`);
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  userForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError(userFormError);

    const payload = {
      name: document.getElementById('userNameInput').value.trim(),
      email: document.getElementById('userEmailInput').value.trim(),
      role: document.getElementById('userRoleInput').value,
      is_active: document.getElementById('userActiveInput').checked,
    };
    const password = document.getElementById('userPasswordInput').value;

    if (payload.name.length < 2) {
      showFormError(userFormError, 'Nama minimal 2 karakter.');
      return;
    }
    if (!payload.email) {
      showFormError(userFormError, 'Email wajib diisi.');
      return;
    }
    if (!editingUserId && password.length < 8) {
      showFormError(userFormError, 'Password awal minimal 8 karakter.');
      return;
    }

    userSubmitButton.disabled = true;
    userSubmitButton.textContent = 'Menyimpan…';

    try {
      if (editingUserId) {
        await request(`/api/admin/users/${editingUserId}`, {
          method: 'PUT',
          body: payload,
        });
        toast('Data pengguna diperbarui.');
      } else {
        await request('/api/admin/users', {
          method: 'POST',
          body: { ...payload, password },
        });
        toast('Pengguna baru ditambahkan.');
      }
      userModal.close();
      await refreshAll();
    } catch (error) {
      showFormError(userFormError, error.message);
    } finally {
      userSubmitButton.disabled = false;
      userSubmitButton.textContent = editingUserId
        ? 'Simpan perubahan'
        : 'Simpan pengguna';
    }
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError(passwordFormError);

    const password = document.getElementById('newPasswordInput').value;
    if (password.length < 8) {
      showFormError(passwordFormError, 'Password baru minimal 8 karakter.');
      return;
    }

    passwordSubmitButton.disabled = true;
    passwordSubmitButton.textContent = 'Menyimpan…';
    try {
      await request(`/api/admin/users/${passwordTargetId}/password`, {
        method: 'PUT',
        body: { password },
      });
      toast('Password pengguna diperbarui.');
      passwordModal.close();
    } catch (error) {
      showFormError(passwordFormError, error.message);
    } finally {
      passwordSubmitButton.disabled = false;
      passwordSubmitButton.textContent = 'Simpan password';
    }
  });

  document.getElementById('addUserButton').addEventListener('click', () => openUserModal());

  /* Categories ------------------------------------------------------------ */
  async function addCategory() {
    const input = document.getElementById('newCategoryName');
    const name = input.value.trim();
    if (name.length < 2) {
      toast('Nama kategori minimal 2 karakter.', 'error');
      input.focus();
      return;
    }
    try {
      await request('/api/admin/categories', {
        method: 'POST',
        body: { name },
      });
      input.value = '';
      toast('Kategori ditambahkan.');
      await Promise.all([loadCategories(), loadStats()]);
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
      await request(`/api/admin/categories/${category.id}`, { method: 'DELETE' });
      toast('Kategori dihapus.');
      await Promise.all([loadCategories(), loadStats()]);
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

  /* Settings -------------------------------------------------------------- */
  document.getElementById('whatsappInput').addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '');
  });

  document.getElementById('settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = document.getElementById('settingsError');
    const button = document.getElementById('saveSettingsButton');
    clearFormError(errorBox);

    const payload = {
      store_name: document.getElementById('storeNameInput').value.trim(),
      whatsapp_number: document.getElementById('whatsappInput').value.trim(),
      store_address: document.getElementById('addressInput').value.trim(),
      store_open_hours: document.getElementById('hoursInput').value.trim(),
    };

    if (payload.store_name.length < 2) {
      showFormError(errorBox, 'Nama toko minimal 2 karakter.');
      return;
    }

    button.disabled = true;
    button.textContent = 'Menyimpan…';
    try {
      const data = await request('/api/admin/settings', {
        method: 'PUT',
        body: payload,
      });
      paintStory(data.store);
      toast('Pengaturan toko disimpan.');
    } catch (error) {
      showFormError(errorBox, error.message);
    } finally {
      button.disabled = false;
      button.textContent = 'Simpan pengaturan';
    }
  });

  /* Boot ------------------------------------------------------------------ */
  document.getElementById('logoutButton').addEventListener('click', () => logout());

  (async function boot() {
    const user = await requireUser('admin');
    if (!user) return;
    admin = user;
    paintSidebar();

    const initial = window.location.hash.replace('#', '');
    activateSection(SECTIONS[initial] ? initial : 'overview');

    await refreshAll();
  })();

  window.addEventListener('hashchange', () => {
    const name = window.location.hash.replace('#', '');
    if (SECTIONS[name]) activateSection(name);
  });

  // Keep the user list fresh if the tab is left open.
  setInterval(() => {
    if (document.visibilityState === 'visible' && admin) {
      loadUsers().catch(() => {});
    }
  }, 60000);
})();
