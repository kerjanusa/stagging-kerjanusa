# Laravel Project Blueprint

Ini adalah bentuk folder yang disarankan untuk Laravel web app besar.

## Struktur

```text
app/
  Modules/
    Auth/
      Presentation/
        Controllers/
        Requests/
        Resources/
      Application/
        Actions/
        DTOs/
      Domain/
        Policies/
        Rules/
        Exceptions/
      Infrastructure/
        Repositories/
        Providers/
      Tests/
    Users/
      Presentation/
      Application/
      Domain/
      Infrastructure/
      Tests/
  Shared/
    Audit/
    Exceptions/
    Logging/
    Security/
    Support/
routes/
config/
database/
tests/
infra/
  deploy/
  monitoring/
  backup/
docs/
.github/
  workflows/
```

## Penempatan Kode

### Login

- `Presentation/Controllers/LoginController.php`
  menerima request, memanggil action
- `Presentation/Requests/LoginRequest.php`
  validasi boundary input
- `Application/Actions/LoginUserAction.php`
  orchestration login
- `Domain/Rules/LoginRules.php`
  rule user aktif, state akun, lockout logic
- `Infrastructure/Repositories/UserRepository.php`
  query user
- `Shared/Audit/AuditLogService.php`
  catat login berhasil atau gagal

### Query Listing

- query sederhana dan inti entity di repository
- query report berat di `Application/Queries` atau `Infrastructure/QueryServices`

### Command Artisan

- simpan di `app/Console/Commands`
- command harus tipis
- logic utama tetap panggil action atau service di module
- `$this->info()` dan `$this->error()` hanya untuk output console, bukan pengganti app log

### Logging

- helper atau context builder di `Shared/Logging`
- audit log di `Shared/Audit`
- jangan taruh helper logging acak di semua module

### Exceptions

- exception domain khusus di `Domain/Exceptions`
- exception shared di `Shared/Exceptions`

## Aturan Nama

- action: `VerbNounAction`
- repository: `NounRepository`
- policy: `NounPolicy`
- request: `VerbNounRequest`
- job: `VerbNounJob`
- event: `NounPastTense`

## Aturan Growth

- jika module mulai besar, pecah ke subfolder jelas
- jangan pakai folder `Helpers` sebagai tempat sampah
- folder `Shared` hanya untuk sesuatu yang benar-benar generik
