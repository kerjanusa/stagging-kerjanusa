# Frontend and UI Rules

Dokumen ini melengkapi aturan backend agar business rule tidak bocor ke UI.

## 1. Prinsip Inti

- Frontend bertanggung jawab pada presentasi, interaksi, dan state UI.
- Frontend boleh punya helper presentasi, tetapi bukan sumber utama aturan bisnis inti.
- Backend tetap source of truth untuk auth, permission, status transition, plan limit, ownership, dan data sensitif.
- Bila frontend butuh fallback logic, itu harus dianggap defensive UX, bukan rule utama.

## 2. Ownership Folder

Struktur minimum yang disarankan untuk React atau Vite:

```text
src/
  pages/
  components/
  hooks/
  services/
  utils/
  state/
  styles/
  features/
    jobs/
    auth/
    applications/
```

Owner tiap area:

- `pages/`: composition halaman dan wiring data
- `components/`: UI reusable dan presentational block
- `hooks/`: stateful behavior reusable
- `services/`: akses API, adapter response, request payload
- `utils/`: helper murni yang tidak mengandung business rule inti
- `state/`: store global bila memang dibutuhkan
- `features/`: grouping per domain saat codebase mulai besar

## 3. Yang Tidak Boleh Hidup di UI

- authorization utama
- ownership check utama
- quota plan utama
- status transition utama
- approval rule
- harga, billing, atau permission sensitif
- query data sensitif lintas user tanpa backend scope

## 4. Aturan Komponen

- Komponen harus fokus pada render dan event.
- Komponen tidak boleh berisi query, persistence, atau branching bisnis kompleks.
- Komponen besar harus dipecah bila sudah menangani terlalu banyak concern.
- Naming komponen harus menjelaskan niat, bukan sekadar posisi visual.

## 5. Aturan Hooks

- Hook dipakai untuk behavior reusable, bukan tempat menumpuk aturan domain.
- Hook boleh menggabungkan state UI, debounce, fetch state, optimistic state, dan mapping presentasi.
- Hook tidak boleh diam-diam memutuskan auth atau ownership tanpa kontrak backend yang jelas.

## 6. Aturan Service API

- Semua akses HTTP hidup di `services/` atau adapter serupa.
- Service mengurus:
  - endpoint path
  - payload request
  - normalisasi response
  - error mapping ringan untuk UI
- Service tidak boleh menyimpan business rule berat yang seharusnya milik backend.

## 7. Route Guard

- Route guard frontend hanya untuk UX.
- Semua akses sensitif tetap harus gagal aman di backend.
- Redirect frontend tidak boleh dianggap sebagai kontrol keamanan utama.

## 8. State dan Local Storage

- Simpan di local storage hanya data yang aman dan memang perlu.
- Jangan simpan token sensitif, secret, atau payload besar tanpa alasan kuat.
- Local storage tidak boleh menjadi source of truth utama untuk plan, permission, atau status bisnis.
- Mock mode harus jelas batasnya dan tidak bercampur diam-diam dengan mode production.

## 9. Form dan Validation

- Validasi frontend hanya membantu pengalaman input.
- Validasi backend tetap final.
- Error backend harus bisa dipetakan ke field yang tepat.
- Upload file harus divalidasi lagi di backend walau frontend sudah membatasi tipe atau ukuran.

## 10. Loading dan Error State

- Halaman penting harus punya state `idle`, `loading`, `success`, dan `error` yang jelas.
- Error message untuk user harus aman dan manusiawi.
- Detail teknis cukup di log, monitoring, atau devtools.

## 11. Mock Data Rules

- Mock data hanya untuk local development, demo, atau story isolasi.
- Rule inti yang diduplikasi di mock harus seminimal mungkin.
- Bila mock perlu meniru plan, quota, atau workflow, tandai sebagai simulasi.
- Begitu backend siap, source of truth harus kembali ke backend.

## 12. Red Flags

- component mengandung rule pricing atau permission
- local storage menentukan akses final user
- mapping status penting berbeda antara frontend dan backend
- fallback frontend menutupi bug backend
- seluruh dataset diambil lalu difilter di browser untuk data sensitif
