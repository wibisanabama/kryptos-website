# Kryptos - Crypto Monitoring Dashboard

Dashboard pemantau harga cryptocurrency real-time menggunakan CoinGecko API.

## Setup

1. Clone repository ini
2. Salin file konfigurasi:
   ```bash
   cp config.example.js config.js
   ```
3. Edit `config.js` dan isi dengan API key CoinGecko Anda:
   ```js
   const CONFIG = {
     COINGECKO_API_KEY: "API_KEY_ANDA_DI_SINI",
   };
   ```
4. Buka `index.html` di browser (atau jalankan via live server)

> **Catatan:** File `config.js` sudah masuk `.gitignore` dan **tidak akan** ter-push ke GitHub.  
> Dapatkan API key gratis di [coingecko.com/api](https://www.coingecko.com/api/documentation).
