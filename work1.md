# WORK 1

## Referensi

Dokumen sumber revisi:
`/home/lutfi/Dokumen/lutfi/dani/(Registrasi - Pelamar) (Update 3).docx`

Tujuan dokumen ini:
menetapkan ruang lingkup kerja yang akan dikerjakan berdasarkan dokumen revisi atasan, agar implementasi tetap fokus dan tidak melebar ke area lain.

## Scope yang Akan Dikerjakan

### 1. Penyesuaian halaman awal dan login yang memang tersentuh dokumen

- Menindaklanjuti catatan pada screenshot `Dashboard Awal` yang menandai transisi menuju form pendaftaran di landing page.
- Menjaga agar perubahan di area ini hanya sebatas yang benar-benar ditunjukkan dokumen revisi.
- Menjadikan screenshot awal sebagai referensi konteks, bukan alasan untuk mengubah seluruh landing page di luar kebutuhan revisi.

### 2. Penyesuaian naming dan navigasi kandidat

- Mengganti label `Melamar` menjadi `Lowongan Kerja` pada area kandidat yang relevan.
- Menyamakan naming di menu atas, bottom navigation, heading halaman, CTA, dan copy terkait agar konsisten.
- Merapikan hubungan navigasi antara `Dashboard`, `Profil Siap Lamar`, `Lowongan Kerja`, `Lamaran Saya`, dan `Chat`.
- Menyinkronkan state aktif navigasi kandidat pada menu atas, hamburger menu, dan bottom navigation agar tidak salah highlight antar section.

### 3. Perapihan dashboard pelamar

- Menyesuaikan tampilan awal dashboard pelamar setelah login.
- Merapikan copy dan CTA utama seperti `Selamat Datang di KerjaNusa`, `Mulai Melamar`, dan akses ke lamaran/profil.
- Menjaga agar isi dashboard tetap fokus ke proses kandidat.

### 4. Perapihan kartu lowongan pada area kandidat

- Merapikan komposisi kartu lowongan/rekomendasi.
- Area yang menjadi fokus:
  - judul lowongan
  - nama perusahaan
  - badge lokasi / level / skema kerja
  - badge kecocokan seperti `40% cocok`
  - estimasi gaji
  - tombol `Buka & Lamar`
- Menjaga hirarki visual agar lebih mudah dibaca di mobile.

### 5. Penyesuaian halaman Lowongan Kerja

- Merapikan halaman daftar lowongan kandidat.
- Menyesuaikan heading, filter, urutan informasi, dan CTA agar sesuai alur pada dokumen revisi.
- Memastikan page ini menjadi lanjutan natural dari dashboard kandidat.

### 6. Penyesuaian detail lowongan

- Merapikan halaman/detail lowongan yang dibuka kandidat sebelum apply.
- Menyesuaikan struktur informasi yang terlihat pada referensi revisi, seperti:
  - ringkasan posisi
  - informasi perusahaan
  - lokasi / skema kerja / proses interview / gaji
  - company profile
  - tanggung jawab
  - kualifikasi
  - employer questions
  - kebutuhan dokumen
- Menggunakan screenshot referensi pada dokumen sebagai acuan untuk susunan konten dan arah presentasi, tanpa menyalin platform referensi secara mentah.
- Menjaga CTA detail lowongan tetap jelas.

### 7. Penyesuaian flow melamar

- Menyesuaikan alur kandidat dari detail lowongan menuju proses apply.
- Mencakup perapihan state/tahap seperti:
  - detail lowongan
  - screening / pertanyaan employer
  - review sebelum kirim
  - status sukses setelah submit
- Menyesuaikan copy status sukses agar sesuai referensi.
- Menjaga agar halaman sukses memiliki status awal yang jelas, waktu kirim, dan CTA lanjutan yang tepat.

### 8. Penyesuaian halaman Lamaran Saya

- Merapikan halaman `Lamaran Saya`.
- Memastikan state utama seperti `Aktif` dan `Selesai` tampil jelas.
- Menjaga ringkasan progres lamaran tetap terbaca dan sesuai dengan konteks kandidat.

### 9. Penyesuaian halaman Chat kandidat

- Merapikan tampilan `Chat` kandidat dengan recruiter dan superadmin.
- Menjaga area `Thread Terbaru`, daftar kontak, dan panel percakapan tetap sejalan dengan referensi revisi.
- Jika ada pencarian kontak/perusahaan yang sudah tersedia, area ini hanya akan dirapikan, bukan dibangun ulang total.
- Memperhatikan juga referensi pencarian/autocomplete kontak atau perusahaan yang muncul pada dokumen.

### 10. Penyesuaian Profil Siap Lamar

- Merapikan struktur dan tampilan section profil kandidat agar sesuai dokumen revisi.
- Section yang menjadi fokus:
  - `Dokumen & Ekspektasi`
  - `Organisasi / Relawan`
  - `Pendidikan & Pengalaman`
  - `Keunggulan, Bakat & Penghargaan`
  - `Target Pekerjaan`
- Fokus perubahan pada judul section, helper text, field emphasis, urutan visual, dan kerapian layout.

### 11. Penyesuaian subbagian Keunggulan, Bakat, dan Penghargaan

- `Keunggulan Pelamar`
  - menegaskan bahwa kandidat mengisi 3 nilai jual utama
  - merapikan helper text dan field `Keunggulan 1-3`
- `Bakat & Kemampuan`
  - merapikan area label, field, placeholder, atau penekanan visual yang ditandai revisi
- `Penghargaan`
  - mempertahankan helper text inti
  - menyesuaikan contoh/placeholder yang pada revisi terlihat ingin disederhanakan atau dihilangkan

## Scope yang Tidak Akan Dikerjakan

Agar pekerjaan tidak melebar, hal-hal berikut tidak masuk scope dokumen revisi ini kecuali ada arahan baru:

- perubahan arsitektur backend besar
- migration atau perubahan schema database baru
- perubahan flow auth / login / register di luar area yang memang ditunjukkan revisi
- perubahan dashboard recruiter
- perubahan dashboard admin / superadmin
- pembangunan ulang sistem chat dari nol
- perubahan business logic matching lowongan
- perubahan paket recruiter, billing, atau plan
- perubahan tabel paket/plan pada screenshot perbandingan jika tidak ada arahan baru yang lebih spesifik
- upload dokumen kandidat menjadi penyimpanan file sungguhan ke server/cloud jika belum diminta eksplisit
- fitur baru di luar yang terlihat atau bisa diturunkan wajar dari dokumen revisi

## Catatan Batasan Interpretasi

- Dokumen revisi berbasis screenshot dan coretan, jadi sebagian poin adalah arahan perapihan area, bukan selalu permintaan fitur baru.
- Ada screenshot yang berfungsi sebagai referensi keadaan yang diinginkan, bukan selalu instruksi untuk menyalin semua elemen satu per satu.
- Ada screenshot yang menyorot bug/salah state pada navigasi kandidat, sehingga sinkronisasi state aktif menjadi bagian dari scope.
- Jika nanti ditemukan kebutuhan baru yang sifatnya fungsional penuh, misalnya download CV sungguhan oleh recruiter, itu harus dianggap penambahan scope baru.
- Jika ada area yang saat ini memiliki dua flow berbeda tetapi hanya satu yang perlu dirapikan agar sesuai revisi, maka penyesuaian akan difokuskan ke flow yang dipakai user kandidat.

## Hasil yang Diharapkan

Output pekerjaan dari scope ini adalah:

- UI kandidat yang lebih sesuai dengan dokumen revisi
- naming dan navigasi yang konsisten
- halaman lowongan, apply, lamaran, chat, dan profil kandidat yang lebih rapi
- implementasi tetap berada dalam batas revisi dokumen dan tidak melebar ke fitur lain
