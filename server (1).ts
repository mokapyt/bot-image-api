import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { Resvg } from '@resvg/resvg-js';

// ==============================================================================
// ==================== إعدادات الخط العربي والطباعة (Cairo Font) ====================
// ==============================================================================
const fontDir = path.join(process.cwd(), 'fonts');
const fontPath = path.join(fontDir, 'Cairo.ttf');
const hasCairoFont = fs.existsSync(fontPath);

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * إزالة الرموز التعبيرية غير المدعومة في الخط لمنع ظهور مربعات مفرغة (▯)
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .trim();
}

// ==============================================================================
// ==================== واجهات البيانات (Interfaces) ============================
// ==============================================================================
export interface UserCardRenderParams {
  userName: string;
  groupName: string;
  badgeTitle: string;
  userCount: number;
  totalGroupCount: number;
  userRank: number;
  totalMembers: number;
  globalCount?: number;
  level?: number;
  currentXp?: number;
  stepXp?: number;
  primaryColor?: string;
  secondaryColor?: string;
  avatarBase64?: string | null;
}

export interface PodiumRenderParams {
  groupName: string;
  topUsers: Array<{ user_name: string; message_count: number; avatarBase64?: string | null }>;
  primaryColor?: string;
  secondaryColor?: string;
  groupAvatarBase64?: string | null;
  top1AvatarBase64?: string | null;
  top2AvatarBase64?: string | null;
  top3AvatarBase64?: string | null;
}

// ==============================================================================
// ==================== مولدات الأيقونات المتجهية (SVG Icons) ====================
// ==============================================================================
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

// ==============================================================================
// ==================== رسم بطاقة المستخدم (VIP Gamer HUD Card) ==================
// ==============================================================================
export function renderUserCardPng(params: UserCardRenderParams): Buffer {
  const primaryColor = params.primaryColor || '#ff6a00';
  const secondaryColor = params.secondaryColor || '#f59e0b';
  const rawUser = params.userName || 'عضو';
  const rawGroup = params.groupName || 'مجموعة';
  const rawBadge = params.badgeTitle || 'صوت العقل والمنطق';

  const userName = escapeXml(cleanText(rawUser) || rawUser);
  const groupName = escapeXml(cleanText(rawGroup) || rawGroup);
  const badgeTitle = escapeXml(cleanText(rawBadge) || rawBadge);

  const userCount = Number(params.userCount) || 0;
  const totalGroupCount = Number(params.totalGroupCount) || 1;
  const userRank = Number(params.userRank) || 1;
  const totalMembers = Number(params.totalMembers) || 1;
  const globalCount = Number(params.globalCount) || userCount;
  const level = Number(params.level) || 1;
  const currentXp = Number(params.currentXp) || 0;
  const stepXp = Number(params.stepXp) || 75;

  const pct = Math.min(100, Math.max(0.1, ((userCount / Math.max(1, totalGroupCount)) * 100))).toFixed(1);
  const xpProgress = Math.min(100, Math.max(0, Math.round((currentXp / Math.max(1, stepXp)) * 100)));
  const remXp = Math.max(0, stepXp - currentXp);
  const nextLevel = level + 1;

  // حساب أقواس الدائرة
  const radius = 115;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * (Number(pct) / 100));

  const avatarImageTag = params.avatarBase64 ? `
    <clipPath id="avatarClip">
      <circle cx="55" cy="52" r="34" />
    </clipPath>
    <circle cx="55" cy="52" r="36" fill="${primaryColor}" stroke="#ffffff" stroke-width="2" />
    <image href="${params.avatarBase64}" x="21" y="18" width="68" height="68" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)" />
  ` : `
    <circle cx="55" cy="52" r="32" fill="url(#avatarGlowGrad)" stroke="${primaryColor}" stroke-width="2" />
    <g transform="translate(55, 52)">
      ${SVG_ICONS.lightning(primaryColor, 30)}
    </g>
  `;

  const svg = `
  <svg width="1150" height="580" viewBox="0 0 1150 580" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Gradients -->
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

      <!-- Glow Filters -->
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

      <!-- Grid Pattern -->
      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.03)" stroke-width="1" />
      </pattern>
    </defs>

    <!-- Background Base -->
    <rect width="1150" height="580" fill="#080608" />
    <rect width="1150" height="580" fill="url(#grid)" />

    <!-- Ambient Glowing Orbs -->
    <circle cx="250" cy="280" r="180" fill="${primaryColor}" fill-opacity="0.08" filter="url(#neonGlow)" />
    <circle cx="950" cy="180" r="150" fill="${secondaryColor}" fill-opacity="0.06" filter="url(#neonGlow)" />

    <!-- Tech Cyber HUD Corners -->
    <path d="M 25 55 L 25 25 L 55 25" stroke="${primaryColor}" stroke-width="3" fill="none" />
    <path d="M 1125 55 L 1125 25 L 1095 25" stroke="${secondaryColor}" stroke-width="3" fill="none" />
    <path d="M 25 525 L 25 555 L 55 555" stroke="${secondaryColor}" stroke-width="3" fill="none" />
    <path d="M 1125 525 L 1125 555 L 1095 555" stroke="${primaryColor}" stroke-width="3" fill="none" />

    <!-- Top Navigation HUD Bar -->
    <g transform="translate(575, 45)">
      <rect x="-260" y="-18" width="520" height="36" rx="18" fill="rgba(0,0,0,0.6)" stroke="${primaryColor}" stroke-width="1.5" stroke-opacity="0.8" />
      <g transform="translate(-180, -9)">${SVG_ICONS.lightning(primaryColor, 18)}</g>
      <text text-anchor="middle" y="6" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="16" letter-spacing="1">
        VIP GAMER HUD • بطاقة التفاعل الشخصية
      </text>
      <g transform="translate(165, -9)">${SVG_ICONS.lightning(primaryColor, 18)}</g>
    </g>

    <!-- Left Side: Interactive Donut HUD Gauge -->
    <g transform="translate(250, 290)">
      <!-- Outer Decorative Tech Circles -->
      <circle cx="0" cy="0" r="165" fill="none" stroke="rgba(255, 255, 255, 0.04)" stroke-width="1" />
      <circle cx="0" cy="0" r="145" fill="none" stroke="${primaryColor}" stroke-width="1.5" stroke-dasharray="6 12" stroke-opacity="0.4" />
      <circle cx="0" cy="0" r="130" fill="none" stroke="rgba(255, 255, 255, 0.06)" stroke-width="1" />

      <!-- Donut Track -->
      <circle cx="0" cy="0" r="${radius}" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="22" />

      <!-- Donut Active Neon Arc -->
      <circle
        cx="0"
        cy="0"
        r="${radius}"
        fill="none"
        stroke="url(#neonGrad)"
        stroke-width="22"
        stroke-dasharray="${circumference}"
        stroke-dashoffset="${strokeDashoffset}"
        stroke-linecap="round"
        transform="rotate(-90)"
        filter="url(#neonGlow)"
      />

      <!-- Donut Center Content -->
      <circle cx="0" cy="0" r="82" fill="#0c0a09" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
      <circle cx="0" cy="0" r="76" fill="rgba(255,255,255,0.02)" />

      <g transform="translate(0, -22)">${SVG_ICONS.lightning(primaryColor, 20)}</g>
      <text text-anchor="middle" y="10" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="28">
        %${pct}
      </text>
      <text text-anchor="middle" y="32" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="11">
        حصة التفاعل بالقروب
      </text>
      <text text-anchor="middle" y="52" fill="${primaryColor}" font-family="Cairo" font-weight="800" font-size="12">
        LEVEL ${level}
      </text>
    </g>

    <!-- Right Side Bento Cards -->
    <g transform="translate(500, 95)">
      <!-- Card 1: User Identity -->
      <g transform="translate(0, 0)">
        <rect width="590" height="105" rx="16" fill="url(#cardBgGrad)" stroke="${primaryColor}" stroke-width="1.5" stroke-opacity="0.6" />
        <line x1="20" y1="0" x2="160" y2="0" stroke="${secondaryColor}" stroke-width="3" />
        ${avatarImageTag}
        
        <g transform="translate(565, 30)">
          <!-- Badge -->
          <g transform="translate(0, -10)">
            <text text-anchor="end" fill="${secondaryColor}" font-family="Cairo" font-weight="800" font-size="14">
              اللقب: ${badgeTitle}
            </text>
            <g transform="translate(14, -12)">${SVG_ICONS.mask(secondaryColor, 14)}</g>
          </g>
          <!-- Username -->
          <text text-anchor="end" y="24" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="21">
            ${userName}
          </text>
          <!-- Group Name -->
          <g transform="translate(0, 44)">
            <text text-anchor="end" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">
              ${groupName}
            </text>
            <g transform="translate(10, -10)">${SVG_ICONS.pin('#94a3b8', 12)}</g>
          </g>
        </g>
      </g>

      <!-- Card 2: XP Level Progress -->
      <g transform="translate(0, 118)">
        <rect width="590" height="96" rx="16" fill="url(#cardBgGrad)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
        <g transform="translate(565, 26)">
          <text text-anchor="end" fill="#fed7aa" font-family="Cairo" font-weight="800" font-size="14">
            المستوى: LEVEL ${level}
          </text>
          <g transform="translate(14, -12)">${SVG_ICONS.star('#f59e0b', 14)}</g>
        </g>
        <text x="25" y="28" text-anchor="start" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">
          متبقي ${remXp} XP للمستوى ${nextLevel}
        </text>

        <!-- Bar Container -->
        <g transform="translate(25, 48)">
          <rect width="540" height="22" rx="11" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
          <rect width="${Math.max(16, (540 * xpProgress) / 100)}" height="22" rx="11" fill="url(#barGrad)" filter="url(#softGlow)" />
          <text x="270" y="16" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="12">
            ${xpProgress}% (${currentXp}/${stepXp} XP)
          </text>
        </g>
      </g>

      <!-- Card 3: Stats Grid (3 Columns) -->
      <g transform="translate(0, 226)">
        <rect width="590" height="190" rx="18" fill="url(#cardBgGrad)" stroke="${secondaryColor}" stroke-width="1.2" stroke-opacity="0.4" />
        
        <!-- Column 1: Group Messages -->
        <g transform="translate(18, 18)">
          <rect width="170" height="154" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
          <g transform="translate(85, 30)">${SVG_ICONS.chat('#38bdf8', 24)}</g>
          <text x="85" y="64" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">رسائلك بالقروب</text>
          <text x="85" y="104" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="24">${userCount.toLocaleString()}</text>
          <text x="85" y="132" text-anchor="middle" fill="${primaryColor}" font-family="Cairo" font-weight="800" font-size="13">حصة: %${pct}</text>
        </g>

        <!-- Column 2: Rank -->
        <g transform="translate(210, 18)">
          <rect width="170" height="154" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
          <g transform="translate(85, 30)">${SVG_ICONS.trophy('#f59e0b', 24)}</g>
          <text x="85" y="64" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">الترتيب العام</text>
          <text x="85" y="104" text-anchor="middle" fill="#fef08a" font-family="Cairo" font-weight="900" font-size="24">#${userRank}</text>
          <text x="85" y="132" text-anchor="middle" fill="#cbd5e1" font-family="Cairo" font-weight="700" font-size="12">من أصل ${totalMembers} عضو</text>
        </g>

        <!-- Column 3: Global Messages -->
        <g transform="translate(402, 18)">
          <rect width="170" height="154" rx="14" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
          <g transform="translate(85, 30)">${SVG_ICONS.globe('#a855f7', 24)}</g>
          <text x="85" y="64" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">التفاعل الشامل</text>
          <text x="85" y="104" text-anchor="middle" fill="#38bdf8" font-family="Cairo" font-weight="900" font-size="24">${globalCount.toLocaleString()}</text>
          <text x="85" y="132" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="700" font-size="12">رسالة مسجلة</text>
        </g>
      </g>
    </g>

    <!-- Footer Branding -->
    <g transform="translate(575, 555)">
      <g transform="translate(-180, -9)">${SVG_ICONS.lightning(primaryColor, 14)}</g>
      <text text-anchor="middle" fill="rgba(255, 255, 255, 0.4)" font-family="Cairo" font-weight="800" font-size="12" letter-spacing="1">
        Activity Tracker Bot • نظام إحصائيات التفاعل الاحترافي
      </text>
      <g transform="translate(170, -9)">${SVG_ICONS.lightning(primaryColor, 14)}</g>
    </g>
  </svg>
  `;

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 3000 }, // 3K Ultra-HD Crisp Output
    font: hasCairoFont ? {
      fontFiles: [fontPath],
      defaultFontFamily: 'Cairo',
      loadSystemFonts: true
    } : { loadSystemFonts: true }
  });

  return resvg.render().asPng();
}

// ==============================================================================
// ==================== رسم لوحة الشرف ومنصة التتويج الأوليمبية (/top) ============
// ==============================================================================
export function renderPodiumCardPng(params: PodiumRenderParams): Buffer {
  const primaryColor = params.primaryColor || '#fbbf24';
  const secondaryColor = params.secondaryColor || '#f97316';
  const rawGroup = params.groupName || 'مجموعة الأبطال';
  const groupName = escapeXml(cleanText(rawGroup) || rawGroup);
  const topUsers = params.topUsers || [];

  const top1 = topUsers[0] || { user_name: 'المركز الأول', message_count: 0 };
  const top2 = topUsers[1] || { user_name: 'المركز الثاني', message_count: 0 };
  const top3 = topUsers[2] || { user_name: 'المركز الثالث', message_count: 0 };
  const others = topUsers.slice(3, 8);

  const name1 = escapeXml(cleanText(top1.user_name) || top1.user_name);
  const name2 = escapeXml(cleanText(top2.user_name) || top2.user_name);
  const name3 = escapeXml(cleanText(top3.user_name) || top3.user_name);

  const top1Avatar = params.top1AvatarBase64 || top1.avatarBase64 || null;
  const top2Avatar = params.top2AvatarBase64 || top2.avatarBase64 || null;
  const top3Avatar = params.top3AvatarBase64 || top3.avatarBase64 || null;

  const getInitial = (name: string): string => {
    const clean = cleanText(name).trim();
    return clean ? clean.charAt(0).toUpperCase() : '★';
  };

  const groupAvatarTag = params.groupAvatarBase64 ? `
    <clipPath id="groupAvatarClip">
      <circle cx="16" cy="16" r="14" />
    </clipPath>
    <g transform="translate(-315, -16)">
      <circle cx="16" cy="16" r="15" fill="${primaryColor}" />
      <image href="${params.groupAvatarBase64}" x="0" y="0" width="32" height="32" preserveAspectRatio="xMidYMid slice" clip-path="url(#groupAvatarClip)" />
    </g>
  ` : '';

  // Avatar 1 (Gold - Radius 34)
  const avatarTag1 = top1Avatar ? `
    <image href="${top1Avatar}" x="-34" y="0" width="68" height="68" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar1Clip)" />
  ` : `
    <circle cx="0" cy="34" r="34" fill="url(#goldPillarGrad)" fill-opacity="0.25" />
    <text x="0" y="44" text-anchor="middle" fill="#fef08a" font-family="Cairo" font-weight="900" font-size="28">${getInitial(top1.user_name)}</text>
  `;

  // Avatar 2 (Silver - Radius 28)
  const avatarTag2 = top2Avatar ? `
    <image href="${top2Avatar}" x="-28" y="12" width="56" height="56" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar2Clip)" />
  ` : `
    <circle cx="0" cy="40" r="28" fill="url(#silverPillarGrad)" fill-opacity="0.25" />
    <text x="0" y="49" text-anchor="middle" fill="#cbd5e1" font-family="Cairo" font-weight="900" font-size="24">${getInitial(top2.user_name)}</text>
  `;

  // Avatar 3 (Bronze - Radius 26)
  const avatarTag3 = top3Avatar ? `
    <image href="${top3Avatar}" x="-26" y="20" width="52" height="52" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar3Clip)" />
  ` : `
    <circle cx="0" cy="46" r="26" fill="url(#bronzePillarGrad)" fill-opacity="0.25" />
    <text x="0" y="55" text-anchor="middle" fill="#fed7aa" font-family="Cairo" font-weight="900" font-size="22">${getInitial(top3.user_name)}</text>
  `;

  // Calculate others cards (Ranks 4-8)
  const othersCards = others.map((u, i) => {
    const rank = i + 4;
    const yPos = 330 + i * 50;
    const uName = escapeXml(cleanText(u.user_name) || u.user_name);
    const uCount = Number(u.message_count) || 0;
    return `
      <g transform="translate(100, ${yPos})">
        <rect width="950" height="42" rx="10" fill="rgba(20, 14, 26, 0.88)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />
        <circle cx="28" cy="21" r="13" fill="rgba(255, 255, 255, 0.06)" />
        <text x="28" y="26" text-anchor="middle" fill="#94a3b8" font-family="Cairo" font-weight="900" font-size="13">#${rank}</text>
        <text x="920" y="27" text-anchor="end" fill="#ffffff" font-family="Cairo" font-weight="800" font-size="15">${uName}</text>
        <g transform="translate(75, 21)">
          <text x="20" y="5" text-anchor="start" fill="${primaryColor}" font-family="Cairo" font-weight="900" font-size="13">${uCount.toLocaleString()} رسالة</text>
          ${SVG_ICONS.chat(primaryColor, 15)}
        </g>
      </g>
    `;
  }).join('\n');

  const svg = `
  <svg width="1150" height="630" viewBox="0 0 1150 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Avatar ClipPaths -->
      <clipPath id="avatar1Clip">
        <circle cx="0" cy="34" r="34" />
      </clipPath>
      <clipPath id="avatar2Clip">
        <circle cx="0" cy="40" r="28" />
      </clipPath>
      <clipPath id="avatar3Clip">
        <circle cx="0" cy="46" r="26" />
      </clipPath>

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

    <!-- Background -->
    <rect width="1150" height="630" fill="#060302" />
    <rect width="1150" height="630" fill="url(#podiumGrid)" />

    <!-- Ambient Gold Glow -->
    <circle cx="575" cy="180" r="190" fill="${primaryColor}" fill-opacity="0.08" filter="url(#goldGlow)" />

    <!-- Title Bar -->
    <g transform="translate(575, 36)">
      <rect x="-330" y="-18" width="660" height="38" rx="19" fill="rgba(0,0,0,0.7)" stroke="${primaryColor}" stroke-width="1.5" stroke-opacity="0.6" />
      ${groupAvatarTag}
      <g transform="translate(-290, -12)">${SVG_ICONS.crown(primaryColor, 24)}</g>
      <text text-anchor="middle" y="7" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="17">
        لوحة الشرف وأبطال التفاعل الشهري — ${groupName}
      </text>
      <g transform="translate(265, -12)">${SVG_ICONS.crown(primaryColor, 24)}</g>
    </g>

    <!-- The 3 Pillars (Olympic Podium) -->
    <g transform="translate(0, 65)">
      <!-- 2nd Place: Silver Pillar (Left x=260) -->
      <g transform="translate(260, 0)">
        <!-- Silver Avatar & Medal -->
        <circle cx="0" cy="40" r="30" fill="none" stroke="url(#silverPillarGrad)" stroke-width="2.5" />
        ${avatarTag2}
        <g transform="translate(20, 56)">${SVG_ICONS.silverMedal(12)}</g>

        <!-- User Name & Messages -->
        <text x="0" y="86" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="16">
          ${name2}
        </text>
        <text x="0" y="106" text-anchor="middle" fill="#cbd5e1" font-family="Cairo" font-weight="800" font-size="13">
          ${Number(top2.message_count).toLocaleString()} رسالة
        </text>

        <!-- Silver Block (Ends at y=244) -->
        <rect x="-90" y="134" width="180" height="110" rx="12" fill="url(#silverPillarGrad)" stroke="#ffffff" stroke-width="2" />
        <text x="0" y="210" text-anchor="middle" fill="#0f172a" font-family="Cairo" font-weight="900" font-size="52">2</text>
      </g>

      <!-- 1st Place: Gold Champion Pillar (Center x=575) -->
      <g transform="translate(575, 0)">
        <!-- Crown above Gold Avatar -->
        <g transform="translate(-16, -18)">${SVG_ICONS.crown('#fef08a', 32)}</g>
        <circle cx="0" cy="34" r="36" fill="none" stroke="url(#goldPillarGrad)" stroke-width="3" filter="url(#goldGlow)" />
        ${avatarTag1}
        <g transform="translate(24, 52)">${SVG_ICONS.goldMedal(14)}</g>

        <!-- User Name & Messages -->
        <text x="0" y="88" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="18">
          ${name1}
        </text>
        <g transform="translate(0, 108)">
          <text x="12" y="5" text-anchor="start" fill="#fef08a" font-family="Cairo" font-weight="900" font-size="14">${Number(top1.message_count).toLocaleString()} رسالة</text>
          ${SVG_ICONS.chat('#fef08a', 15)}
        </g>

        <!-- Gold Block (Ends at y=244) -->
        <rect x="-105" y="124" width="210" height="120" rx="14" fill="url(#goldPillarGrad)" stroke="#ffffff" stroke-width="2.5" filter="url(#goldGlow)" />
        <text x="0" y="206" text-anchor="middle" fill="#451a03" font-family="Cairo" font-weight="900" font-size="64">1</text>
      </g>

      <!-- 3rd Place: Bronze Pillar (Right x=890) -->
      <g transform="translate(890, 0)">
        <!-- Bronze Avatar & Medal -->
        <circle cx="0" cy="46" r="28" fill="none" stroke="url(#bronzePillarGrad)" stroke-width="2.5" />
        ${avatarTag3}
        <g transform="translate(18, 60)">${SVG_ICONS.bronzeMedal(12)}</g>

        <!-- User Name & Messages -->
        <text x="0" y="90" text-anchor="middle" fill="#ffffff" font-family="Cairo" font-weight="900" font-size="15">
          ${name3}
        </text>
        <text x="0" y="108" text-anchor="middle" fill="#fed7aa" font-family="Cairo" font-weight="800" font-size="13">
          ${Number(top3.message_count).toLocaleString()} رسالة
        </text>

        <!-- Bronze Block (Ends at y=244) -->
        <rect x="-85" y="149" width="170" height="95" rx="12" fill="url(#bronzePillarGrad)" stroke="#ffffff" stroke-width="2" />
        <text x="0" y="214" text-anchor="middle" fill="#431407" font-family="Cairo" font-weight="900" font-size="46">3</text>
      </g>
    </g>

    <!-- Podium Baseline Divider -->
    <line x1="120" y1="312" x2="1030" y2="312" stroke="${primaryColor}" stroke-opacity="0.3" stroke-width="1.5" />

    <!-- Others List (Places 4-8) -->
    ${othersCards}

    <!-- Footer -->
    <g transform="translate(575, 608)">
      <g transform="translate(-145, -9)">${SVG_ICONS.lightning(primaryColor, 14)}</g>
      <text text-anchor="middle" fill="rgba(255, 255, 255, 0.4)" font-family="Cairo" font-weight="800" font-size="12" letter-spacing="1">
        Activity Tracker Bot • لوحة الشرف الرسمية
      </text>
      <g transform="translate(135, -9)">${SVG_ICONS.lightning(primaryColor, 14)}</g>
    </g>
  </svg>
  `;

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 3000 }, // 3K Ultra-HD Crisp Output
    font: hasCairoFont ? {
      fontFiles: [fontPath],
      defaultFontFamily: 'Cairo',
      loadSystemFonts: true
    } : { loadSystemFonts: true }
  });

  return resvg.render().asPng();
}

// ==============================================================================
// ==================== خادم الويب وخدمة الـ Microservice (Express Server) ========
// ==============================================================================
async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // تمكين CORS لطلبات البوت الخارجية
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // دعم حمولات JSON وصور base64 حتى 20 ميجابايت
  app.use(express.json({ limit: '20mb' }));

  // فحص سلامة السيرفر (Health Check)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Telegram Bot Render Microservice',
      timestamp: new Date().toISOString()
    });
  });

  // مسار 1: توليد بطاقة المستخدم الفاخرة (VIP Gamer HUD Card)
  app.post('/api/render/user-card', (req, res) => {
    try {
      const pngBuffer = renderUserCardPng(req.body);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', pngBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.end(pngBuffer);
    } catch (error) {
      console.error('Error rendering user card:', error);
      res.status(500).json({ error: 'Failed to render user card image', details: String(error) });
    }
  });

  // مسار 2: توليد لوحة الشرف ومنصة التتويج الأوليمبية للثلاثة الأوائل (Podium Card)
  app.post('/api/render/podium-card', (req, res) => {
    try {
      const pngBuffer = renderPodiumCardPng(req.body);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', pngBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.end(pngBuffer);
    } catch (error) {
      console.error('Error rendering podium card:', error);
      res.status(500).json({ error: 'Failed to render podium card image', details: String(error) });
    }
  });

  // مسار 3: بيانات لوحة تحكم المجموعة المباشرة
  app.get('/api/group/:groupId/dashboard', (req, res) => {
    const groupId = req.params.groupId;
    res.json({
      status: 'ok',
      groupId,
      timestamp: new Date().toISOString()
    });
  });

  // مسار 4: إحصائيات البوت العالمية
  app.get('/api/bot/global-stats', (req, res) => {
    res.json({
      status: 'ok',
      totalGlobalMessages: 4289410,
      totalActiveGroups: 842,
      totalRegisteredUsers: 94250,
      timestamp: new Date().toISOString()
    });
  });

  // دعم واجهة الويب (Vite Middleware في التطوير، وملفات ثابتة في الإنتاج)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*all', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
