const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware parsing & penanganan folder statis
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Menyajikan folder 'public' menggunakan path.join dengan process.cwd() agar kompatibel di Vercel
app.use(express.static(path.join(process.cwd(), 'public')));

// Konfigurasi Multer untuk penampungan sementara di Vercel Serverless (/tmp)
const upload = multer({ dest: '/tmp/' });

// Lokasi penyimpanan data arsip JSON sementara
const DATA_FILE = path.join('/tmp', 'rekap_data.json');

// Helper untuk membaca file JSON
function getSavedData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return [];
        }
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        return [];
    }
}

// Helper untuk menyimpan file JSON
function saveAllData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('Gagal menyimpan file:', e);
    }
}

// Route Utama (Menyajikan file index.html dari folder public)
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// 1. Endpoint Ambil Seluruh Data Arsip
app.get('/api/data', (req, res) => {
    const data = getSavedData();
    res.json({ success: true, data });
});

// 2. Endpoint Upload File Excel (Logika Overwrite + Auto Clean Temp File)
app.post('/upload', upload.single('excelFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'File belum dipilih!' });
        }

        const { bulan, gelombang, golongan, jenisData } = req.body;
        const filePath = req.file.path;

        // Membaca file Excel menggunakan SheetJS
        const workbook = XLSX.readFile(filePath, { defval: "" });
        const sheetName = workbook.SheetNames[0];
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        
        // Hapus file fisik sementara dari folder /tmp
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Petakan metadata ke setiap baris data Excel
        const newRows = sheetData.map(row => ({
            Bulan: bulan || '-',
            Gelombang: gelombang || '-',
            JenisData: jenisData || 'Lainnya',
            GolonganJenis: golongan || 'Lainnya',
            ...row
        }));

        let allData = getSavedData();
        
        // Logika Replace / Overwrite jika kombinasi periode & jenis data sama
        allData = allData.filter(item => 
            !(item.Bulan === bulan && 
              item.Gelombang === gelombang && 
              (item.JenisData || 'Lainnya') === (jenis
