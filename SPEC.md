# SPEC.md — GeprekOn

## 1. Tujuan
GeprekOn adalah aplikasi web katalog produk UMKM makanan dengan dashboard pengelolaan sederhana. Aplikasi ditujukan untuk latihan implementasi selama satu hari dan berjalan sepenuhnya di browser tanpa backend maupun autentikasi.

Tujuan MVP:
- Menampilkan katalog delapan produk contoh yang mudah ditelusuri calon pembeli.
- Memudahkan pengelola mengelola produk, stok, gambar, kategori, dan status unggulan.
- Mengarahkan calon pembeli untuk memesan melalui WhatsApp.
- Menyimpan perubahan pada perangkat yang sama menggunakan `localStorage`.

## 2. Pengguna dan konteks
1. **Calon pembeli** — melihat produk, mencari nama/deskripsi, memilih kategori, mengurutkan katalog, dan membuka WhatsApp untuk bertanya/memesan.
2. **Pengelola toko** — pada perangkat/browser yang sama, membuka panel dashboard untuk melihat ringkasan, menambah/mengubah/menghapus produk, mengunggah gambar, serta mengatur nomor WhatsApp.

Tidak ada pemisahan hak akses atau login. Panel pengelola adalah fitur demo yang dapat dibuka dari perangkat yang sama; jangan menganggapnya sebagai area admin yang aman untuk produksi.

## 3. Daftar fitur MVP
### Katalog pembeli
- Menampilkan delapan produk awal dengan placeholder gambar lokal berbasis SVG/data URI.
- Menampilkan nama, kategori, harga format Rupiah, stok, deskripsi singkat, dan penanda unggulan.
- Pencarian berdasarkan nama dan deskripsi.
- Filter kategori, termasuk pilihan semua kategori.
- Sorting: unggulan, nama A–Z, harga terendah/tertinggi, dan stok terbanyak.
- Tombol pesan WhatsApp dengan pesan awal berisi nama produk.
- Tombol tambah/kurangi jumlah tidak termasuk MVP; pemesanan diselesaikan melalui percakapan WhatsApp.

### Dashboard pengelola
- Ringkasan jumlah produk, total stok, dan jumlah kategori aktif.
- CRUD demo: tambah, baca, ubah, dan hapus produk.
- Form produk: nama, kategori, harga, stok, deskripsi, unggulan, dan gambar.
- Pilih kategori dari daftar yang ada atau ketik kategori baru.
- Upload gambar dari perangkat; gambar diproses di browser dan disimpan sebagai data URL.
- Pengaturan nomor WhatsApp toko yang digunakan seluruh tombol pesan.
- Perubahan langsung tersimpan di `localStorage`.

### Persistensi
- Data produk dan pengaturan nomor WhatsApp disimpan di `localStorage`.
- Saat pertama kali dibuka, aplikasi mengisi delapan produk contoh jika belum ada data tersimpan.
- Tombol reset demo mengembalikan data dan nomor WhatsApp contoh.

## 4. Data model
```js
Product = {
  id: string,             // ID unik lokal
  nama: string,           // wajib, tidak kosong
  kategori: string,       // wajib, tidak kosong
  harga: number,          // >= 0
  stok: integer,          // >= 0
  deskripsi: string,
  imageUrl: string,       // URL lokal/data URL/placeholder
  unggulan: boolean
}

Settings = {
  whatsappNumber: string  // nomor internasional tanpa +, spasi, atau tanda baca
}
```

Validasi:
- `nama` dan `kategori` wajib diisi.
- `harga` harus angka hingga 0 atau lebih.
- `stok` harus bilangan bulat hingga 0 atau lebih.
- Nomor WhatsApp dibersihkan menjadi digit saja; validasi format akhir tetap perlu dikonfirmasi oleh pemilik toko.
- Gambar unggahan dibatasi ke tipe gambar dan diperkecil di browser sebelum disimpan.

## 5. Nonfunctional requirements
- **Kompatibilitas:** browser modern dengan dukungan ES6+, `localStorage`, `FileReader`, dan Canvas.
- **Responsif:** dapat digunakan pada desktop dan layar ponsel.
- **Kinerja:** tidak memerlukan server, framework UI, atau dependensi eksternal; katalog delapan produk harus terasa instan.
- **Aksesibilitas dasar:** label form, tombol dengan teks jelas, kontras memadai, dan navigasi keyboard dasar.
- **Privasi:** data hanya disimpan pada browser/perangkat yang sedang digunakan; tidak ada pengiriman data ke server aplikasi.
- **Keamanan:** tidak ada API key, login palsu, atau kredensial; render input pengguna sebagai teks, bukan HTML mentah.
- **Ketahanan data:** tampilkan penanganan sederhana bila penyimpanan gagal/penuh. Hindari gambar terlalu besar agar kuota `localStorage` tidak cepat habis.
- **Pemeliharaan:** logika dipisah secara konseptual menjadi data, render katalog, dashboard/form, dan persistensi.

## 6. Risiko dan mitigasi
| Risiko | Dampak | Mitigasi MVP |
|---|---|---|
| `localStorage` penuh, terutama karena gambar | Gagal menyimpan perubahan | Resize gambar ke dimensi/ukuran lebih kecil; tampilkan pesan bila gagal |
| Data hanya ada di satu browser | Data tidak sinkron antarperangkat dan dapat hilang saat data browser dihapus | Jelaskan batasan lokal; sediakan reset demo, dan rencanakan ekspor/impor sebagai pengembangan |
| Nomor WhatsApp salah | Tombol pesan mengarah ke nomor yang keliru | Pengaturan nomor dapat diedit; tampilkan nomor yang sedang aktif |
| Panel dashboard terbuka untuk siapa saja | Siapa pun yang memakai perangkat dapat mengubah katalog | Nyatakan bahwa ini bukan autentikasi/keamanan produksi |
| Gambar unggahan tidak valid | Preview gagal atau penyimpanan bermasalah | Terima hanya MIME `image/*`, resize di browser, tangani error |
| Link WhatsApp tidak tersedia pada perangkat | Alur pesan terganggu | Gunakan URL `wa.me` yang dapat dibuka di browser/perangkat |

## 7. Out of scope
- Backend, database server, sinkronisasi cloud, multi-user, dan deployment.
- Login, role-based access control, atau klaim keamanan dashboard.
- Pembayaran, keranjang, checkout, ongkir, dan pelacakan pesanan.
- Manajemen pesanan atau percakapan WhatsApp otomatis.
- Analitik penjualan, laporan keuangan, dan notifikasi stok.
- Integrasi WhatsApp Business API.
- Upload ke cloud/CDN, crop editor lanjutan, atau galeri media.
- Unit test otomatis dan pipeline CI/CD.

## 8. Acceptance criteria (pemeriksaan manual)
1. **Data awal:** buka `index.html` di browser baru; katalog menampilkan delapan produk contoh.
2. **Detail produk:** setiap kartu menampilkan nama, kategori, harga dengan format Rupiah, stok, dan gambar/placeholder.
3. **Pencarian:** ketik kata yang terdapat pada nama atau deskripsi; hanya produk yang cocok tampil. Hapus kata kunci untuk memulihkan daftar.
4. **Filter kategori:** pilih satu kategori; hanya produk kategori tersebut tampil. Pilih “Semua kategori” untuk menampilkan seluruh produk.
5. **Sorting:** ubah opsi urut; urutan nama/harga/stok berubah sesuai pilihan.
6. **WhatsApp:** klik tombol pesan; browser membuka tautan WhatsApp dengan nomor aktif dan teks awal yang menyebut produk.
7. **Ringkasan dashboard:** dashboard menunjukkan jumlah produk, total stok, dan jumlah kategori yang sesuai data katalog.
8. **Tambah produk:** isi nama, kategori, harga, stok, deskripsi; simpan; produk baru tampil di katalog dan dashboard.
9. **Validasi:** coba simpan harga negatif, stok pecahan/negatif, atau nama kosong; aplikasi menolak dan memberi pesan.
10. **Edit produk:** ubah harga atau stok produk; simpan; perubahan tampak pada katalog dan ringkasan.
11. **Hapus produk:** hapus satu produk dan konfirmasi; produk tidak lagi tampil.
12. **Pilih kategori:** kategori yang sudah ada dapat dipilih pada form; kategori baru dapat dimasukkan dan muncul sebagai filter setelah produk disimpan.
13. **Upload gambar:** unggah file gambar valid; preview tampil dan gambar tetap ada setelah halaman dimuat ulang.
14. **Tolak file non-gambar:** pilih file bukan gambar; aplikasi tidak menyimpannya dan memberi pesan.
15. **Nomor WhatsApp:** ubah nomor di pengaturan dashboard; tombol pesan berikutnya menggunakan nomor baru.
16. **Persistensi:** tambah/edit produk dan ubah nomor; refresh halaman; data tetap tersimpan.
17. **Reset demo:** jalankan reset dan konfirmasi; delapan produk serta nomor contoh kembali.
18. **Responsif:** pada lebar layar ponsel, katalog dan form tetap dapat dibaca dan digunakan tanpa scroll horizontal halaman.

## 9. Implementation plan per iterasi (target satu hari)
| Iterasi | Estimasi | Hasil |
|---|---:|---|
| 1. Kerangka & data | 45 menit | Struktur HTML, CSS responsif, model produk, delapan data seed, placeholder lokal |
| 2. Katalog | 60 menit | Kartu produk, pencarian, filter kategori, sorting, format Rupiah, link WhatsApp |
| 3. Dashboard CRUD | 90 menit | Ringkasan, daftar produk, tambah/edit/hapus, validasi form |
| 4. Gambar & pengaturan | 60 menit | Upload gambar, resize Canvas, preview, pilih kategori, pengaturan nomor WhatsApp |
| 5. Persistensi & UX | 45 menit | `localStorage`, reset demo, error handling, status kosong |
| 6. Uji manual & perbaikan | 60 menit | Jalankan acceptance criteria, uji ponsel, rapikan bug dan instruksi penggunaan |

**Definisi selesai:** seluruh acceptance criteria yang relevan dapat diperiksa secara manual pada satu browser modern; aplikasi tetap berfungsi tanpa koneksi internet setelah file tersedia secara lokal.
