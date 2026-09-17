const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { Resvg } = require('@resvg/resvg-js');

const app = express();
app.use(express.json());

// تنزيل الخط العربي الفخم تلقائياً من جوجل
const FONT_URL = 'https://github.com/googlefonts/cairo/raw/main/fonts/ttf/Cairo-Bold.ttf';
const FONT_PATH = path.join('/tmp', 'Cairo-Bold.ttf');
let hasFont = false;

https.get(FONT_URL, (res) => {
    const file = fs.createWriteStream(FONT_PATH);
    res.pipe(file);
    file.on('finish', () => { file.close(); hasFont = true; console.log('✅ Cairo Font Loaded!'); });
});

function escapeXml(unsafe) {
    return (unsafe || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

app.post('/api/render/user-card', (req, res) => {
    const p = req.body;
    const primaryColor = p.primaryColor || '#ff6a00';
    const secondaryColor = p.secondaryColor || '#f59e0b';
    const userName = escapeXml(p.userName || 'عضو');
    const badgeTitle = escapeXml(p.badgeTitle || 'اللقب');
    
    const pct = Math.min(100, Math.max(0.1, ((p.userCount / Math.max(1, p.totalGroupCount)) * 100))).toFixed(1);
    const xpProgress = Math.min(100, Math.max(0, Math.round((p.currentXp / Math.max(1, p.stepXp)) * 100)));
    
    const svg = `
    <svg width="1150" height="580" viewBox="0 0 1150 580" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${primaryColor}" />
                <stop offset="100%" stop-color="${secondaryColor}" />
            </linearGradient>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#18121c" />
                <stop offset="100%" stop-color="#0a080e" />
            </linearGradient>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.03)" stroke-width="1" />
            </pattern>
        </defs>
        <rect width="1150" height="580" fill="#080608" />
        <rect width="1150" height="580" fill="url(#grid)" />
        
        <circle cx="250" cy="280" r="180" fill="${primaryColor}" fill-opacity="0.08" />
        
        <!-- الدائرة والإحصائيات -->
        <g transform="translate(250, 290)">
            <circle cx="0" cy="0" r="130" fill="none" stroke="rgba(255, 255, 255, 0.06)" stroke-width="1" />
            <circle cx="0" cy="0" r="115" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="22" />
            <circle cx="0" cy="0" r="115" fill="none" stroke="url(#g1)" stroke-width="22" stroke-dasharray="722" stroke-dashoffset="${722 - (722 * (pct / 100))}" transform="rotate(-90)" stroke-linecap="round" />
            <text y="15" text-anchor="middle" fill="#fff" font-family="Cairo" font-weight="900" font-size="42">%${pct}</text>
            <text y="45" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="14">مساهمتك</text>
        </g>
        
        <!-- البطاقات اليمنى -->
        <g transform="translate(500, 95)">
            <rect width="590" height="105" rx="16" fill="url(#bg)" stroke="${primaryColor}" stroke-width="1.5" />
            <circle cx="55" cy="52" r="32" fill="${primaryColor}" />
            <text x="565" y="45" text-anchor="end" fill="#fff" font-family="Cairo" font-weight="900" font-size="28">${userName}</text>
            <text x="565" y="75" text-anchor="end" fill="${secondaryColor}" font-family="Cairo" font-weight="700" font-size="16">اللقب: ${badgeTitle}</text>
            
            <rect y="125" width="590" height="96" rx="16" fill="url(#bg)" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
            <text x="565" y="160" text-anchor="end" fill="#fed7aa" font-family="Cairo" font-weight="800" font-size="16">المستوى: LEVEL ${p.level||1}</text>
            <rect x="25" y="175" width="540" height="22" rx="11" fill="rgba(0,0,0,0.6)" />
            <rect x="25" y="175" width="${Math.max(16, (540 * xpProgress) / 100)}" height="22" rx="11" fill="url(#g1)" />
            <text x="295" y="191" text-anchor="middle" fill="#fff" font-family="Cairo" font-weight="900" font-size="14">${xpProgress}% (${p.currentXp||0}/${p.stepXp||75} XP)</text>
            
            <rect y="235" width="180" height="150" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" />
            <text x="90" y="310" text-anchor="middle" fill="#fff" font-family="Cairo" font-weight="900" font-size="32">${(p.userCount||0).toLocaleString()}</text>
            <text x="90" y="345" text-anchor="middle" fill="${primaryColor}" font-family="Cairo" font-weight="700" font-size="15">رسائلك بالقروب</text>
            
            <rect x="205" y="235" width="180" height="150" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" />
            <text x="295" y="310" text-anchor="middle" fill="#fef08a" font-family="Cairo" font-weight="900" font-size="32">#${p.userRank||1}</text>
            <text x="295" y="345" text-anchor="middle" fill="#cbd5e1" font-family="Cairo" font-weight="700" font-size="15">الترتيب العام</text>
            
            <rect x="410" y="235" width="180" height="150" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" />
            <text x="500" y="310" text-anchor="middle" fill="#38bdf8" font-family="Cairo" font-weight="900" font-size="32">${(p.globalCount||0).toLocaleString()}</text>
            <text x="500" y="345" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="15">التفاعل الشامل</text>
        </g>
    </svg>`;

    try {
        const resvg = new Resvg(svg, { font: hasFont ? { fontFiles: [FONT_PATH], loadSystemFonts: true } : {} });
        res.setHeader('Content-Type', 'image/png');
        res.send(resvg.render().asPng());
    } catch (e) {
        res.status(500).send('Error rendering User Card');
    }
});

app.post('/api/render/podium-card', (req, res) => {
    const p = req.body;
    const top1 = p.topUsers[0] || {}; const top2 = p.topUsers[1] || {}; const top3 = p.topUsers[2] || {};
    
    let othersCards = '';
    const others = p.topUsers.slice(3, 7);
    others.forEach((u, i) => {
        othersCards += `
        <g transform="translate(100, ${350 + (i * 54)})">
            <rect width="950" height="46" rx="12" fill="rgba(22, 16, 28, 0.85)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />
            <text x="30" y="28" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="900" font-size="13">#${i + 4}</text>
            <text x="920" y="29" text-anchor="end" fill="#ffffff" font-family="Cairo" font-weight="800" font-size="16">${escapeXml(u.user_name)}</text>
            <text x="95" y="29" text-anchor="start" fill="${p.primaryColor||'#fbbf24'}" font-family="Cairo" font-weight="900" font-size="15">${(u.message_count||0).toLocaleString()} رسالة</text>
        </g>`;
    });

    const svg = `
    <svg width="1150" height="630" viewBox="0 0 1150 630" xmlns="http://www.w3.org/2000/svg">
        <rect width="1150" height="630" fill="#060302" />
        <rect x="245" y="20" width="660" height="38" rx="19" fill="rgba(0,0,0,0.7)" stroke="${p.primaryColor||'#fbbf24'}" stroke-width="1.5" />
        <text x="575" y="45" text-anchor="middle" fill="#fff" font-family="Cairo" font-weight="900" font-size="20">لوحة الشرف وأبطال التفاعل — ${escapeXml(p.groupName)}</text>
        
        <g transform="translate(0, 70)">
            <g transform="translate(260, 45)">
                <text x="0" y="45" text-anchor="middle" fill="#fff" font-family="Cairo" font-weight="900" font-size="18">${escapeXml(top2.user_name)}</text>
                <text x="0" y="68" text-anchor="middle" fill="#cbd5e1" font-family="Cairo" font-weight="800" font-size="15">${(top2.message_count||0).toLocaleString()} رسالة</text>
                <rect x="-85" y="78" width="170" height="110" rx="12" fill="#475569" stroke="#fff" stroke-width="2" />
                <text x="0" y="152" text-anchor="middle" fill="#f8fafc" font-family="Cairo" font-weight="900" font-size="52">2</text>
            </g>
            <g transform="translate(575, 15)">
                <text x="0" y="52" text-anchor="middle" fill="#fff" font-family="Cairo" font-weight="900" font-size="22">${escapeXml(top1.user_name)}</text>
                <text x="0" y="75" text-anchor="middle" fill="#fef08a" font-family="Cairo" font-weight="900" font-size="17">${(top1.message_count||0).toLocaleString()} رسالة</text>
                <rect x="-100" y="86" width="200" height="135" rx="14" fill="#b45309" stroke="#fff" stroke-width="2.5" />
                <text x="0" y="176" text-anchor="middle" fill="#fef08a" font-family="Cairo" font-weight="900" font-size="68">1</text>
            </g>
            <g transform="translate(890, 65)">
                <text x="0" y="42" text-anchor="middle" fill="#fff" font-family="Cairo" font-weight="900" font-size="18">${escapeXml(top3.user_name)}</text>
                <text x="0" y="65" text-anchor="middle" fill="#fed7aa" font-family="Cairo" font-weight="800" font-size="14">${(top3.message_count||0).toLocaleString()} رسالة</text>
                <rect x="-80" y="74" width="160" height="92" rx="12" fill="#7c2d12" stroke="#fff" stroke-width="2" />
                <text x="0" y="138" text-anchor="middle" fill="#fed7aa" font-family="Cairo" font-weight="900" font-size="44">3</text>
            </g>
        </g>
        ${othersCards}
    </svg>`;

    try {
        const resvg = new Resvg(svg, { font: hasFont ? { fontFiles: [FONT_PATH], loadSystemFonts: true } : {} });
        res.setHeader('Content-Type', 'image/png');
        res.send(resvg.render().asPng());
    } catch (e) {
        res.status(500).send('Error rendering Podium Card');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ API Server running on port', PORT));
