# 🗳️ Our Voice, Our Rights — MGNREGA District Performance Dashboard

### 🔗 **Live Demo:**  
👉 [https://ourvoice-ourrights-2.onrender.com](https://ourvoice-ourrights-2.onrender.com)

---

## 🧩 Overview

**Our Voice, Our Rights** turns **MGNREGA open data** into simple, actionable visuals — so citizens, especially in rural areas with limited data literacy, can understand local program performance easily.  

The app emphasizes **clarity and accessibility** through:
- Large, readable UI 
- Simple color-coded charts
- Optional **voice prompts**
- District **auto-detect** using geolocation

---

## ✨ What It Does

- 📊 View **district-level MGNREGA performance** (jobs, person-days, wages)  
- 🔁 Compare **current and previous months** with easy summaries  
- 📈 Visualize **trends over time** using Chart.js  
- 📍 Auto-detect **district via geolocation** (best effort)  
- 💾 **Cache API data** in a local database for speed and resilience  

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | HTML, CSS, JavaScript, Chart.js |
| **Backend** | Node.js + Express |
| **Database** | PostgreSQL (production) / SQLite (local development) |
| **Hosting** | Render (Web Service) |
| **Data Source** | [data.gov.in — MGNREGA API](https://www.data.gov.in/catalog/mahatma-gandhi-national-rural-employment-guarantee-act-mgnrega) |

---

## 📱 Quick Features

- 📲 **Mobile-friendly**, low-literacy UI (large text & buttons)
- 🗣️ **Audio prompts** and speech button for accessibility
- 💾 **Local DB caching** handles API downtime & rate limits
- 🗺️ **Simple district seeding** (Uttar Pradesh demo)
- 📄 **PDF export of charts**
- ⚡ **Fast, responsive** even on low-end devices

---

## 🧱 Deployment & Environment

### 🟢 **Production (Render)**
- Attach a **Managed PostgreSQL** database on Render  
- Add environment variables:
