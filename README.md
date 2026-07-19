# Pintarnya - Platform Pencarian Kerja

Platform web untuk menghubungkan pencari kerja dengan pengusaha. Dibangun dengan Laravel Backend + React Frontend.

![Pintarnya Logo](https://via.placeholder.com/300x150?text=Pintarnya)

## ✨ Fitur Utama

- 🔐 **Autentikasi** - Register, Login, Logout
- 💼 **Manajemen Lowongan** - Buat, edit, hapus lowongan kerja
- 🎯 **Pencarian & Filter** - Cari pekerjaan dengan berbagai filter
- 📋 **Lamaran Kerja** - Kandidat dapat melamar lowongan
- 📊 **Dashboard Rekruter** - Lihat daftar lamaran dan statistik
- 👤 **Profil Pengguna** - Update profil dan ganti password

## 🛠️ Tech Stack

### Backend
- **Framework**: Laravel 10
- **Authentication**: Laravel Sanctum
- **Database**: MySQL/MariaDB
- **Language**: PHP 8.1+

### Frontend
- **Framework**: React 18
- **Bundler**: Vite
- **Routing**: React Router
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Styling**: CSS3

## 📁 Project Structure

```
v3/
├── backend/              # Laravel API
│   ├── app/
│   │   ├── Http/Controllers/
│   │   ├── Services/       ⭐ Business Logic
│   │   ├── Models/
│   │   └── ...
│   ├── routes/api.php
│   └── ...
├── frontend/             # React App
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/       # API Calls
│   │   ├── hooks/          # Custom Hooks
│   │   ├── utils/
│   │   └── styles/
│   └── ...
├── QUICK_START.md
├── API_DOCUMENTATION.md
└── PROJECT_STRUCTURE.md
```

## 🚀 Quick Start

### Prerequisites
- PHP 8.1+
- Node.js 18+
- MySQL/MariaDB
- Composer

### Backend Setup
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

Backend akan berjalan di: `http://localhost:8000`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Frontend akan berjalan di: `http://localhost:3001`

## Recommended Vercel Deployment

Untuk Vercel, setup recommended project ini adalah satu repo GitHub dengan dua project Vercel terpisah:

- Backend: root directory `backend`
- Frontend: root directory `frontend`

Panduan awam step-by-step ada di [VERCEL_RECOMMENDED_SETUP.md](VERCEL_RECOMMENDED_SETUP.md).

## 📚 Documentation

- [Quick Start Guide](QUICK_START.md) - Setup dan testing cepat
- [API Documentation](API_DOCUMENTATION.md) - Detail semua endpoint API
- [Project Structure](PROJECT_STRUCTURE.md) - Penjelasan arsitektur & pattern

## 🔑 Key Features Implementation

### Backend
- **Service Layer Pattern** - Business logic terletak di folder `Services/`
- **RESTful API** - API yang clean dan mudah digunakan
- **Authentication** - Menggunakan Laravel Sanctum
- **Validation** - Request validation di Controller
- **Error Handling** - Consistent error responses

### Frontend
- **Custom Hooks** - Reusable logic hooks (useAuth, useJobs, useApplications)
- **Zustand Store** - Global state management
- **Service Classes** - API communication layer
- **Component Architecture** - Separated components dan pages
- **Responsive Design** - Mobile-friendly interface

## 💡 Architecture Pattern

### Backend Flow
```
Request → Controller (validate) → Service (logic) → Model (DB) → Response
```

### Frontend Flow
```
Component → Hook (state) → Service (API) → Store (global state) → Render
```

## 🧪 Testing API

Gunakan Postman atau Thunder Client:

1. **Register/Login** untuk mendapatkan token
2. **Copy token** dari response
3. **Add Authorization Header**: `Bearer {token}`
4. Test protected endpoints

Atau lihat [API_DOCUMENTATION.md](API_DOCUMENTATION.md) untuk detail lengkap

## 📝 Sample Requests

### Login
```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "recruiter@example.com",
    "password": "password123"
  }'
```

### Get All Jobs
```bash
curl http://localhost:8000/api/jobs?page=1&per_page=15
```

### Create Job (Protected)
```bash
curl -X POST http://localhost:8000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "title": "Backend Developer",
    "description": "...",
    "category": "Technology",
    "salary_min": 5000000,
    "salary_max": 10000000,
    "location": "Jakarta",
    "job_type": "full-time",
    "experience_level": "mid"
  }'
```

## 🎨 Styling

- **CSS Modern** - Flexbox & Grid
- **Responsive** - Mobile-first design
- **Color Scheme**:
  - Primary: #1e40af (Blue)
  - Secondary: #f97316 (Orange)
  - Error: #dc2626 (Red)

## 🔐 Security

- ✅ Password hashing dengan bcrypt
- ✅ Token-based authentication
- ✅ CORS protection
- ✅ Input validation di backend
- ✅ Protected routes memerlukan token

## 🚧 Development Workflow

1. Backend development di `backend/`
2. Frontend development di `frontend/`
3. Test API dengan Postman
4. Integrasi frontend-backend
5. Push ke repo staging untuk deploy

## 🐛 Troubleshooting

### Backend Issues
- **Port conflict**: `php artisan serve --port=8001`
- **Database error**: Check `.env` database credentials
- **Autoload error**: `composer dump-autoload`

### Frontend Issues
- **CORS error**: Check proxy di vite.config.js
- **Module not found**: `rm -rf node_modules && npm install`
- **Port conflict**: `npm run dev -- --port 3001`

## 📦 Performance Tips

### Backend
- Gunakan eager loading: `->with('relations')`
- Cache frequently accessed data
- Index database columns yang sering diquery

### Frontend
- Code splitting dengan React.lazy()
- Memoize expensive computations
- Optimize images
- Gunakan build optimized sebelum push ke staging

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Create pull request

## 📄 License

MIT License - Silakan gunakan untuk keperluan pribadi atau komersial

## 📞 Support

Untuk pertanyaan atau issues, buat discussion atau submit issue di repository.

## 🎯 Next Steps

- [ ] Setup backend & frontend
- [ ] Test API dengan Postman
- [ ] Create additional features
- [ ] Add unit tests
- [ ] Push dan verifikasi di staging

---

**Built with ❤️ using Laravel & React**
