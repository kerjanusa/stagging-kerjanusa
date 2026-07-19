# Infrastructure Baseline

Dokumen ini adalah pondasi DevOps yang bisa dipakai ulang di project baru.

## 1. Environment

- pisahkan `local`, `staging`, dan `production`
- secret berbeda per environment
- jangan pakai database production untuk testing
- config sensitif tidak boleh dicampur sembarang

## 2. Network and Runtime

- database harus private
- cache dan queue jangan diekspos publik
- hanya service yang perlu saja yang public
- TLS wajib untuk trafik eksternal
- runtime production jangan dibiarkan penuh service tak perlu

## 3. Secrets

- secret di secret manager atau env yang aman
- jangan commit secret
- jangan tulis secret ke log
- rotasi secret penting harus mungkin dilakukan

## 4. CI/CD

Minimal gate otomatis:
- format atau lint
- typecheck atau static analysis
- test
- build
- secret scan
- dependency scan

Perubahan sensitif harus punya review tambahan.

## 5. Release Rules

- deploy harus punya artifact atau commit yang jelas
- migration berisiko harus punya plan
- rollback atau roll-forward harus dipikirkan
- high-risk change jangan dibundel berlebihan

## 6. Monitoring

Minimal harus ada:
- health check
- application logs
- error alert
- auth anomaly signal
- queue or job failure visibility
- backup status visibility

## 7. Backup and Recovery

- backup terjadwal
- restore pernah diuji
- retention jelas
- siapa yang boleh akses backup jelas

## 8. Production Access

- batasi siapa yang boleh akses production
- MFA untuk akses sensitif
- hindari akun bersama
- semua akses privileged harus bisa diaudit

## 9. Baseline Mindset

Infra yang baik bukan cuma "server hidup", tetapi:
- aman
- bisa diobservasi
- bisa dirollback
- bisa dipulihkan
- tidak bergantung pada satu orang
