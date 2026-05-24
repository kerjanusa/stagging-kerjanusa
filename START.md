# 🚀 PINTARNYA - START HERE

**Untuk menjalankan website Pintarnya, ikuti 3 terminal commands di bawah:**

---

## 📌 QUICK START (Paling Mudah)

Buka **2 terminal berbeda** dan jalankan:

### Terminal 1: Backend (Port 8000)
```bash
cd /home/lutfi/Dokumen/lutfi/dani/v3/backend
composer install  # Jalankan 1x saja
php -S localhost:8000
```

**Output yang diharapkan:**
```
[Wed Mar 27 14:23:45 2024] PHP 8.1.0 Development Server started
Listening on http://localhost:8000
```

---

### Terminal 2: Frontend (Port 3001)
```bash
cd /home/lutfi/Dokumen/lutfi/dani/v3/frontend
npm install  # Jalankan 1x saja
npm run dev
```

**Output yang diharapkan:**
```
  VITE v5.0.0  ready in 250 ms
  ➜  Local:   http://localhost:3001/
```

---

### Browser: Akses Website
Buka: **http://localhost:3001**

✨ **Selesai! Website Pintarnya sudah jalan.**

---

## 📖 DOKUMENTASI

Setelah website jalan, baca:

1. **[RUN.md](RUN.md)** - Cara menjalankan & troubleshoot
2. **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Endpoint API
3. **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Struktur folder
4. **[QUICK_START.md](QUICK_START.md)** - Setup detail

---

## 🔐 Login Test

**Email:** recruiter@example.com  
**Password:** password123

Atau klik "Daftar" untuk buat akun baru.

---

## 🛠️ Troubleshoot Cepat

| Error | Solusi |
|-------|--------|
| Port 8000 in use | `php -S localhost:8001` |
| Port 3001 in use | `npm run dev -- --port 3002` |
| Module not found | `cd frontend && rm -rf node_modules && npm install` |
| Cannot connect to API | Pastikan backend running di Terminal 1 |

---

## 📁 Folder Structure

```
v3/
├── backend/                    ← API (Laravel / PHP)
│   ├── app/
│   │   ├── Http/Controllers/  ← CRUD only
│   │   ├── Services/          ← Business logic ⭐
│   │   └── Models/            ← Database
│   ├── routes/api.php         ← API endpoints
│   └── public/                ← Web root
├── frontend/                   ← Website (React)
│   ├── src/
│   │   ├── services/          ← API calls
│   │   ├── hooks/             ← State management
│   │   ├── components/        ← UI components
│   │   ├── pages/             ← Pages
│   │   └── styles/            ← CSS
│   └── vite.config.js         ← Vite setup
├── RUN.md                      ← Panduan menjalankan
├── API_DOCUMENTATION.md        ← API endpoints
├── PROJECT_STRUCTURE.md        ← Penjelasan struktur
└── README.md                   ← Dokumentasi lengkap
```

---

## ✨ Features

✅ User Registration & Login  
✅ Job Posting (Recruiter)  
✅ Job Search & Filter  
✅ Apply for Jobs  
✅ Applications Management  
✅ User Profile Management  

---

## 🏗️ Architecture

```
User → Browser (React)
         ↓
      Axios (API call)
         ↓
    Backend Router
         ↓
      Controller (validate)
         ↓
      Service (logic) ⭐
         ↓
      Model (database)
         ↓
      Response → Browser
         ↓
      Zustand Store (state)
         ↓
      Component (render)
```

---

## 🚀 Next Steps

1. ✅ Run backend & frontend
2. ✅ Test login
3. 📝 Explore features
4. 🔍 Check API documentation
5. 🎨 Customize UI
6. 🔧 Add more features
7. ✔️ Test thoroughly
8. 📦 Push ke staging

---

## 📞 Support

Jika ada error:

1. Baca output di terminal
2. Check browser console (F12)
3. Lihat [RUN.md](RUN.md) section troubleshoot
4. Pastikan php & npm version memenuhi requirement

---

## 📚 Technology Stack

### Backend
- PHP 8.1+
- Laravel 10
- MySQL/SQLite

### Frontend
- React 18
- Vite
- Zustand
- Axios

---

## 💡 Development Tips

- Keep 2 terminals open (backend & frontend)
- Use browser DevTools (F12) for debugging
- Check backend terminal for API errors
- Frontend auto-refreshes on code change
- Backend requires manual restart if code changes

---

**Selamat coding! 🎉**

Jika ada pertanyaan, check dokumentasi di atas atau konsultasi dengan team.
