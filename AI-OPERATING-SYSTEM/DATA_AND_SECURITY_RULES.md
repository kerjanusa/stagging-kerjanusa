# Data and Security Rules

Dokumen ini fokus pada query, auth, tenant scope, dan perlindungan data.

## 1. Query Rules

- Semua query harus punya owner yang jelas.
- Query entity inti tinggal di repository.
- Query report atau list kompleks boleh di query service.
- Tidak ada query di controller, blade, Livewire component, atau helper acak.
- Gunakan parameterized query, query builder, atau ORM aman.
- Raw SQL hanya bila perlu dan harus direview.

## 2. Scope Rules

- Resource access harus cek ownership atau tenant scope.
- Jangan percaya ID dari client tanpa verifikasi hak akses.
- Query sensitif wajib menyertakan filter scope secara eksplisit.
- Cross-tenant read atau export harus jadi kasus khusus, bukan default.

## 3. Validation Rules

- Input divalidasi di boundary request.
- Rule bisnis tidak boleh hanya hidup di frontend.
- File upload harus divalidasi:
  - ukuran
  - tipe
  - nama aman
  - lokasi simpan aman

## 4. Authorization Rules

- Semua aksi sensitif harus dicek di backend.
- UI guard bukan kontrol utama.
- Role, permission, dan policy harus terpusat.
- Jangan hardcode role string di banyak file.

## 5. Transaction Rules

- Flow multi-step write penting harus pakai transaction.
- Retry flow penting harus memikirkan idempotency.
- Side effect eksternal jangan diam-diam dilakukan tanpa jejak.

## 6. Logging and Audit Rules

- Access denied yang penting harus tercatat.
- Login gagal dan perubahan permission harus tercatat.
- Export dan delete data penting harus punya audit trail.

## 7. Migration Rules

- Migration harus aman untuk data existing.
- Jangan gabungkan perubahan schema berisiko tinggi dengan terlalu banyak perubahan lain.
- Selalu pikirkan rollback atau roll-forward.

## 8. Sensitive Data Rules

- Secret tidak boleh disimpan di repo.
- Data sensitif jangan dibocorkan ke response atau log.
- Env production dan non-production harus dipisah.
- Backup yang berisi data sensitif harus diperlakukan aman.

## 9. Red Flags

- query langsung di controller
- permission check hanya di frontend
- export tanpa audit
- upload file tanpa validasi
- login flow tanpa rate limit atau logging memadai
- scope tenant tidak terlihat di query
