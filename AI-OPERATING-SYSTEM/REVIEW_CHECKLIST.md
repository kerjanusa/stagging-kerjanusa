# Review Checklist

Checklist ini dipakai sebelum merge, deploy, atau menyerahkan hasil AI ke engineer lain.

## 1. Scope dan Diff

- Perubahan tetap kecil dan fokus pada satu tujuan jelas.
- File yang disentuh masih masuk akal untuk scope task.
- Tidak ada refactor besar yang diselundupkan ke bug fix kecil.
- Nama function, class, dan file masih menjelaskan niat.

## 2. Arsitektur dan Layer

- Controller, route handler, atau page action tetap tipis.
- Business flow utama hidup di action, use case, atau application service.
- Query tidak hidup di controller, component, helper acak, atau view.
- Authorization decision tidak disebar di banyak tempat tanpa owner jelas.
- Side effect eksternal tidak disembunyikan di helper atau repository.

## 3. Data dan Query

- Semua query sensitif membawa scope owner, role, atau tenant secara eksplisit.
- Tidak ada akses resource hanya berdasarkan ID dari client tanpa cek hak akses.
- Listing atau reporting berat tidak memuat seluruh data lalu difilter di memory.
- Raw SQL hanya dipakai bila perlu dan alasan teknisnya jelas.
- Constraint data penting juga dijaga di level database bila memungkinkan.

## 4. Auth dan Security

- Semua aksi sensitif dicek di backend.
- UI guard hanya membantu UX, bukan kontrol utama.
- Password, token, secret, API key, dan payload sensitif tidak masuk log atau response.
- Flow login, reset password, upload, export, dan admin action punya proteksi memadai.
- Endpoint health atau debug tidak membocorkan detail environment yang tidak perlu.

## 5. Logging, Audit, dan Error

- Flow penting punya jejak log yang cukup untuk ditelusuri.
- Access denied, login gagal, perubahan permission, delete, export, dan update sensitif punya audit trail.
- Error ke user aman dan tidak membocorkan detail internal.
- Error teknis tetap tercatat dengan context langkah yang cukup.
- Tidak ada `dd`, `dump`, `console.log`, atau debug flag liar yang tertinggal.

## 6. Validation dan Boundary

- Input divalidasi di boundary request.
- Rule bisnis tidak hanya hidup di frontend.
- File upload divalidasi ukuran, tipe, nama aman, dan lokasi simpan.
- Perubahan schema sensitif punya migration plan yang jelas.

## 7. Frontend

- UI tidak menjadi sumber utama aturan bisnis inti.
- Mapping status, plan, permission, dan rule penting tidak dobel tanpa alasan kuat.
- Service API, route guard, hook, dan component punya tanggung jawab yang jelas.
- Local storage, mock data, atau fallback frontend tidak menyalahi kontrak backend.

## 8. Infra dan Release

- Tidak ada pembuatan tabel, kolom, atau schema repair di request path production.
- Env local, staging, dan production dipisah.
- Secret tidak masuk repo.
- Perubahan high risk punya rollback atau roll-forward plan.
- Gate minimal tersedia: lint, test, build, secret scan, dependency scan.

## 9. Test

- Bug fix penting punya test regresi.
- Flow auth dan permission denial punya coverage minimum.
- Status transition dan scope ownership punya test.
- Jika tidak ada test, alasannya eksplisit dan risikonya dipahami.

## 10. Stop Ship

Jangan merge bila salah satu ini masih ada:

- authorization belum jelas
- query sensitif tanpa scope
- perubahan schema tanpa migration plan
- log atau response membocorkan data sensitif
- endpoint debug masih aktif
- runtime production memperbaiki schema sendiri
- perubahan sensitif besar tanpa test atau review tambahan
