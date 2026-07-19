# AI Operating System

Paket ini adalah pondasi reusable untuk web app besar yang dibangun dengan bantuan AI. Tujuannya bukan sekadar membuat AI menghasilkan kode, tetapi memaksa struktur, keamanan, logging, query, dan deployment tetap disiplin.

## Tujuan

- menjaga codebase tetap rapi saat fitur bertambah
- memaksa penempatan kode sesuai tanggung jawabnya
- membuat flow penting mudah di-debug dan ditelusuri
- mengurangi peluang kebocoran data atau query liar
- menyiapkan baseline infra yang aman dan bisa diulang di project baru

## Isi

- `ARCHITECTURE_RULES.md`
- `AI_CODING_RULES.md`
- `LARAVEL_PROJECT_BLUEPRINT.md`
- `LOGGING_AND_ERROR_RULES.md`
- `DATA_AND_SECURITY_RULES.md`
- `INFRASTRUCTURE_BASELINE.md`
- `REVIEW_CHECKLIST.md`
- `FRONTEND_AND_UI_RULES.md`
- `AUDIT_AND_OBSERVABILITY_RULES.md`
- `FILE_UPLOAD_AND_MEDIA_RULES.md`
- `MIGRATION_AND_RELEASE_RULES.md`
- `IMPLEMENTATION_TEMPLATES.md`

## Cara Pakai

1. Pakai `LARAVEL_PROJECT_BLUEPRINT.md` sebagai bentuk folder awal.
2. Pakai `ARCHITECTURE_RULES.md` sebagai batas layer dan penempatan kode.
3. Pakai `AI_CODING_RULES.md` sebagai aturan saat prompting AI.
4. Pakai `LOGGING_AND_ERROR_RULES.md` agar flow penting bisa di-track.
5. Pakai `DATA_AND_SECURITY_RULES.md` untuk query, auth, tenant, dan data sensitif.
6. Pakai `INFRASTRUCTURE_BASELINE.md` untuk env, deploy, backup, dan monitoring.
7. Pakai `FRONTEND_AND_UI_RULES.md` bila project punya client app atau dashboard web.
8. Pakai `AUDIT_AND_OBSERVABILITY_RULES.md` untuk membedakan log teknis, audit log, dan security event.
9. Pakai `FILE_UPLOAD_AND_MEDIA_RULES.md` jika ada upload dokumen, gambar, atau media.
10. Pakai `MIGRATION_AND_RELEASE_RULES.md` sebelum perubahan schema atau deploy high risk.
11. Pakai `IMPLEMENTATION_TEMPLATES.md` sebagai pola minimum saat mulai implementasi.
12. Sebelum merge, pakai `REVIEW_CHECKLIST.md`.

## Non-Negotiable

- Controller atau route handler harus tipis.
- Query tidak boleh tersebar di controller, component, atau helper acak.
- Business logic inti tidak boleh hidup di UI.
- Authorization harus dicek di backend.
- Logging harus terstruktur, bukan `dd`, `dump`, atau `console.log` liar.
- Secret tidak boleh masuk repo, log, atau response.
- Perubahan sensitif harus kecil, jelas, dan bisa diuji.

## Catatan

Paket ini adalah pondasi generik. Setiap project tetap harus menambahkan konteks spesifik:
- domain bisnis
- role dan permission
- model tenant
- integrasi eksternal
- aturan approval atau payment

## Hasil Versi Ini

Versi ini melengkapi gap yang umum muncul saat paket awal dipakai di project nyata:

- checklist review yang sebelumnya disebut di README kini sudah tersedia
- aturan frontend dan UI agar business rule tidak bocor ke client
- aturan audit dan observability yang lebih operasional
- aturan upload dan media
- aturan migration dan release
- template implementasi minimum agar aturan lebih mudah diterapkan
