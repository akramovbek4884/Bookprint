import { getDailySummary, getTodayStr, formatPrice } from './store.js';

const MOTIVATIONS = [
    "Sizning bugungi mehnatingiz – ertangi kuningizning poydevoridir. Faqat olg'a!",
    "Har bir qiyin kun ortida katta tajriba va muvaffaqiyat yashiringan.",
    "Biznesda asosiysi barqarorlikdir. Buyuk natijalar sekin-asta keladi.",
    "Siz uddalaysiz! Ertalabki ijobiy kayfiyat kun davomida g'alaba keltiradi."
];

const BUSINESS_TIPS = [
    "Mijozlarga tabassum qilishni unutmang! Tabassum eng kuchli sotuv qurolidir.",
    "Eng ko'p sotiladigan mayda tovarlarni kassa oldiga joylashtiring (kross-sell).",
    "Mijozning ismini eslab qolish uni doimiy sodiq xaridorga aylantiradi.",
    "Yangi kelgan tovarlar haqida mijozlarga qisqacha ma'lumot bering. Bu qiziqish uyg'otadi.",
    "Har xariddan keyin 'Yana keling' deyish mijozning qaytish ehtimolini 30% ga oshiradi!"
];

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

export function initRobot() {
    const container = document.createElement('div');
    container.innerHTML = `
    <!-- Floating Bouncing Robot Icon -->
    <div id="ai-robot-btn" class="bouncing-robot">
      🤖
      <div class="tooltip">Savdo yordamchisi</div>
    </div>

    <!-- Robot Popup Window -->
    <div id="ai-robot-popup" class="robot-popup hidden">
      <div class="robot-popup-header">
        <h4>🤖 Biznes Yordamchingiz</h4>
        <button id="close-robot-popup">✖</button>
      </div>
      <div class="robot-popup-content">
        
        <!-- Daily Stats Segment -->
        <div class="robot-box stat-box">
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">📅 Bugungi natijalar</div>
          <div id="robot-daily-sales" style="font-weight: bold; color: var(--accent-success); font-size: 1.1rem;">Asosiy server bilan bog'lanilmoqda...</div>
          <div id="robot-daily-count" style="font-size: 0.85rem; margin-top: 3px; color: var(--text-secondary);"></div>
        </div>

        <!-- Motivation Segment -->
        <div class="robot-box motivation-box">
          <div style="font-size: 0.8rem; color: var(--accent-warning); margin-bottom: 5px; font-weight: bold;">✨ Motivatsiya</div>
          <div id="robot-motivation" style="font-style: italic; font-size: 0.9rem;"></div>
        </div>

        <!-- Tip Segment -->
        <div class="robot-box tip-box">
          <div style="font-size: 0.8rem; color: var(--accent-primary); margin-bottom: 5px; font-weight: bold;">💡 Maslahat</div>
          <div id="robot-tip" style="font-size: 0.9rem;"></div>
        </div>

      </div>
    </div>
  `;

    document.body.appendChild(container);

    const robotBtn = document.getElementById('ai-robot-btn');
    const popup = document.getElementById('ai-robot-popup');
    const closeBtn = document.getElementById('close-robot-popup');

    const updatePopupData = () => {
        // 1. Fetch live daily stats
        const today = getTodayStr();
        const summary = getDailySummary(today);

        const salesEl = document.getElementById('robot-daily-sales');
        const countEl = document.getElementById('robot-daily-count');
        if (summary.salesCount === 0) {
            salesEl.innerHTML = "Hozircha kirim yo'q";
            salesEl.style.color = "var(--text-muted)";
            countEl.innerHTML = "Birinchi savdoni kutyapmiz!";
        } else {
            salesEl.innerHTML = formatPrice(summary.totalRevenue);
            salesEl.style.color = "var(--accent-success)";
            countEl.innerHTML = `Jami sotildi: ${summary.totalItems} ta tovar (${summary.salesCount} ta chek)`;
        }

        // 2. Insert text
        document.getElementById('robot-motivation').textContent = getRandomItem(MOTIVATIONS);
        document.getElementById('robot-tip').textContent = getRandomItem(BUSINESS_TIPS);
    };

    robotBtn.addEventListener('click', () => {
        updatePopupData();
        popup.classList.remove('hidden');
        popup.classList.add('popup-enter');
        // Temporarily stop jumping while reading
        robotBtn.style.animation = 'none';
    });

    closeBtn.addEventListener('click', () => {
        popup.classList.add('hidden');
        popup.classList.remove('popup-enter');
        // Restore jumping 
        robotBtn.style.animation = 'float-bounce 3s infinite ease-in-out';
    });
}
