# PackSure — Smart Packaging Compliance

**PackSure** is a mobile-first GovTech application prototype built for the **Smart India Hackathon (SIH) 2026**. It evaluates pre-packaged commodity labels against the **Legal Metrology (Packaged Commodities) Rules, 2011** using client-side OCR and a rule matching engine.

---

## 🚀 Key Features
* **Client-Side OCR**: Uses `Tesseract.js` directly in the browser for offline-ready text extraction.
* **Compliance Checks**: Validates mandatory declarations (MRP, Net Qty, Mfg Date, Country of Origin, Consumer Care details, FSSAI) under Rule 6.
* **E-Commerce Comparison**: Compares physical package details with online listings to find mismatches.
* **Officer Review Panel**: Allows inspectors to confirm flags, write notes, and sign off.
* **PDF Report Generation**: Instantly compiles and downloads structured audit reports.
* **Demo Mode**: Includes a canvas-generated mock product for reliable network-free demos.

---

## 💻 Tech Stack
* **Frontend**: React (Vite SPA) + React Router (HashRouter)
* **Styling**: Tailwind CSS + Lucide Icons
* **Engines**: Tesseract.js (OCR), jsPDF & html2canvas (PDF Reports)
* **Database**: LocalStorage (Inspection History)

---

## ⚙️ Getting Started

### Installation
```bash
npm install
```

### Running Locally
```bash
npm run dev
```
Open `http://localhost:3000`. Toggle the mobile view in your browser developer tools (F12) to view the native responsive design.

### Build Production Bundle
```bash
npm run build
```

---

## 📊 SIH Demo Flow
1. **Log In**: Enter any dummy email/password on the login screen.
2. **Scan**: Click **Scan Product** on the dashboard.
3. **Demo**: Click **Use Demo Product** -> **Analyze Product** (runs a mock workflow check).
4. **Check Mismatch**: Click **Package vs Online Listing** -> **Demo Listing** to see price conflicts.
5. **Verify**: Click **Officer Review**, confirm/reject issues, add notes, and save.
6. **Export**: Click **Generate Report PDF** on the result screen to download the final audit sheet.
