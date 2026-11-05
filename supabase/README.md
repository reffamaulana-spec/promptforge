# Setup Supabase

1. Buat proyek gratis di https://supabase.com.
2. Buka SQL Editor, tempel seluruh isi `schema.sql`, lalu Run.
3. Buka Project Settings, API. Salin Project URL dan anon public key ke `.env`:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   ```
4. Untuk uji lokal, Authentication, Providers, Email: matikan "Confirm email" (nyalakan lagi saat deploy).
5. Authentication, URL Configuration: isi Site URL dengan `http://localhost:3000` dan tambahkan `http://localhost:3000/**` ke Redirect URLs.
6. Jalankan `npm run check:supabase`, lalu `npm run dev`.

Jangan pernah memakai atau membagikan service_role key. Aplikasi ini hanya membutuhkan anon key.
