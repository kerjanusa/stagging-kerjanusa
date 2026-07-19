# Logging and Error Rules

Tujuan dokumen ini adalah membuat flow penting mudah ditelusuri saat ada bug atau insiden.

## 1. Tiga Jenis Jejak

### Application Log

Dipakai untuk:
- debug teknis
- info flow penting
- warning untuk kejadian mencurigakan
- error saat flow gagal

### Audit Log

Dipakai untuk aksi penting user atau admin:
- login
- logout
- role change
- approval
- export data
- delete data penting

### Security Event

Dipakai untuk:
- login gagal berulang
- access denied
- brute force signal
- tenant access mismatch
- file upload mencurigakan

## 2. Laravel Pattern

Untuk kode aplikasi biasa, gunakan:
- `Log::debug()`
- `Log::info()`
- `Log::warning()`
- `Log::error()`

Untuk command Artisan, `$this->info()` dan `$this->error()` hanya untuk output console.

## 3. Minimal Context

Setiap log flow penting minimal punya:
- `action`
- `step`
- `request_id`
- `actor_id` bila ada
- `tenant_id` bila ada
- `resource_id` bila ada

## 4. Titik Logging

Log di titik ini:
- awal flow penting
- sebelum langkah sensitif
- setelah state berubah
- saat integrasi eksternal dipanggil
- saat gagal
- saat selesai

Jangan log setiap baris.

## 5. Error Handling

- error harus membawa context langkah
- error ke user tidak boleh membocorkan detail internal
- error detail tetap dicatat di log
- exception penting harus punya mapping yang jelas

## 6. Contoh Pola

```php
// Cegah user nonaktif login walau password benar.
if (! $user->is_active) {
    Log::warning('Blocked login attempt for inactive user.', [
        'action' => 'login',
        'step' => 'ensure_user_active',
        'user_id' => $user->id,
        'request_id' => $requestId,
    ]);

    throw new AuthError('User is inactive');
}
```

## 7. Yang Tidak Boleh Masuk Log

- password
- token
- API key
- secret
- data kartu
- payload sensitif mentah
- file sensitif mentah

## 8. Traceability Rule

Setiap flow penting harus bisa dijawab:
- siapa yang melakukan
- aksi apa
- berhenti di langkah mana
- resource mana yang terdampak
- kapan terjadi
