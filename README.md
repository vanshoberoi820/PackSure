# PackSure — Smart Packaging Compliance Verification

**PackSure** is a mobile-first GovTech application built for the **Smart India Hackathon (SIH) 2026**. It evaluates pre-packaged commodity labels against the **Legal Metrology (Packaged Commodities) Rules, 2011** using high-resolution client-side OCR, multi-frame 8-second video product scanning, information consensus fusion, and an AI voice assistant.

---

## 🚀 Key Features

* **8-Second Video Product Scan (360° Multi-Frame OCR)**:
  - Records an ~8-second video of the physical package rotating across front, sides, and crimps.
  - Automatically extracts 8–12 sharpest representative frames using Laplacian variance scoring.
  - Runs multi-frame OCR and performs **Information Fusion** (consensus boosting across frames + conflict detection).
  - Displays video frame timeline evidence cards with exact timestamps (e.g., `Detected in Frame 4 at 00:03.2`).
* **High-Accuracy Image OCR Pipeline**:
  - Preserves fine packaging typography (up to 1800×1800px at 0.95 quality).
  - Multi-candidate canvas preprocessing (grayscale, contrast stretching, adaptive binarization).
  - Context-aware OCR normalization (`O` ↔ `0`, `I`/`l` ↔ `1` in dates and prices without corrupting words).
* **Legal Metrology Rule Verification (Rule 6 Mapping)**:
  - Validates **Rule 6(1)(a)** (Manufacturer / Packer address), **Rule 6(1)(b)** (Generic name with brand candidate scoring), **Rule 6(1)(c)** (Metric Net Quantity), **Rule 6(1)(d)** (Mfg/Packing Month & Year), **Rule 6(1)(d) proviso** (Best Before / Expiry date for perishables), **Rule 6(1)(e)** (MRP inclusive of all taxes), **Rule 6(1)(g)** (Country of Origin), **Rule 6(1)(n)** (Consumer Care Helpline), and **FSSAI Rule 9**.
  - Provides structured legal violation cards with exact rule citations, requirements, and officer recommendations.
* **AI Voice Compliance Assistant**:
  - Real-time Web Speech narration of the 4 key metrics (MRP, Expiry, Net Qty, Origin).
  - Live animated equalizer HUD with mute toggle and immediate report bypass.
* **E-Commerce Catalog Comparison**:
  - Compares physical package declarations side-by-side with online e-commerce listings to catch Section 18 catalog discrepancies.
* **Officer Review Panel & PDF Export**:
  - Allows legal metrology officers to inspect frame evidence, confirm/dismiss flags, record audit remarks, and download tamper-evident PDF audit reports.
* **Demo Product Fallback**:
  - Includes canvas-generated synthetic demo product for offline SIH presentations.

---

## 💻 Tech Stack

* **Frontend**: React 18 (Vite SPA) + React Router
* **Styling**: Tailwind CSS + Lucide Icons
* **Engines**: Tesseract.js (WASM OCR), jsPDF (Audit Reports), HTML5 Canvas & MediaRecorder API
* **Deployment**: Docker & Nginx (Multi-stage containerized build)
* **Database**: LocalStorage (Persistent Inspection History)

---

## ⚙️ Getting Started

### 1. Local Development
```bash
npm install
npm run dev
```
Open `http://localhost:3000` (or the port indicated by Vite). Toggle mobile device emulation (F12) in browser developer tools for the native mobile PWA view.

### 2. Docker Deployment

#### Using Docker Compose (Recommended):
```bash
docker compose up --build
```
Open `http://localhost:3000`.

#### Using Docker CLI:
```bash
# Build image
docker build -t packsure .

# Run container on port 3000
docker run -d -p 3000:80 --name packsure-app packsure
```

### 3. Production Build
```bash
npm run build
```

---

## 📊 How to Test

### 1. Testing 8-Second Video Product Scan
1. Open the app and click **Scan Product**.
2. Click **Record 8-Sec 360° Video**.
3. Allow camera permission, point the rear camera at a product package, and rotate it slowly across 8 seconds.
4. Watch the progress bar as frames are sampled, OCR is executed across frames, and declarations are fused into consensus values.
5. Listen to the AI Voice Assistant announce verified declarations, then inspect the timeline in **View Evidence**.

### 2. Testing High-Accuracy Image Scan
1. Click **Scan Product** -> **Take Single Photo** or **Upload Image**.
2. Upload any FMCG package image (e.g., biscuits, chips, rice, shampoo).
3. The engine will enhance contrast, perform OCR, and extract multiline MRP, Mfg Date, and Net Quantity.

### 3. Testing SIH Demo Mode
1. Click **Scan Product** -> **Use Demo Product**.
2. Click **Analyze Product** for an instant, reliable presentation walkthrough.
