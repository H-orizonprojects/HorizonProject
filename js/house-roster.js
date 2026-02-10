// Sample student data for all four houses
const studentData = {
    garuda: [
        {
            id: "RS-G001",
            name: "วรุตม์ สุรินทร์",
            year: 3,
            house: "garuda",
            photo: "assets/images/students/student1.png",
            hometown: "จังหวัดเชียงใหม่",
            allergies: ["กุ้ง", "ถั่วลิสง"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้สักทอง", icon: "🪄", file: "#" },
                { name: "เสื้อคลุมครุฑแดง", icon: "🧥", file: "#" },
                { name: "หนังสือคาถาป้องกัน", icon: "📖", file: "#" }
            ]
        },
        {
            id: "RS-G002",
            name: "ณัฐวุฒิ พงษ์ภาคิน",
            year: 2,
            house: "garuda",
            photo: "assets/images/students/student2.png",
            hometown: "จังหวัดนครราชสีมา",
            allergies: ["ไม่มี"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้มะค่า", icon: "🪄", file: "#" },
                { name: "ดาบเงินพญาครุฑ", icon: "⚔️", file: "#" }
            ]
        },
        {
            id: "RS-G003",
            name: "สิรภัทร วีรกุล",
            year: 4,
            house: "garuda",
            photo: "assets/images/students/student3.png",
            hometown: "จังหวัดขอนแก่น",
            allergies: ["นม"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้ประดู่", icon: "🪄", file: "#" },
                { name: "ลูกบอลคริสตัลแดง", icon: "🔮", file: "#" },
                { name: "ถุงมือเวทมนตร์", icon: "🧤", file: "#" }
            ]
        }
    ],
    erawan: [
        {
            id: "RS-E001",
            name: "พิมพ์ชนก จันทรเสนา",
            year: 2,
            house: "erawan",
            photo: "assets/images/students/student4.png",
            hometown: "จังหวัดกรุงเทพมหานคร",
            allergies: ["ไข่"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้จันทน์", icon: "🪄", file: "#" },
                { name: "เสื้อคลุมเอราวัณน้ำเงิน", icon: "🧥", file: "#" },
                { name: "อมฤตบริสุทธิ์", icon: "⚗️", file: "#" }
            ]
        },
        {
            id: "RS-E002",
            name: "ธนพล ศรีสุข",
            year: 3,
            house: "erawan",
            photo: "assets/images/students/student5.png",
            hometown: "จังหวัดนครศรีธรรมราช",
            allergies: ["ไม่มี"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้มะเกลือ", icon: "🪄", file: "#" },
                { name: "โล่เงินเอราวัณ", icon: "🛡️", file: "#" }
            ]
        },
        {
            id: "RS-E003",
            name: "วรนุช อรุณรัตน์",
            year: 1,
            house: "erawan",
            photo: "assets/images/students/student6.png",
            hometown: "จังหวัดสุราษฎร์ธานี",
            allergies: ["ขิง", "กระเทียม"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้ยางนา", icon: "🪄", file: "#" },
                { name: "แหวนพลังสถาพร", icon: "💍", file: "#" }
            ]
        }
    ],
    qilin: [
        {
            id: "RS-Q001",
            name: "ภัทรพล วงศ์ปัญญา",
            year: 4,
            house: "qilin",
            photo: "assets/images/students/student7.png",
            hometown: "จังหวัดพระนครศรีอยุธยา",
            allergies: ["ถั่วเหลือง"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้ไผ่", icon: "🪄", file: "#" },
                { name: "เสื้อคลุมกิเลนเขียว", icon: "🧥", file: "#" },
                { name: "หนังสือภูมิปัญญาโบราณ", icon: "📚", file: "#" }
            ]
        },
        {
            id: "RS-Q002",
            name: "ชญานิศ สุขสมบูรณ์",
            year: 2,
            house: "qilin",
            photo: "assets/images/students/student8.png",
            hometown: "จังหวัดเชียงราย",
            allergies: ["ไม่มี"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้ต้นโพธิ์", icon: "🪄", file: "#" },
                { name: "ลูกประคำมรกต", icon: "💎", file: "#" }
            ]
        },
        {
            id: "RS-Q003",
            name: "อัครพล ธรรมรักษ์",
            year: 3,
            house: "qilin",
            photo: "assets/images/students/student9.png",
            hometown: "จังหวัดลำปาง",
            allergies: ["หอยทะเล"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้แก่นจันทร์", icon: "🪄", file: "#" },
                { name: "หมึกเวทมนตร์สีทอง", icon: "🖋️", file: "#" }
            ]
        }
    ],
    naga: [
        {
            id: "RS-N001",
            name: "ธนวันต์ ศิริมงคล",
            year: 3,
            house: "naga",
            photo: "assets/images/students/student10.png",
            hometown: "จังหวัดนครพนม",
            allergies: ["พริก"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้งิ้วดำ", icon: "🪄", file: "#" },
                { name: "เสื้อคลุมพญานาคดำ", icon: "🧥", file: "#" },
                { name: "หนังสือคาถาลับ", icon: "📕", file: "#" }
            ]
        },
        {
            id: "RS-N002",
            name: "สุธาสินี นาคบุตร",
            year: 4,
            house: "naga",
            photo: "assets/images/students/student11.png",
            hometown: "จังหวัดอุบลราชธานี",
            allergies: ["ไม่มี"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้ตะเคียน", icon: "🪄", file: "#" },
                { name: "แหวนนาคราช", icon: "💍", file: "#" },
                { name: "ไข่มุกมนตรา", icon: "⚪", file: "#" }
            ]
        },
        {
            id: "RS-N003",
            name: "รัชภูมิ เงาปริศนา",
            year: 2,
            house: "naga",
            photo: "assets/images/students/student12.png",
            hometown: "จังหวัดมุกดาหาร",
            allergies: ["แป้ง"],
            inventory: [
                { name: "ไม้กายสิทธิ์ไม้กระดูกงู", icon: "🪄", file: "#" },
                { name: "กระจกทรายมนตรา", icon: "🪞", file: "#" }
            ]
        }
    ]
};

// DOM Elements
let currentHouse = '';
let currentStudentId = '';
let filteredStudents = [];

document.addEventListener('DOMContentLoaded', () => {
    initializeHouseCards();
    initializeModal();
});

function initializeHouseCards() {
    const houseCards = document.querySelectorAll('.house-card');

    houseCards.forEach(card => {
        card.addEventListener('click', () => {
            const houseType = getHouseType(card);
            if (houseType) {
                openStudentModal(houseType);
            }
        });
    });
}

function getHouseType(card) {
    if (card.classList.contains('house-garuda')) return 'garuda';
    if (card.classList.contains('house-erawan')) return 'erawan';
    if (card.classList.contains('house-qilin')) return 'qilin';
    if (card.classList.contains('house-naga')) return 'naga';
    return null;
}

function getHouseName(houseType) {
    const houseNames = {
        garuda: { th: 'พญาครุฑ', en: 'GARUDA HOUSE' },
        erawan: { th: 'เอราวัณ', en: 'ERAWAN HOUSE' },
        qilin: { th: 'กิเลน', en: 'QILIN HOUSE' },
        naga: { th: 'พญานาค', en: 'KING OF NAGAS HOUSE' }
    };
    return houseNames[houseType];
}

function getHouseIcon(houseType) {
    const icons = {
        garuda: 'assets/images/Garuda.png',
        erawan: 'assets/images/Erawan.png',
        qilin: 'assets/images/Qilin.png',
        naga: 'assets/images/King of Nagas.png'
    };
    return icons[houseType];
}

function openStudentModal(houseType) {
    currentHouse = houseType;
    filteredStudents = studentData[houseType];

    const modal = document.getElementById('studentModal');
    const houseName = getHouseName(houseType);
    const houseIcon = getHouseIcon(houseType);

    // Update modal header
    document.getElementById('modalHouseIcon').src = houseIcon;
    document.getElementById('modalHouseTitle').innerHTML = `
        ${houseName.th}<br>
        <small style="font-size: 0.6em; opacity: 0.8;">${houseName.en}</small>
    `;

    // Show student list
    showStudentList();

    // Show modal with animation
    modal.classList.add('active');
    createModalParticles();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('studentModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Reset search and views
    setTimeout(() => {
        document.getElementById('searchBox').value = '';
        hideStudentDetail();
    }, 400);
}

function initializeModal() {
    const modal = document.getElementById('studentModal');
    const closeBtn = document.getElementById('closeModal');
    const searchBox = document.getElementById('searchBox');
    const backBtn = document.getElementById('backToList');

    // Close button
    closeBtn.addEventListener('click', closeModal);

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });

    // Search functionality
    searchBox.addEventListener('input', (e) => {
        filterStudents(e.target.value);
    });

    // Back button
    backBtn.addEventListener('click', showStudentList);
}

function filterStudents(query) {
    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm) {
        filteredStudents = studentData[currentHouse];
    } else {
        filteredStudents = studentData[currentHouse].filter(student => {
            return student.id.toLowerCase().includes(searchTerm) ||
                student.name.toLowerCase().includes(searchTerm) ||
                student.year.toString().includes(searchTerm);
        });
    }

    renderStudentTable();
}

function showStudentList() {
    document.getElementById('studentListView').style.display = 'block';
    document.getElementById('studentDetailView').classList.remove('active');
    renderStudentTable();
}

function renderStudentTable() {
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '';

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="no-results">
                    ไม่พบข้อมูลนักเรียนที่ค้นหา
                </td>
            </tr>
        `;
        return;
    }

    filteredStudents.forEach(student => {
        const row = document.createElement('tr');
        row.className = 'student-row';
        row.innerHTML = `
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>ปีที่ ${student.year}</td>
        `;
        row.addEventListener('click', () => showStudentDetail(student.id));
        tbody.appendChild(row);
    });
}

function showStudentDetail(studentId) {
    const student = studentData[currentHouse].find(s => s.id === studentId);
    if (!student) return;

    currentStudentId = studentId;

    // Hide list, show detail
    document.getElementById('studentListView').style.display = 'none';
    document.getElementById('studentDetailView').classList.add('active');

    // Populate detail view
    document.getElementById('studentPhoto').src = student.photo;
    document.getElementById('studentPhoto').alt = student.name;
    document.getElementById('studentName').textContent = student.name;
    document.getElementById('studentIdDetail').textContent = `ID: ${student.id}`;
    document.getElementById('studentYear').textContent = `ปีที่ ${student.year}`;
    document.getElementById('studentHometown').textContent = student.hometown;
    document.getElementById('studentAllergies').textContent = student.allergies.join(', ');

    // Render inventory
    const inventoryList = document.getElementById('inventoryList');
    inventoryList.innerHTML = '';
    student.inventory.forEach(item => {
        const itemEl = document.createElement('a');
        itemEl.href = item.file;
        itemEl.className = 'inventory-item';
        itemEl.target = '_blank';
        itemEl.innerHTML = `
            <span class="item-icon">${item.icon}</span>
            <span class="item-name">${item.name}</span>
            <span class="item-link-icon">→</span>
        `;
        inventoryList.appendChild(itemEl);
    });
}

function hideStudentDetail() {
    document.getElementById('studentDetailView').classList.remove('active');
}

function createModalParticles() {
    const container = document.querySelector('.modal-particles');
    if (!container) return;

    container.innerHTML = '';

    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'modal-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (4 + Math.random() * 4) + 's';
        container.appendChild(particle);
    }
}
