const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { Resvg } = require('@resvg/resvg-js');

const app = express();
// زيادة الحد الأقصى لحجم البيانات لاستقبال صور البروفايل base64 الكبيرة بسلاسة
app.use(express.json({ limit: '10mb' }));

// تنزيل الخط العربي الفخم تلقائياً من جوجل للرسم به بدقة عالية
const FONT_URL = 'https://github.com/googlefonts/cairo/raw/main/fonts/ttf/Cairo-Bold.ttf';
const FONT_PATH = path.join('/tmp', 'Cairo-Bold.ttf');
let hasFont = false;

https.get(FONT_URL, (res) => {
    const file = fs.createWriteStream(FONT_PATH);
    res.pipe(file);
    file.on('finish', () => { 
        file.close(); 
        hasFont = true; 
        console.log('✅ Cairo Font Loaded Successfully!'); 
    });
}).on('error', (err) => {
    console.error('❌ Failed to download Cairo font:', err);
});

// تعقيم النصوص لمنع الأخطاء في SVG
function escapeXml(unsafe) {
    return (unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// 🛡️ تصفية الرموز والإيموجيات غير المدعومة في الخط لمنع ظهور المربعات المكسورة ▯
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2000}-\u{2BFF}\u{E000}-\u{F8FF}]/gu, '')
        .trim();
}

// ==================== أيقونات الفيكتور الفخمة المستعملة في المعاينة ====================
const SVG_ICONS = {
    lightning: (fill = '#fbbf24', size = 20) => `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="${fill}" stroke="${fill}" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`,
    crown: (fill = '#fbbf24', size = 24) => `
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
        <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z" fill="${fill}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="12" cy="4" r="1.5" fill="#ffffff"/>
        <circle cx="3" cy="5" r="1.5" fill="#ffffff"/>
        <circle cx="21" cy="5" r="1.5" fill="#ffffff"/>
        <rect x="5" y="16" width="14" height="2.5" rx="1" fill="#f59e0b"/>
      </svg>`,
    goldMedal: (radius = 28) => `
      <g>
        <circle cx="0" cy="0" r="${radius}" fill="#451a03" stroke="#f59e0b" stroke-width="2"/>
        <circle cx="0" cy="0" r="${radius - 4}" fill="url(#goldPillarGrad)"/>
        <path d="M-6 -10 L0 -16 L6 -10 L0 -4 Z" fill="#ffffff" opacity="0.8"/>
        <text x="0" y="8" text-anchor="middle" fill="#451a03" font-family="Cairo" font-weight="900" font-size="${Math.round(radius * 0.9)}">1</text>
      </g>`,
    silverMedal: (radius = 24) => `
      <g>
        <circle cx="0" cy="0" r="${radius}" fill="#1e293b" stroke="#94a3b8" stroke-width="2"/>
        <circle cx="0" cy="0" r="${radius - 4}" fill="url(#silverPillarGrad)"/>
        <text x="0" y="7" text-anchor="middle" fill="#0f172a" font-family="Cairo" font-weight="900" font-size="${Math.round(radius * 0.9)}">2</text>
      </g>`,
    bronzeMedal: (radius = 22) => `
      <g>
        <circle cx="0" cy="0" r="${radius}" fill="#431407" stroke="#ea580c" stroke-width="2"/>
        <circle cx="0" cy="0" r="${radius - 4}" fill="url(#bronzePillarGrad)"/>
        <text x="0" y="6" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="${Math.round(radius * 0.9)}">3</text>
      </g>`,
    chat: (fill = '#38bdf8', size = 22) => `
      <g transform="translate(${-size/2}, ${-size/2})">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5C21 16.1944 16.9706 20 12 20C10.5276 20 9.13682 19.6644 7.91572 19.0689L3 20.5L4.67595 16.8129C3.63004 15.3023 3 13.4831 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z" fill="${fill}" fill-opacity="0.2" stroke="${fill}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="8" cy="11.5" r="1" fill="${fill}"/>
          <circle cx="12" cy="11.5" r="1" fill="${fill}"/>
          <circle cx="16" cy="11.5" r="1" fill="${fill}"/>
        </svg>
      </g>`,
    trophy: (fill = '#f59e0b', size = 22) => `
      <g transform="translate(${-size/2}, ${-size/2})">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
          <path d="M6 9V4H18V9C18 12.3137 15.3137 15 12 15C8.68629 15 6 12.3137 6 9Z" fill="${fill}" fill-opacity="0.2" stroke="${fill}" stroke-width="2"/>
          <path d="M6 5H3C3 7.5 4.5 9 6 9.5M18 5H21C21 7.5 19.5 9 18 9.5M12 15V19M8 21H16" stroke="${fill}" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </g>`,
    globe: (fill = '#38bdf8', size = 22) => `
      <g transform="translate(${-size/2}, ${-size/2})">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="${fill}" stroke-width="2" fill="${fill}" fill-opacity="0.15"/>
          <path d="M3 12H21M12 3C14.5 6 15.5 9 15.5 12C15.5 15 14.5 18 12 21C9.5 18 8.5 15 8.5 12C8.5 9 9.5 6 12 3Z" stroke="${fill}" stroke-width="1.8"/>
        </svg>
      </g>`,
    star: (fill = '#f59e0b', size = 16) => `
      <g transform="translate(${-size/2}, ${-size/2})">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}">
          <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9"/>
        </svg>
      </g>`,
    mask: (fill = '#ec4899', size = 16) => `
      <g transform="translate(${-size/2}, ${-size/2})">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${fill}" stroke-width="2">
          <path d="M2 10C2 15 6 19 12 19C18 19 22 15 22 10C22 7 20 5 17 5C14 5 13 7 12 8C11 7 10 5 7 5C4 5 2 7 2 10Z" fill="${fill}" fill-opacity="0.2"/>
          <ellipse cx="7.5" cy="11.5" rx="2" ry="1.5" fill="${fill}"/>
          <ellipse cx="16.5" cy="11.5" rx="2" ry="1.5" fill="${fill}"/>
        </svg>
      </g>`,
    pin: (fill = '#94a3b8', size = 14) => `
      <g transform="translate(${-size/2}, ${-size/2})">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}">
          <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z"/>
        </svg>
      </g>`
};

// ==================== بطاقة تفاعلي الشخصية (VIP Gamer HUD) ====================
app.post('/api/render/user-card', (req, res) => {
    const p = req.body;
    const primaryColor = p.primaryColor || '#ff6a00';
    const secondaryColor = p.secondaryColor || '#f59e0b';
    
    // تصفية النصوص وتعقيمها لحمايتها من المربعات ▯
    const userName = escapeXml(cleanText(p.userName) || 'عضو');
    const groupName = escapeXml(cleanText(p.groupName) || 'مجموعة');
    const badgeTitle = escapeXml(cleanText(p.badgeTitle) || 'صوت العقل والمنطق');

    const userCount = Number(p.userCount) || 0;
    const totalGroupCount = Number(p.totalGroupCount) || 1;
    const userRank = Number(p.userRank) || 1;
    const totalMembers = Number(p.totalMembers) || 1;
    const globalCount = Number(p.globalCount) || userCount;
    const level = Number(p.level) || 1;
    const currentXp = Number(p.currentXp) || 0;
    const stepXp = Number(p.stepXp) || 75;

    const pct = Math.min(100, Math.max(0.1, ((userCount / Math.max(1, totalGroupCount)) * 100))).toFixed(1);
    const xpProgress = Math.min(100, Math.max(0, Math.round((currentXp / Math.max(1, stepXp)) * 100)));
    const remXp = Math.max(0, stepXp - currentXp);
    const nextLevel = level + 1;

    const radius = 115;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * (Number(pct) / 100));

    // إذا كانت صورة العضو متوفرة يتم إظهارها، وإلا نظهر أيقونة الصاعقة
    const avatarImageTag = p.avatarBase64 ? `
      <clipPath id="avatarClip">
        <circle cx="55" cy="52" r="34" />
      </clipPath>
      <circle cx="55" cy="52" r="36" fill="${primaryColor}" stroke="#ffffff" stroke-width="2" />
      <image href="${p.avatarBase64}" x="21" y="18" width="68" height="68" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)" />
    ` : `
      <circle cx="55" cy="52" r="32" fill="url(#avatarGlowGrad)" stroke="${primaryColor}" stroke-width="2" />
      <g transform="translate(55, 52)">
        ${SVG_ICONS.lightning(primaryColor, 30)}
      </g>
    `;

    const svg = `
    <svg width="1150" height="580" viewBox="0 0 1150 580" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primaryColor}" />
          <stop offset="100%" stop-color="${secondaryColor}" />
        </linearGradient>
        <linearGradient id="cardBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(24, 18, 28, 0.85)" />
          <stop offset="100%" stop-color="rgba(10, 8, 14, 0.95)" />
        </linearGradient>
        <linearGradient id="barGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${primaryColor}" />
          <stop offset="100%" stop-color="${secondaryColor}" />
        </linearGradient>
        <linearGradient id="avatarGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(255, 106, 0, 0.3)" />
          <stop offset="100%" stop-color="rgba(245, 158, 11, 0.1)" />
        </linearGradient>
        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.03)" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="1150" height="580" fill="#080608" />
      <rect width="1150" height="580" fill="url(#grid)" />
      <circle cx="250" cy="280" r="180" fill="${primaryColor}" fill-opacity="0.08" filter="url(#neonGlow)" />
      <circle cx="950" cy="180" r="150" fill="${secondaryColor}" fill-opacity="0.06" filter="url(#neonGlow)" />
      <path d="M 25 55 L 25 25 L 55 25" stroke="${primaryColor}" stroke-width="3" fill="none" />
      <path d="M 1125 55 L 1125 25 L 1095 25" stroke="${secondaryColor}" stroke-width="3" fill="none" />
      <path d="M 25 525 L 25 555 L 55 555" stroke="${secondaryColor}" stroke-width="3" fill="none" />
      <path d="M 1125 525 L 1125 555 L 1095 555" stroke="${primaryColor}" stroke-width="3" fill="none" />
      
      <g transform="translate(575, 45)">
        <rect x="-260" y="-18" width="520" height="36" rx="18" fill="rgba(0,0,0,0.6)" stroke="${primaryColor}" stroke-width="1.5" stroke-opacity="0.8" />
        <g transform="translate(-180, -9)">${SVG_ICONS.lightning(primaryColor, 18)}</g>
        <text text-anchor="middle" y="6" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="16">
          VIP GAMER HUD • بطاقة التفاعل الشخصية
        </text>
        <g transform="translate(165, -9)">${SVG_ICONS.lightning(primaryColor, 18)}</g>
      </g>
      
      <g transform="translate(250, 290)">
        <circle cx="0" cy="0" r="165" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1" />
        <circle cx="0" cy="0" r="145" fill="none" stroke="${primaryColor}" stroke-width="1.5" stroke-dasharray="6 12" stroke-opacity="0.4" />
        <circle cx="0" cy="0" r="130" fill="none" stroke="rgba(255, 255, 255, 0.06)" stroke-width="1" />
        <circle cx="0" cy="0" r="${radius}" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="22" />
        <circle cx="0" cy="0" r="${radius}" fill="none" stroke="url(#neonGrad)" stroke-width="22" stroke-dasharray="${circumference}" stroke-dashoffset="${strokeDashoffset}" stroke-linecap="round" transform="rotate(-90)" filter="url(#neonGlow)" />
        <circle cx="0" cy="0" r="82" fill="#0c0a09" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
        <circle cx="0" cy="0" r="76" fill="rgba(255,255,255,0.02)" />
        <g transform="translate(0, -22)">${SVG_ICONS.lightning(primaryColor, 20)}</g>
        <text text-anchor="middle" y="10" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="28">%${pct}</text>
        <text text-anchor="middle" y="32" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="11">حصة التفاعل بالقروب</text>
        <text text-anchor="middle" y="52" fill="${primaryColor}" font-family="Cairo" font-weight="800" font-size="12">LEVEL ${level}</text>
      </g>
      
      <g transform="translate(500, 95)">
        <g transform="translate(0, 0)">
          <rect width="590" height="105" rx="16" fill="url(#cardBgGrad)" stroke="${primaryColor}" stroke-width="1.5" stroke-opacity="0.6" />
          <line x1="20" y1="0" x2="160" y2="0" stroke="${secondaryColor}" stroke-width="3" />
          ${avatarImageTag}
          <g transform="translate(565, 30)">
            <g transform="translate(0, -10)">
              <text text-anchor="end" fill="${secondaryColor}" font-family="Cairo" font-weight="800" font-size="14">اللقب: ${badgeTitle}</text>
              <g transform="translate(14, -12)">${SVG_ICONS.mask(secondaryColor, 14)}</g>
            </g>
            <text text-anchor="end" y="24" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="21">${userName}</text>
            <g transform="translate(0, 44)">
              <text text-anchor="end" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">${groupName}</text>
              <g transform="translate(10, -10)">${SVG_ICONS.pin('#94a3b8', 12)}</g>
            </g>
          </g>
        </g>
        
        <g transform="translate(0, 118)">
          <rect width="590" height="96" rx="16" fill="url(#cardBgGrad)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
          <g transform="translate(565, 26)">
            <text text-anchor="end" fill="#fed7aa" font-family="Cairo" font-weight="800" font-size="14">المستوى: LEVEL ${level}</text>
            <g transform="translate(14, -12)">${SVG_ICONS.star('#f59e0b', 14)}</g>
          </g>
          <text x="25" y="28" text-anchor="start" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">متبقي ${remXp} XP للمستوى ${nextLevel}</text>
          <g transform="translate(25, 48)">
            <rect width="540" height="22" rx="11" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
            <rect width="${Math.max(16, (540 * xpProgress) / 100)}" height="22" rx="11" fill="url(#barGrad)" filter="url(#softGlow)" />
            <text x="270" y="16" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="12">${xpProgress}% (${currentXp}/${p.stepXp || 75} XP)</text>
          </g>
        </g>
        
        <g transform="translate(0, 226)">
          <rect width="590" height="190" rx="18" fill="url(#cardBgGrad)" stroke="${secondaryColor}" stroke-width="1.2" stroke-opacity="0.4" />
          
          <g transform="translate(18, 18)">
            <rect width="170" height="154" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
            <g transform="translate(85, 30)">${SVG_ICONS.chat('#38bdf8', 24)}</g>
            <text x="85" y="64" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">رسائلك بالقروب</text>
            <text x="85" y="104" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="24">${userCount.toLocaleString()}</text>
            <text x="85" y="132" text-anchor="middle" fill="${primaryColor}" font-family="Cairo" font-weight="800" font-size="13">حصة: %${pct}</text>
          </g>
          
          <g transform="translate(210, 18)">
            <rect width="170" height="154" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
            <g transform="translate(85, 30)">${SVG_ICONS.trophy('#f59e0b', 24)}</g>
            <text x="85" y="64" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">الترتيب العام</text>
            <text x="85" y="104" text-anchor="middle" fill="#fef08a" font-family="Cairo" font-weight="900" font-size="24">#${userRank}</text>
            <text x="85" y="132" text-anchor="middle" fill="#cbd5e1" font-family="Cairo" font-weight="700" font-size="12">من أصل ${totalMembers} عضو</text>
          </g>
          
          <g transform="translate(402, 18)">
            <rect width="170" height="154" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
            <g transform="translate(85, 30)">${SVG_ICONS.globe('#a855f7', 24)}</g>
            <text x="85" y="64" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">التفاعل الشامل</text>
            <text x="85" y="104" text-anchor="middle" fill="#38bdf8" font-family="Cairo" font-weight="900" font-size="24">${globalCount.toLocaleString()}</text>
            <text x="85" y="132" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">رسالة مسجلة</text>
          </g>
        </g>
      </g>
      
      <g transform="translate(575, 555)">
        <g transform="translate(-180, -9)">${SVG_ICONS.lightning(primaryColor, 14)}</g>
        <text text-anchor="middle" fill="rgba(255, 255, 255, 0.4)" font-family="Cairo" font-weight="800" font-size="12">
          Activity Tracker Bot • نظام إحصائيات التفاعل الاحترافي
        </text>
        <g transform="translate(170, -9)">${SVG_ICONS.lightning(primaryColor, 14)}</g>
      </g>
    </svg>`;

    try {
        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: 3000 },
            font: hasFont ? { fontFiles: [FONT_PATH], defaultFontFamily: 'Cairo', loadSystemFonts: true } : { loadSystemFonts: true }
        });
        res.setHeader('Content-Type', 'image/png');
        res.send(resvg.render().asPng());
    } catch (e) {
        console.error(e);
        res.status(500).send('Error rendering User Card');
    }
});

// ==================== لوحة الشرف وأبطال التفاعل الشهري (Podium Card) ====================
app.post('/api/render/podium-card', (req, res) => {
    const p = req.body;
    const primaryColor = p.primaryColor || '#fbbf24';
    const secondaryColor = p.secondaryColor || '#f97316';
    
    const groupName = escapeXml(cleanText(p.groupName) || 'مجموعة الأبطال');
    const topUsers = p.topUsers || [];
    const top1 = topUsers[0] || { user_name: 'المركز الأول', message_count: 0 };
    const top2 = topUsers[1] || { user_name: 'المركز الثاني', message_count: 0 };
    const top3 = topUsers[2] || { user_name: 'المركز الثالث', message_count: 0 };
    const others = topUsers.slice(3, 7);

    const name1 = escapeXml(cleanText(top1.user_name) || top1.user_name);
    const name2 = escapeXml(cleanText(top2.user_name) || top2.user_name);
    const name3 = escapeXml(cleanText(top3.user_name) || top3.user_name);

    // التحقق من وجود صورة القروب، وإلا نتركها فارغة
    const groupAvatarTag = p.groupAvatarBase64 ? `
      <clipPath id="groupAvatarClip">
        <circle cx="16" cy="16" r="14" />
      </clipPath>
      <g transform="translate(-315, -16)">
        <circle cx="16" cy="16" r="15" fill="${primaryColor}" />
        <image href="${p.groupAvatarBase64}" x="0" y="0" width="32" height="32" preserveAspectRatio="xMidYMid slice" clip-path="url(#groupAvatarClip)" />
      </g>
    ` : '';

    // توليد بطاقات المراكز الباقية (من المركز الرابع وحتى السابع)
    const othersCards = others.map((u, i) => {
        const rank = i + 4;
        const yPos = 350 + i * 54;
        const uName = escapeXml(cleanText(u.user_name) || u.user_name);
        const uCount = Number(u.message_count) || 0;
        return `
          <g transform="translate(100, ${yPos})">
            <rect width="950" height="46" rx="12" fill="rgba(22, 16, 28, 0.85)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />
            <circle cx="30" cy="23" r="14" fill="rgba(255, 255, 255, 0.06)" />
            <text x="30" y="28" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="900" font-size="13">#${rank}</text>
            <text x="920" y="29" text-anchor="end" fill="#ffffff" font-family="Cairo" font-weight="800" font-size="15">${uName}</text>
            <g transform="translate(75, 23)">
              <text x="20" y="6" text-anchor="start" fill="${primaryColor}" font-family="Cairo" font-weight="900" font-size="14">${uCount.toLocaleString()} رسالة</text>
              ${SVG_ICONS.chat(primaryColor, 16)}
            </g>
          </g>
        `;
    }).join('\n');

    const svg = `
    <svg width="1150" height="630" viewBox="0 0 1150 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldPillarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="35%" stop-color="${primaryColor}" />
          <stop offset="100%" stop-color="#b45309" />
        </linearGradient>
        <linearGradient id="silverPillarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc" />
          <stop offset="40%" stop-color="#cbd5e1" />
          <stop offset="100%" stop-color="#475569" />
        </linearGradient>
        <linearGradient id="bronzePillarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fed7aa" />
          <stop offset="40%" stop-color="${secondaryColor}" />
          <stop offset="100%" stop-color="#7c2d12" />
        </linearGradient>
        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="podiumGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.025)" stroke-width="1" />
        </pattern>
      </defs>
      <rect width="1150" height="630" fill="#060302" />
      <rect width="1150" height="630" fill="url(#podiumGrid)" />
      <circle cx="575" cy="180" r="190" fill="${primaryColor}" fill-opacity="0.08" filter="url(#goldGlow)" />
      
      <g transform="translate(575, 38)">
        <rect x="-330" y="-18" width="660" height="38" rx="19" fill="rgba(0,0,0,0.7)" stroke="${primaryColor}" stroke-width="1.5" stroke-opacity="0.6" />
        ${groupAvatarTag}
        <g transform="translate(-290, -12)">${SVG_ICONS.crown(primaryColor, 24)}</g>
        <text text-anchor="middle" y="7" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="17">
          لوحة الشرف وأبطال التفاعل الشهري — ${groupName}
        </text>
        <g transform="translate(265, -12)">${SVG_ICONS.crown(primaryColor, 24)}</g>
      </g>
      
      <g transform="translate(0, 70)">
        <!-- المركز الثاني -->
        <g transform="translate(260, 45)">
          ${SVG_ICONS.silverMedal(24)}
          <text x="0" y="45" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="16">${name2}</text>
          <text x="0" y="66" text-anchor="middle" fill="#cbd5e1" font-family="Cairo" font-weight="800" font-size="14">${Number(top2.message_count).toLocaleString()} رسالة</text>
          <rect x="-85" y="78" width="170" height="110" rx="12" fill="url(#silverPillarGrad)" stroke="#ffffff" stroke-width="2" />
          <text x="0" y="152" text-anchor="middle" fill="#0f172a" font-family="Cairo" font-weight="900" font-size="52">2</text>
        </g>
        <!-- المركز الأول -->
        <g transform="translate(575, 15)">
          ${SVG_ICONS.goldMedal(28)}
          <text x="0" y="52" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="19">${name1}</text>
          <g transform="translate(0, 68)">
            <text x="12" y="6" text-anchor="start" fill="#fef08a" font-family="Cairo" font-weight="900" font-size="15">${Number(top1.message_count).toLocaleString()} رسالة</text>
            ${SVG_ICONS.chat('#fef08a', 16)}
          </g>
          <rect x="-100" y="86" width="200" height="135" rx="14" fill="url(#goldPillarGrad)" stroke="#ffffff" stroke-width="2.5" filter="url(#goldGlow)" />
          <text x="0" y="176" text-anchor="middle" fill="#451a03" font-family="Cairo" font-weight="900" font-size="68">1</text>
        </g>
        <!-- المركز الثالث -->
        <g transform="translate(890, 65)">
          ${SVG_ICONS.bronzeMedal(22)}
          <text x="0" y="42" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="16">${name3}</text>
          <text x="0" y="62" text-anchor="middle" fill="#fed7aa" font-family="Cairo" font-weight="800" font-size="13">${Number(top3.message_count).toLocaleString()} رسالة</text>
          <rect x="-80" y="74" width="160" height="92" rx="12" fill="url(#bronzePillarGrad)" stroke="#ffffff" stroke-width="2" />
          <text x="0" y="138" text-anchor="middle" fill="#431407" font-family="Cairo" font-weight="900" font-size="44">3</text>
        </g>
      </g>
      ${othersCards}
      
      <g transform="translate(575, 608)">
        <g transform="translate(-145, -9)">${SVG_ICONS.lightning(primaryColor, 14)}</g>
        <text text-anchor="middle" fill="rgba(255, 255, 255, 0.4)" font-family="Cairo" font-weight="800" font-size="12">
          Activity Tracker Bot • لوحة الشرف الرسمية
        </text>
        <g transform="translate(135, -9)">${SVG_ICONS.lightning(primaryColor, 14)}</g>
      </g>
    </svg>`;

    try {
        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: 3000 },
            font: hasFont ? { fontFiles: [FONT_PATH], defaultFontFamily: 'Cairo', loadSystemFonts: true } : { loadSystemFonts: true }
        });
        res.setHeader('Content-Type', 'image/png');
        res.send(resvg.render().asPng());
    } catch (e) {
        console.error(e);
        res.status(500).send('Error rendering Podium Card');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('✅ API Server running on port', PORT))
