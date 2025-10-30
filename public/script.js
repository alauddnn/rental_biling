// ========================================
// ✅ SCRIPT.JS DENGAN SINKRONISASI BACKEND
// ========================================

if (!localStorage.getItem('authToken') && !window.location.pathname.endsWith('login.html')) {
    window.location.href = 'login.html';
}



const API_URL = 'http://localhost:3001/api';
const PS_RATE_PER_HOUR = 7000;

let psUnits = []; 
let CAFE_MENU = []; 
let localPsStates = {};

const psGridContainer = document.getElementById('psGridContainer');
const cafeMenuContainer = document.getElementById('cafeMenuContainer');
const headerTitle = document.getElementById('headerTitle');
const sessionModal = document.getElementById('sessionModal');
const outputModal = document.getElementById('outputModal');
const cafeOrderModal = document.getElementById('cafeOrderModal');
const cafeRateModal = document.getElementById('cafeRateModal');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');


const formatTime = (s) => { 
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(Math.floor(s % 60)).padStart(2, '0'); 
    return `${h} : ${m} : ${sec}`; 
};

const formatRupiah = (n) => {
    if (typeof n !== 'number' || isNaN(n)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(n);
};

const calculatePsTotal = (t, r) => Math.ceil(t / 60) * (r / 60);
const calculateCafeTotal = (o) => o.reduce((sum, order) => sum + (order.price * order.quantity), 0);

// ⭐ FUNGSI SYNC KE BACKEND
const syncStateToBackend = async (psId) => {
    const state = localPsStates[psId];
    if (!state || state.status === 'idle') return;

    try {
        await fetch(`${API_URL}/sessions/${psId}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: state.status,
                customer: state.customer,
                timeUsed: state.timeUsed,
                initialDurationSeconds: state.initialDurationSeconds,
                tvOn: state.tvOn,
                cafeOrders: state.cafeOrders
            })
        });
    } catch (error) {
        console.error('Sync error for PS', psId, ':', error);
    }
};

const renderCard = (unit) => {
    const state = localPsStates[unit.id] || { 
        status: 'idle', 
        timeUsed: 0, 
        customer: null, 
        cafeOrders: [], 
        initialDurationSeconds: 0, 
        tvOn: false 
    };
    
    const psTotal = calculatePsTotal(state.timeUsed, PS_RATE_PER_HOUR);
    const cafeTotal = calculateCafeTotal(state.cafeOrders);
    const grandTotal = psTotal + cafeTotal;
    
    let cardClass = 'ps-card'; 
    let cardContent = '';
    
    if (state.status === 'idle') {
        cardClass += ' idle'; 
        cardContent = `
            <div class="ps-header">
                <span class="ps-number">PS ${unit.id}</span>
            </div>
            <div class="idle-text">IDLE</div>
            <button class="btn-start" data-id="${unit.id}">MULAI SEWA</button>
        `;
    } else {
        cardClass += state.tvOn ? ' running-bg' : ' paused-bg';
        const timeRemaining = state.initialDurationSeconds > 0 
            ? state.initialDurationSeconds - state.timeUsed 
            : state.timeUsed;
        const isExpired = state.initialDurationSeconds > 0 && timeRemaining <= 0;
        const timeDisplay = formatTime(Math.max(0, timeRemaining));
        
        let statusTags = `<div class="ps-status-tag">${state.status.toUpperCase()}</div>`;
        if (isExpired) statusTags += `<div class="ps-status-tag habis">WAKTU HABIS</div>`;
        if (!state.tvOn) statusTags += `<div class="ps-status-tag tv-off">TV/PS OFF</div>`;
        if (state.cafeOrders.length > 0) statusTags += `<div class="ps-status-tag cafe-order">CAFE ORDER</div>`;
        
        cardContent = `
            <div class="ps-header">
                <span class="ps-number">PS ${unit.id}</span>
            </div>
            <div class="ps-status-group">${statusTags}</div>
            <div class="ps-price">${formatRupiah(PS_RATE_PER_HOUR)}/Jam</div>
            <div class="ps-timer" style="${isExpired ? 'color:#ffd700;':''}">${timeDisplay}</div>
            <div class="ps-controls-container">
                <button class="btn-control stop" data-id="${unit.id}">
                    <ion-icon name="stop-circle"></ion-icon> STOP
                </button>
                <button class="btn-pay" data-id="${unit.id}">BAYAR</button>
            </div>
            <div class="ps-tv-controls">
                <button class="btn-tv ${state.tvOn ? 'tv-off-btn':'tv-on-btn'}" data-id="${unit.id}">
                    TV ${state.tvOn ? 'OFF':'ON'}
                </button>
                <button class="btn-tv btn-topup" data-id="${unit.id}">+ DURATION</button>
            </div>
            <div class="ps-billing">
                <div>
                    <span class="label">Customer</span>
                    <span class="value">${state.customer || '-'}</span>
                </div>
                <div>
                    <span class="label">Grand Total</span>
                    <span class="value">${formatRupiah(grandTotal)}</span>
                </div>
            </div>
        `;
    }
    return `<div class="${cardClass}" id="ps${unit.id}" data-id="${unit.id}">${cardContent}</div>`;
};

const renderAllCards = () => { 
    if(psGridContainer) psGridContainer.innerHTML = psUnits.map(renderCard).join(''); 
};

const renderSingleCard = (psId) => {
    const psCard = document.getElementById(`ps${psId}`);
    if (psCard) {
        const unit = psUnits.find(u => u.id == psId);
        if (unit) {
            psCard.outerHTML = renderCard(unit);
        }
    }
};

const renderCafeMenu = () => { 
    if(cafeMenuContainer) {
        cafeMenuContainer.innerHTML = CAFE_MENU.map(item => `
            <div class="menu-card">
                <img src="${item.image}" alt="${item.name}" class="menu-image">
                <div class="menu-name">${item.name}</div>
                <div class="menu-price">${formatRupiah(item.price)}</div>
                <button class="btn-add-to-order" data-name="${item.name}" data-price="${item.price}">
                    + Tambah
                </button>
            </div>
        `).join(''); 
    }
};

// ⭐ UPDATE TIMER DENGAN SYNC
const updateTimer = (id) => {
    const state = localPsStates[id];
    if (!state || state.status === 'idle' || !state.tvOn) return;
    
    state.timeUsed++;
    
    // Sync ke backend setiap 10 detik
    if (state.timeUsed % 10 === 0) {
        syncStateToBackend(id);
    }
    
    renderSingleCard(id);
};

const startTimer = (id) => {
    const state = localPsStates[id];
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(() => updateTimer(id), 1000);
};

// ⭐ HANDLE START SESSION DENGAN SYNC
const handleStartSession = async (e) => {
    e.preventDefault();
    const id = document.getElementById('modalPsId').value;
    const durationInput = document.getElementById('durationHours').value;
    const durationHours = parseFloat(durationInput);
    
    if (!durationInput || isNaN(durationHours) || durationHours <= 0) { 
        alert("⚠️ Durasi tidak valid. Masukkan angka lebih dari 0."); 
        return; 
    }
    
    if (durationHours > 24) {
        alert("⚠️ Durasi maksimal 24 jam per sesi.");
        return;
    }
    
    const state = localPsStates[id];
    const isTopUp = state.status !== 'idle';
    
    if (!isTopUp) {
        const customerName = document.getElementById('customerName').value.trim();
        state.customer = customerName || `Player ${id}`;
        state.status = 'running';
        state.timeUsed = 0;
    }
    
    state.initialDurationSeconds += durationHours * 3600;
    state.tvOn = true;
    
    // ⭐ SYNC KE BACKEND SEGERA
    await syncStateToBackend(id);
    
    startTimer(id);
    sessionModal.classList.add('hidden');
    document.getElementById('sessionForm').reset();
    renderSingleCard(id);
};

const handlePayment = async (id) => {
    const state = localPsStates[id];
    if (!state || state.status === 'idle') return;

    const psTotal = calculatePsTotal(state.timeUsed, PS_RATE_PER_HOUR);
    const cafeTotal = calculateCafeTotal(state.cafeOrders);
    const grandTotal = psTotal + cafeTotal;

    const transactionData = {
        timestamp: new Date().toISOString(),
        psId: id,
        customer: state.customer,
        duration: state.timeUsed,
        psRevenue: psTotal,
        cafeRevenue: cafeTotal,
        grandTotal: grandTotal,
        cafeItems: state.cafeOrders
    };

    try {
        const response = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transactionData)
        });

        if (!response.ok) throw new Error('Gagal menyimpan transaksi');

        let receipt = `==============================\n      STRUK PEMBAYARAN\n==============================\nPS No.        : ${id}\nCustomer      : ${state.customer || '-'}\nWaktu Main    : ${formatTime(state.timeUsed)}\nTarif PS      : ${formatRupiah(psTotal)}\n\n`;
        if(state.cafeOrders.length > 0){ 
            receipt += `--- Pesanan Cafe ---\n`; 
            state.cafeOrders.forEach(o => { 
                receipt += `${o.quantity}x ${o.name.padEnd(15)}: ${formatRupiah(o.price * o.quantity)}\n`; 
            }); 
            receipt += `Total Cafe    : ${formatRupiah(cafeTotal)}\n\n`; 
        }
        receipt += `------------------------------\nGRAND TOTAL   : ${formatRupiah(grandTotal)}\n==============================\n`;
        document.getElementById('billingOutputDetails').textContent = receipt;
        
        outputModal.dataset.paidPsId = id; 
        outputModal.classList.remove('hidden');

    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// ⭐ EVENT HANDLER DENGAN SYNC
if (psGridContainer) {
    psGridContainer.addEventListener('click', async (e) => {
        const id = e.target.closest('.ps-card')?.dataset.id; 
        if (!id) return;
        
        if (e.target.matches('.btn-start, .btn-topup')) {
            document.getElementById('modalPsId').value = id;
            const modalTitle = document.getElementById('modalTitle');
            const isTopUp = localPsStates[id]?.status !== 'idle';
            modalTitle.innerHTML = isTopUp 
                ? `Tambah Durasi PS <span style="color:var(--purple)">${id}</span>` 
                : `Mulai Sesi PS <span style="color:var(--purple)">${id}</span>`;
            document.querySelector('#sessionForm .start-btn').textContent = isTopUp ? 'Tambah Durasi' : 'Mulai Sesi';
            sessionModal.classList.remove('hidden');
            
        } else if (e.target.matches('.stop')) {
            if (localPsStates[id]) {
                localPsStates[id].tvOn = false;
                await syncStateToBackend(id);
            }
            renderSingleCard(id);
            
        } else if (e.target.matches('.btn-pay')) {
            handlePayment(id);
            
        } else if (e.target.matches('.btn-tv')) {
            if (localPsStates[id]) {
                localPsStates[id].tvOn = !localPsStates[id].tvOn;
                if(localPsStates[id].tvOn) {
                    startTimer(id);
                }
                await syncStateToBackend(id);
            }
            renderSingleCard(id);
        }
    });
}

if(cafeMenuContainer) { 
    cafeMenuContainer.addEventListener('click', e => { 
        if(e.target.classList.contains('btn-add-to-order')) { 
            const itemName = e.target.dataset.name;
            const itemPrice = e.target.dataset.price; 
            document.getElementById('orderItemName').value = itemName; 
            document.getElementById('orderItemPrice').value = itemPrice; 
            
            const activePs = Object.keys(localPsStates).filter(id => localPsStates[id].status !== 'idle'); 
            if (activePs.length === 0) { 
                alert("Tidak ada PS yang aktif."); 
                return; 
            } 
            
            const selectTargetPs = document.getElementById('orderTargetPs'); 
            selectTargetPs.innerHTML = activePs.map(id => 
                `<option value="${id}">PS ${id} - ${localPsStates[id].customer || 'No Name'}</option>`
            ).join(''); 
            cafeOrderModal.classList.remove('hidden'); 
        } 
    }); 
}

document.querySelector('#sessionForm .cancel-btn').addEventListener('click', () => sessionModal.classList.add('hidden'));
document.getElementById('cancelOrderButton').addEventListener('click', () => cafeOrderModal.classList.add('hidden'));
document.getElementById('sessionForm').addEventListener('submit', handleStartSession);

document.getElementById('cafeOrderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('orderTargetPs').value; 
    const state = localPsStates[id];
    const itemName = document.getElementById('orderItemName').value;
    const itemPrice = parseInt(document.getElementById('orderItemPrice').value);
    const quantity = parseInt(document.getElementById('orderQuantity').value);
    
    if(state && quantity > 0) { 
        const existingOrder = state.cafeOrders.find(o => o.name === itemName); 
        if(existingOrder) { 
            existingOrder.quantity += quantity; 
        } else { 
            state.cafeOrders.push({ name: itemName, price: itemPrice, quantity }); 
        }
        
        // ⭐ SYNC KE BACKEND
        await syncStateToBackend(id);
        
        cafeOrderModal.classList.add('hidden'); 
        renderSingleCard(id);
    }
});

document.getElementById('closeOutputModal').addEventListener('click', () => {
    const paidPsId = outputModal.dataset.paidPsId;
    if (paidPsId && localPsStates[paidPsId]) {
        if (localPsStates[paidPsId].intervalId) {
            clearInterval(localPsStates[paidPsId].intervalId);
        }
        localPsStates[paidPsId] = { 
            status: 'idle', 
            timeUsed: 0, 
            customer: null, 
            cafeOrders: [], 
            initialDurationSeconds: 0, 
            tvOn: false 
        };
        renderSingleCard(paidPsId);
        delete outputModal.dataset.paidPsId;
    }
    outputModal.classList.add('hidden');
});

const renderReport = async () => { 
    try { 
        const responseHistory = await fetch(`${API_URL}/report/today`); 
        if (!responseHistory.ok) throw new Error('Gagal memuat riwayat transaksi'); 
        const todaysTransactions = await responseHistory.json(); 
        
        const totalRevenue = todaysTransactions.reduce((sum, t) => sum + t.grandTotal, 0); 
        const psRevenue = todaysTransactions.reduce((sum, t) => sum + t.psRevenue, 0); 
        const cafeRevenue = todaysTransactions.reduce((sum, t) => sum + t.cafeRevenue, 0); 
        
        document.getElementById('totalRevenue').textContent = formatRupiah(totalRevenue); 
        document.getElementById('psRevenue').textContent = formatRupiah(psRevenue); 
        document.getElementById('cafeRevenue').textContent = formatRupiah(cafeRevenue); 
        document.getElementById('transactionCount').textContent = todaysTransactions.length; 
        
        const historyBody = document.getElementById('transactionHistoryBody'); 
        if (todaysTransactions.length === 0) { 
            historyBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--grey-light);">Belum ada transaksi hari ini.</td></tr>`; 
        } else { 
            historyBody.innerHTML = todaysTransactions.reverse().map(t => { 
                const time = new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); 
                return `
                    <tr>
                        <td>${time}</td>
                        <td>PS ${t.psId}</td>
                        <td>${t.customer}</td>
                        <td>${formatRupiah(t.grandTotal)}</td>
                        <td><button class="detail-btn" data-id="${t.receiptId}">Detail</button></td>
                    </tr>
                `;
            }).join(''); 
        } 
        
        document.getElementById('reportDate').textContent = new Date().toLocaleDateString('id-ID', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }); 
        
        const responseTopProducts = await fetch(`${API_URL}/report/top-products`); 
        if (!responseTopProducts.ok) throw new Error('Gagal memuat produk terlaris'); 
        const topProducts = await responseTopProducts.json(); 
        
        const topProductsBody = document.getElementById('topProductsBody'); 
        if(topProducts.length === 0) { 
            topProductsBody.innerHTML = `<li style="justify-content: center; color: var(--grey-light);">Belum ada produk terjual hari ini.</li>`; 
        } else { 
            topProductsBody.innerHTML = topProducts.map(product => 
                `<li><span class="product-name">${product.name}</span><span class="product-qty">${product.quantity}x Terjual</span></li>`
            ).join(''); 
        } 
    } catch (error) { 
        alert('Error: ' + error.message); 
    } 
};

const downloadReportCSV = () => {
    fetch(`${API_URL}/report/today`).then(r => r.json()).then(data => {
        if (data.length === 0) { 
            return alert("Tidak ada data transaksi hari ini untuk diunduh."); 
        }
        
        const csvHeader = ["Waktu", "PS", "Detail", "Total Bayar"];
        const csvRows = data.map(t => {
            const time = new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const cafeDetails = (t.cafeItems || []).map(item => `${item.quantity}x ${item.name}`).join(', ');
            return [time, `PS ${t.psId}`, `"${t.customer} | ${cafeDetails || 'Tanpa pesanan'}"`, String(t.grandTotal)].join(';');
        });
        
        const csvContent = [csvHeader.join(';'), ...csvRows].join('\n');
        const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan_Hari_Ini_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });
};

const downloadReportPDF = () => {
    if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF.API.autoTable) {
        return alert("⚠️ jsPDF atau plugin autoTable belum aktif sepenuhnya.");
    }
    
    fetch(`${API_URL}/report/today`).then(r => r.json()).then(data => {
        if (data.length === 0) { 
            return alert("Tidak ada data transaksi hari ini untuk diunduh."); 
        }
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const docTitle = `LAPORAN HARIAN REXUS PLAYSTATION`;
        const docDate = `Tanggal: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
        const headers = [["Waktu", "PS", "Detail", "Total Bayar"]];
        const rows = data.map(t => {
            const time = new Date(t.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const cafeDetails = (t.cafeItems || []).map(item => `${item.quantity}x ${item.name}`).join(', ');
            return [time, `PS ${t.psId}`, `${t.customer} | ${cafeDetails || '-'}`, formatRupiah(t.grandTotal)];
        });
        
        const totalRevenue = data.reduce((sum, t) => sum + t.grandTotal, 0);
        const psRevenue = data.reduce((sum, t) => sum + t.psRevenue, 0);
        const cafeRevenue = data.reduce((sum, t) => sum + t.cafeRevenue, 0);
        
        let y = 15;
        pdf.setFontSize(16); pdf.text(docTitle, 14, y); y += 7;
        pdf.setFontSize(10); pdf.text(docDate, 14, y); y += 10;
        pdf.text(`Total Pendapatan: ${formatRupiah(totalRevenue)}`, 14, y); y += 5;
        pdf.text(`Dari Billing PS: ${formatRupiah(psRevenue)}`, 14, y); y += 5;
        pdf.text(`Dari Penjualan Cafe: ${formatRupiah(cafeRevenue)}`, 14, y); y += 5;
        pdf.text(`Jumlah Transaksi: ${data.length}`, 14, y); y += 15;
        pdf.setFontSize(14); pdf.text('Riwayat Transaksi', 14, y); y += 5;
        
        pdf.autoTable({
            head: headers, 
            body: rows, 
            startY: y, 
            theme: 'striped',
            headStyles: { fillColor: [56, 47, 86], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
            columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 20 }, 3: { cellWidth: 30, halign: 'right' } },
            margin: { top: 10, left: 10, right: 10 }
        });
        
        pdf.save(`Laporan_Harian_${new Date().toISOString().slice(0, 10)}.pdf`);
    });
};

if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', downloadReportCSV);
if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', downloadReportPDF);

document.querySelectorAll('.nav-menu a').forEach(link => { 
    link.addEventListener('click', e => { 
        e.preventDefault(); 
        document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active')); 
        link.parentElement.classList.add('active'); 
        
        const targetId = link.dataset.target; 
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.add('hidden')); 
        document.getElementById(targetId).classList.remove('hidden'); 
        
        if(targetId === 'inventoryContent') headerTitle.textContent = "INVENTORY BILLING"; 
        if(targetId === 'cafeContent') { 
            headerTitle.textContent = "CAFE MENU"; 
            renderCafeMenu(); 
        } 
        if(targetId === 'settingsContent') headerTitle.textContent = "SETTINGS"; 
        if(targetId === 'reportContent') { 
            headerTitle.textContent = "LAPORAN"; 
            renderReport(); 
        } 
    }); 
});

const editCafePricesBtn = document.getElementById('editCafePricesBtn');
const cafeRateModalBody = document.getElementById('cafeRateModalBody');
const saveCafeRateChangeBtn = document.getElementById('saveCafeRateChange');
const cancelCafeRateChangeBtn = document.getElementById('cancelCafeRateChange');

const renderCafeRateModal = () => { 
    cafeRateModalBody.innerHTML = CAFE_MENU.map(item => 
        `<div class="form-group-inline" style="padding: 10px 0;">
            <label>${item.name}</label>
            <input type="number" class="cafe-price-input" value="${item.price}" data-name="${item.name}" style="background-color: var(--sidebar-bg);">
        </div>`
    ).join(''); 
};

if (editCafePricesBtn) { 
    editCafePricesBtn.addEventListener('click', () => { 
        renderCafeRateModal();
        cafeRateModal.classList.remove('hidden'); 
    }); 
}

if (cancelCafeRateChangeBtn) { 
    cancelCafeRateChangeBtn.addEventListener('click', () => { 
        cafeRateModal.classList.add('hidden'); 
    }); 
}

if (saveCafeRateChangeBtn) {
    saveCafeRateChangeBtn.addEventListener('click', async () => {
        const tempMenu = JSON.parse(JSON.stringify(CAFE_MENU)); 
        const inputs = cafeRateModalBody.querySelectorAll('.cafe-price-input');
        
        inputs.forEach(input => { 
            const itemName = input.dataset.name;
            const newPrice = parseInt(input.value); 
            const menuItem = tempMenu.find(item => item.name === itemName); 
            if (menuItem && !isNaN(newPrice)) { 
                menuItem.price = newPrice; 
            } 
        });
        
        try { 
            const response = await fetch(`${API_URL}/cafe-menu`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ menu: tempMenu }) 
            }); 
            
            if (!response.ok) throw new Error('Gagal memperbarui harga'); 
            
            CAFE_MENU = tempMenu; 
            renderCafeMenu(); 
            alert('Harga menu berhasil diperbarui!'); 
            cafeRateModal.classList.add('hidden'); 
        } catch (error) { 
            alert('Error: ' + error.message); 
        }
    });
}

// === SIDEBAR TOGGLE/HAMBURGER MENU ===
const sidebar = document.querySelector(".sidebar");
const overlay = document.querySelector(".sidebar-overlay");
const menuToggleBtn = document.getElementById("menuToggle");

if (menuToggleBtn && sidebar && overlay) {
  menuToggleBtn.addEventListener("click", () => {
    const isActive = sidebar.classList.toggle("active");
    overlay.classList.toggle("show", isActive);
  });

  overlay.addEventListener("click", () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("show");
  });
}
window.addEventListener("resize", () => {
  if (window.innerWidth > 1024) {
    sidebar.classList.remove("active");
    overlay.classList.remove("show");
  }
});


const themeSelect = document.getElementById('themeSelect');
const applyThemeBtn = document.getElementById('applyTheme');

const applyTheme = (theme) => { 
    if (theme === 'light') { 
        document.body.classList.add('light-theme'); 
    } else { 
        document.body.classList.remove('light-theme'); 
    } 
    localStorage.setItem('theme', theme); 
};

if (applyThemeBtn && themeSelect) { 
    applyThemeBtn.addEventListener('click', () => { 
        const selectedTheme = themeSelect.value; 
        applyTheme(selectedTheme); 
    }); 
}

const savedTheme = localStorage.getItem('theme') || 'dark'; 
if (themeSelect) themeSelect.value = savedTheme; 
applyTheme(savedTheme);

// ⭐ INITIALIZE APP DENGAN LOAD STATE DARI BACKEND
const initializeApp = async () => {
    try {
        const response = await fetch(`${API_URL}/initial-data`);
        if (!response.ok) throw new Error('Gagal terhubung ke server');
        
        const data = await response.json();
        psUnits = data.ps_units; 
        CAFE_MENU = data.cafe_menu;
        
        // ⭐ LOAD STATE DARI BACKEND, BUKAN RESET KE IDLE
        psUnits.forEach(unit => {
            localPsStates[unit.id] = {
                status: unit.status || 'idle',
                timeUsed: unit.timeUsed || 0,
                customer: unit.customer || null,
                cafeOrders: unit.cafeOrders || [],
                initialDurationSeconds: unit.initialDurationSeconds || 0,
                tvOn: unit.tvOn || false,
                intervalId: null
            };
            
            // ⭐ RESTART TIMER JIKA PS MASIH RUNNING
            if (unit.status === 'running' && unit.tvOn) {
                startTimer(unit.id);
            }
        });
        
        renderAllCards();
        
        // ⭐ SINKRONISASI BERKALA SETIAP 30 DETIK
        setInterval(() => {
            Object.keys(localPsStates).forEach(id => {
                if (localPsStates[id].status !== 'idle') {
                    syncStateToBackend(id);
                }
            });
        }, 30000);
        
    } catch (error) {
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; color: var(--red);">
                <h1>Gagal Terhubung ke Server</h1>
                <p>Pastikan server back-end (node server.js) sudah berjalan.</p>
                <button onclick="location.reload()" style="
                    padding: 12px 24px;
                    background: var(--purple);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-top: 20px;
                ">🔄 Coba Lagi</button>
            </div>
        `;
    }
};

if(psGridContainer) initializeApp();

// ⭐ SYNC FINAL SEBELUM CLOSE TAB/BROWSER
window.addEventListener('beforeunload', () => {
    Object.keys(localPsStates).forEach(id => {
        if (localPsStates[id].status !== 'idle') {
            const data = JSON.stringify({
                status: localPsStates[id].status,
                customer: localPsStates[id].customer,
                timeUsed: localPsStates[id].timeUsed,
                initialDurationSeconds: localPsStates[id].initialDurationSeconds,
                tvOn: localPsStates[id].tvOn,
                cafeOrders: localPsStates[id].cafeOrders
            });
            navigator.sendBeacon(`${API_URL}/sessions/${id}/update`, data);
        }
    });
});

// RECEIPT DETAIL POPUP
document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("detail-btn")) {
        const id = e.target.dataset.id;
        try {
            const res = await fetch(`${API_URL}/receipts/${id}`);
            const receipt = await res.json();

            if (receipt) {
                showReceiptPopup(receipt);
            } else {
                alert("Struk tidak ditemukan di backend.");
            }
        } catch (err) {
            console.error(err);
            alert("Gagal mengambil data struk dari server.");
        }
    }
});

function showReceiptPopup(receipt) {
    const popup = document.createElement("div");
    popup.classList.add("receipt-popup");

    const formatDateTime = (isoString) => {
        if (!isoString) return "-";
        const date = new Date(isoString);
        return `${date.toLocaleDateString("id-ID")} ${date.toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
        })}`;
    };

    popup.innerHTML = `
        <div class="receipt-box">
            <div class="receipt-header">
                <h2>Rexus Playstation</h2>
                <p>Jl. Raya Cibugel No. 1 – Telp: 0812-3456-7890</p>
                <hr />
            </div>

            <div class="receipt-body">
                <div class="receipt-info">
                    <p><strong>Tanggal:</strong> ${formatDateTime(receipt.timestamp || new Date())}</p>
                    <p><strong>PS No.:</strong> ${receipt.psId}</p>
                    <p><strong>Customer:</strong> ${receipt.customer || "Umum"}</p>
                </div>

                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th>Deskripsi</th>
                            <th>Qty</th>
                            <th>Harga</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Sewa PS</td>
                            <td>1</td>
                            <td>${formatRupiah(receipt.psRevenue)}</td>
                            <td>${formatRupiah(receipt.psRevenue)}</td>
                        </tr>
                        ${
                            (receipt.items || [])
                                .map(
                                    (i) => `
                                <tr>
                                    <td>${i.name}</td>
                                    <td>${i.quantity}</td>
                                    <td>${formatRupiah(i.price)}</td>
                                    <td>${formatRupiah(i.price * i.quantity)}</td>
                                </tr>`
                                )
                                .join("") || ""
                        }
                    </tbody>
                </table>

                <div class="receipt-total">
                    <p><strong>Total Bayar:</strong> ${formatRupiah(receipt.grandTotal)}</p>
                </div>

                <div class="receipt-footer">
                    <p>Terima kasih sudah bermain di <strong>Rexus Playstation!</strong></p>
                    <p>~ Selamat bersenang-senang ~</p>
                </div>
            </div>

            <div class="receipt-actions">
                <button id="printReceipt">Cetak</button>
                <button id="savePDF">Simpan PDF</button>
                <button id="closeReceipt" class="close-btn">Tutup</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    const closeBtn = popup.querySelector("#closeReceipt");
    closeBtn.addEventListener("click", () => popup.remove());

    const actions = popup.querySelector(".receipt-actions");
    popup.querySelector("#printReceipt").addEventListener("click", () => {
        actions.style.display = "none";
        window.print();
        actions.style.display = "flex";
    });

    popup.querySelector("#savePDF").addEventListener("click", async () => {
        if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
            alert("Kesalahan: jsPDF atau html2canvas belum dimuat.");
            return;
        }
        
        const { jsPDF } = window.jspdf;
        actions.style.display = "none";
        const element = popup.querySelector(".receipt-box");

        await html2canvas(element, { scale: 3 }).then((canvas) => {
            const pdf = new jsPDF("p", "pt", "a4");
            
            const pdfWidth = 595.28;
            const pdfHeight = 841.89;
            const padding = 20;

            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            const ratio = (pdfWidth - 2 * padding) / canvasWidth;
            
            const imgWidth = pdfWidth - 2 * padding;
            const imgHeight = canvasHeight * ratio;

            let finalWidth = imgWidth;
            let finalHeight = imgHeight;
            let finalY = padding;
            
            if (imgHeight > pdfHeight - 2 * padding) {
                const scaleFactor = (pdfHeight - 2 * padding) / imgHeight;
                finalHeight = imgHeight * scaleFactor;
                finalWidth = imgWidth * scaleFactor;
                finalY = padding;
            }
            
            const imgData = canvas.toDataURL("image/jpeg", 1.0); 
            pdf.addImage(imgData, "JPEG", padding, finalY, finalWidth, finalHeight);

            pdf.save(`Struk_PS${receipt.psId}_${new Date().toISOString().slice(0, 10)}.pdf`);
        });
        actions.style.display = "flex";
    });
}
// ---------- Logout from sidebar (robust & accessible) ----------
const sidebarLogoutBtn = document.getElementById("sidebarLogoutBtn");
const logoutConfirmModal = document.getElementById("logoutConfirm");
const cancelLogoutBtn = document.getElementById("cancelLogout");
const confirmLogoutBtn = document.getElementById("confirmLogout");

// Safety checks
if (sidebarLogoutBtn && logoutConfirmModal && cancelLogoutBtn && confirmLogoutBtn) {
  // Open modal
  sidebarLogoutBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    logoutConfirmModal.classList.remove("hidden");
    logoutConfirmModal.setAttribute("aria-hidden", "false");
  });

  // Close: cancel button
  cancelLogoutBtn.addEventListener("click", () => {
    logoutConfirmModal.classList.add("hidden");
    logoutConfirmModal.setAttribute("aria-hidden", "true");
  });

  // Close: click outside the box (backdrop)
  logoutConfirmModal.addEventListener("click", (e) => {
    if (e.target === logoutConfirmModal) {
      logoutConfirmModal.classList.add("hidden");
      logoutConfirmModal.setAttribute("aria-hidden", "true");
    }
  });

  // Confirm: actually logout
  confirmLogoutBtn.addEventListener("click", () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("username");
    // optional: clear other state
    // localStorage.clear();
    window.location.href = "login.html";
  });
} else {
  // Debugging hint (safe): if some element missing, log to console — remove in production
  console.warn("Logout modal elements missing:", {
    sidebarLogoutBtn: !!sidebarLogoutBtn,
    logoutConfirmModal: !!logoutConfirmModal,
    cancelLogoutBtn: !!cancelLogoutBtn,
    confirmLogoutBtn: !!confirmLogoutBtn
  });
}

