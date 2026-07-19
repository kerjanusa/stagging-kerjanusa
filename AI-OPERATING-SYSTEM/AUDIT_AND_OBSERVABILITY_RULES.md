# Audit and Observability Rules

Dokumen ini menjelaskan bentuk jejak minimum agar flow penting bisa ditelusuri.

## 1. Tiga Jenis Jejak

### Application Log

Dipakai untuk:

- debug teknis
- info flow penting
- warning perilaku aneh
- error dan exception

### Audit Log

Dipakai untuk aksi penting yang mengubah keadaan bisnis atau akses:

- login dan logout penting
- password reset
- role change
- status akun berubah
- plan atau quota berubah
- delete, export, approval, reassign

### Security Event

Dipakai untuk kejadian mencurigakan:

- login gagal berulang
- access denied
- brute force signal
- tenant scope mismatch
- upload mencurigakan
- privilege escalation attempt

## 2. Minimal Context

Semua jejak penting minimal berisi:

- `timestamp`
- `action`
- `step`
- `request_id`
- `actor_id` bila ada
- `actor_role` bila ada
- `tenant_id` bila ada
- `resource_type` bila ada
- `resource_id` bila ada
- `result`

## 3. Audit Log Payload

Minimal field audit:

- `event_name`
- `actor_id`
- `actor_role`
- `target_type`
- `target_id`
- `change_summary`
- `ip` bila ada
- `user_agent` bila ada
- `request_id`
- `occurred_at`

Contoh event name:

- `auth.login_succeeded`
- `auth.login_failed`
- `user.status_changed`
- `job.reassigned`
- `application.status_changed`
- `recruiter.plan_changed`

## 4. Aturan Redaction

Jangan pernah log:

- password
- token
- API key
- credential mentah
- file mentah
- payload sensitif penuh
- data pribadi yang tidak perlu untuk diagnosis

Jika butuh referensi:

- log hash, ID, atau ringkasan aman
- log jumlah item, bukan isi penuh

## 5. Titik Wajib Logging

- awal flow penting
- sebelum langkah sensitif
- setelah state berubah
- saat integrasi eksternal dipanggil
- saat gagal
- saat selesai

## 6. Error Mapping

- User-facing error harus aman.
- Detail teknis tetap masuk log.
- Exception penting sebaiknya punya mapping yang konsisten:
  - validation
  - auth
  - permission
  - conflict
  - external dependency
  - unexpected failure

## 7. Alert Minimum

Minimal alert untuk:

- error rate naik tajam
- login gagal berulang
- access denied melonjak
- job atau queue gagal
- health endpoint merah
- backup gagal

## 8. Retention dan Ownership

- Tentukan siapa yang boleh melihat audit log.
- Tentukan retention application log, audit log, dan security event.
- Audit log tidak boleh mudah dihapus oleh actor yang sedang diaudit.

## 9. Implementation Pattern

Pisahkan service:

- `ApplicationLogger`
- `AuditLogService`
- `SecurityEventService`

Tujuannya agar:

- log teknis tidak bercampur dengan audit
- payload audit bisa distandardkan
- security event bisa diberi alert khusus

## 10. Red Flags

- audit hanya memakai `Log::info`
- login gagal tidak tercatat
- access denied penting tidak tercatat
- error ditelan tanpa log context
- request penting tidak punya `request_id`
