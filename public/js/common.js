'use strict';

/* Shared helpers: API access, formatting, icons, toasts, session guard. */
(function () {
  const ICONS = {
    wa: '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.27-1.38a9.9 9.9 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.16.83.84-3.08-.2-.32a8.22 8.22 0 0 1-1.26-4.33c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.26.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.14 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z"/>',
    search:
      '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    box: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M3 8v8l9 5 9-5V8"/>',
    tag: '<path d="M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    layers:
      '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.18.4.55.7 1 1h.09a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.55 1Z"/>',
    logout:
      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9"/><path d="m17 6 3 3"/><path d="m14 9 2 2"/>',
    external:
      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
    store:
      '<path d="M3 9 5 3h14l2 6"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v9h14v-9"/><path d="M9 21v-6h6v6"/>',
    alert:
      '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
  };

  function icon(name, className) {
    const path = ICONS[name] || '';
    return `<svg${className ? ` class="${className}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[char];
    });
  }

  async function request(path, { method = 'GET', body, formData } = {}) {
    const options = {
      method,
      credentials: 'same-origin',
      headers: {},
    };
    if (formData) {
      options.body = formData;
    } else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(path, options);
    } catch {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi Anda.');
    }

    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
    }

    if (!response.ok) {
      const error = new Error(data.error || 'Terjadi kesalahan. Coba lagi.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function formatRupiah(value) {
    const number = Number(value) || 0;
    return `Rp ${number.toLocaleString('id-ID')}`;
  }

  function formatNumber(value) {
    return (Number(value) || 0).toLocaleString('id-ID');
  }

  function whatsappLink(number, message) {
    const digits = String(number || '').replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }

  function whatsappDisplay(number) {
    const digits = String(number || '').replace(/\D/g, '');
    if (!digits) return 'Belum diatur';
    return `+${digits}`;
  }

  function toast(message, type = 'success') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.append(stack);
    }
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    stack.append(node);
    setTimeout(() => {
      node.remove();
      if (!stack.childElementCount) stack.remove();
    }, 4200);
  }

  function debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function initials(name) {
    return String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  function dashboardFor(role) {
    if (role === 'admin') return '/admin';
    if (role === 'seller') return '/seller';
    return '/';
  }

  async function currentUser() {
    try {
      const data = await request('/api/auth/me');
      return data.user;
    } catch {
      return null;
    }
  }

  async function requireUser(role) {
    const user = await currentUser();
    if (!user) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.replace(`/login?next=${next}`);
      return null;
    }
    if (role && user.role !== role) {
      window.location.replace(dashboardFor(user.role));
      return null;
    }
    return user;
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  }

  function resizeImage(file, maxDimension = 1280, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        try {
          let { width, height } = image;
          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          const isPng = file.type === 'image/png';
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl);
              if (!blob) return reject(new Error('Gagal memproses gambar.'));
              const ext = isPng ? '.png' : '.jpg';
              resolve(new File([blob], `produk${ext}`, { type: blob.type }));
            },
            isPng ? 'image/png' : 'image/jpeg',
            quality
          );
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('File gambar tidak dapat dibaca.'));
      };
      image.src = objectUrl;
    });
  }

  window.GeprekOn = {
    icon,
    escapeHtml,
    request,
    formatRupiah,
    formatNumber,
    whatsappLink,
    whatsappDisplay,
    toast,
    debounce,
    initials,
    dashboardFor,
    currentUser,
    requireUser,
    logout,
    resizeImage,
  };
})();
