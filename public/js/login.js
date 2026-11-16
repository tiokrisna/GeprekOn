'use strict';

(function () {
  const { request, dashboardFor, toast } = window.GeprekOn;

  const form = document.getElementById('authForm');
  const nameField = document.getElementById('nameField');
  const nameInput = document.getElementById('nameInput');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const passwordHint = document.getElementById('passwordHint');
  const submitButton = document.getElementById('submitButton');
  const formError = document.getElementById('formError');
  const authTitle = document.getElementById('authTitle');
  const authSub = document.getElementById('authSub');
  const authSwitch = document.getElementById('authSwitch');
  const switchButton = document.getElementById('switchButton');
  const tabLogin = document.getElementById('tabLogin');
  const tabRegister = document.getElementById('tabRegister');

  let mode = new URLSearchParams(window.location.search).get('mode') === 'register'
    ? 'register'
    : 'login';

  function showError(message) {
    formError.textContent = message;
    formError.classList.add('visible');
  }

  function clearError() {
    formError.textContent = '';
    formError.classList.remove('visible');
  }

  function setMode(nextMode) {
    mode = nextMode;
    const isRegister = mode === 'register';

    tabLogin.classList.toggle('active', !isRegister);
    tabRegister.classList.toggle('active', isRegister);
    tabLogin.setAttribute('aria-selected', String(!isRegister));
    tabRegister.setAttribute('aria-selected', String(isRegister));

    nameField.hidden = !isRegister;
    nameInput.required = isRegister;
    passwordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
    submitButton.textContent = isRegister ? 'Buat akun pembeli' : 'Masuk';
    passwordHint.textContent = isRegister
      ? 'Buat password minimal 8 karakter.'
      : 'Masukkan password akun Anda.';

    authTitle.textContent = isRegister
      ? 'Daftar sebagai pembeli'
      : 'Masuk ke GeprekOn';
    authSub.textContent = isRegister
      ? 'Akun pembeli hanya dapat melihat katalog dan menghubungi WhatsApp toko.'
      : 'Gunakan akun yang diberikan admin atau akun pembeli Anda.';

    authSwitch.replaceChildren(
      document.createTextNode(
        isRegister ? 'Sudah punya akun? ' : 'Belum punya akun pembeli? '
      )
    );
    const switchLink = document.createElement('button');
    switchLink.type = 'button';
    switchLink.textContent = isRegister ? 'Masuk di sini' : 'Daftar sekarang';
    switchLink.addEventListener('click', () =>
      setMode(isRegister ? 'login' : 'register')
    );
    authSwitch.append(switchLink);

    clearError();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const name = nameInput.value.trim();

    if (!email || !password) {
      showError('Email dan password wajib diisi.');
      return;
    }
    if (mode === 'register' && name.length < 2) {
      showError('Nama minimal 2 karakter.');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      showError('Password minimal 8 karakter.');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent =
      mode === 'register' ? 'Membuat akun…' : 'Memeriksa akun…';

    try {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register' ? { name, email, password } : { email, password };
      const data = await request(path, { method: 'POST', body: payload });

      toast(`Selamat datang, ${data.user.name}.`, 'success');
      const next = new URLSearchParams(window.location.search).get('next');
      const safeNext =
        next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      window.location.href = safeNext || dashboardFor(data.user.role);
    } catch (error) {
      showError(error.message);
      submitButton.disabled = false;
      submitButton.textContent =
        mode === 'register' ? 'Buat akun pembeli' : 'Masuk';
    }
  }

  tabLogin.addEventListener('click', () => setMode('login'));
  tabRegister.addEventListener('click', () => setMode('register'));
  form.addEventListener('submit', handleSubmit);

  document.querySelectorAll('[data-demo-email]').forEach((button) => {
    button.addEventListener('click', () => {
      setMode('login');
      emailInput.value = button.dataset.demoEmail;
      passwordInput.value = button.dataset.demoPassword;
      passwordInput.focus();
      toast('Kredensial demo diisi. Tekan "Masuk" untuk lanjut.', 'success');
    });
  });

  setMode(mode);
  emailInput.focus();
})();
