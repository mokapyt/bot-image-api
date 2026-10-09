import express from 'express';
import path from 'path';
import fs from 'fs';
import { Resvg } from '@resvg/resvg-js';

// ==============================================================================
// ==================== إعدادات الخط العربي والطباعة (Cairo Font) ====================
// ==============================================================================
const fontDir = path.join(process.cwd(), 'fonts');
const fontPath = path.join(fontDir, 'Cairo.ttf');
const fontPathEmoji = path.join(fontDir, 'NotoEmoji-Regular.ttf');
const hasCairoFont = fs.existsSync(fontPath);
const hasEmojiFont = fs.existsSync(fontPathEmoji);

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * إزالة الرموز التعبيرية لمنع ظهور مربعات مفرغة (▯) في محركات الرسم السيرفرية
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/(\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}])/gu, '')
    .replace(/\s+/g, ' ')
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
  topUsers: Array<{ user_name: string; message_count: number; avatarBase64?: string | null; color?: string }>;
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
      fontFiles: hasEmojiFont ? [fontPath, fontPathEmoji] : [fontPath],
      defaultFontFamily: 'Cairo',
      loadSystemFonts: true
    } : { loadSystemFonts: true }
  });

  return resvg.render().asPng();
}

// ==============================================================================
// ==================== رسم لوحة الشرف ومنصة التتويج الأوليمبية (/top) ===========
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
  
  // Ranks 4 to 8
  const user4 = topUsers[3] || { user_name: 'المستخدم الرابع', message_count: 0 };
  const user5 = topUsers[4] || { user_name: 'المستخدم الخامس', message_count: 0 };
  const user6 = topUsers[5] || { user_name: 'المستخدم السادس', message_count: 0 };
  const user7 = topUsers[6] || { user_name: 'المستخدم السابع', message_count: 0 };
  const user8 = topUsers[7] || { user_name: 'المستخدم الثامن', message_count: 0 };

  const getDisplayName = (u?: { user_name?: string }): string => {
    const raw = (u && u.user_name) ? String(u.user_name).trim() : '';
    const cleaned = cleanText(raw);
    if (cleaned) {
      return escapeXml(cleaned);
    }
    // في حال كان اسم المستخدم بالكامل رموزاً تعبيرية فقط (مثل 👑 أو 🔥)
    // نعرض اسماً عربياً جذاباً لتجنب ظهور مربع مفرغ (▯) نهائياً
    return raw ? escapeXml('بطل مميز') : 'عضو';
  };

  const name1 = getDisplayName(top1);
  const name2 = getDisplayName(top2);
  const name3 = getDisplayName(top3);
  const name4 = getDisplayName(user4);
  const name5 = getDisplayName(user5);
  const name6 = getDisplayName(user6);
  const name7 = getDisplayName(user7);
  const name8 = getDisplayName(user8);

  const count1 = Number(top1.message_count || 0).toLocaleString();
  const count2 = Number(top2.message_count || 0).toLocaleString();
  const count3 = Number(top3.message_count || 0).toLocaleString();
  const count4 = Number(user4.message_count || 0).toLocaleString();
  const count5 = Number(user5.message_count || 0).toLocaleString();
  const count6 = Number(user6.message_count || 0).toLocaleString();
  const count7 = Number(user7.message_count || 0).toLocaleString();
  const count8 = Number(user8.message_count || 0).toLocaleString();

  const top1Avatar = params.top1AvatarBase64 || top1.avatarBase64 || null;
  const top2Avatar = params.top2AvatarBase64 || top2.avatarBase64 || null;
  const top3Avatar = params.top3AvatarBase64 || top3.avatarBase64 || null;
  const avatar4 = user4.avatarBase64 || null;
  const avatar5 = user5.avatarBase64 || null;
  const avatar6 = user6.avatarBase64 || null;
  const avatar7 = user7.avatarBase64 || null;
  const avatar8 = user8.avatarBase64 || null;

  const getInitial = (name: string): string => {
    const raw = String(name || '').trim();
    const clean = cleanText(raw).trim();
    return clean ? clean.charAt(0).toUpperCase() : '★';
  };

  // Distinct vibrant accent colors for ranks 4-8 (custom or standard palette)
  const color4 = user4.color || '#38bdf8'; // Sky blue
  const color5 = user5.color || '#a855f7'; // Purple
  const color6 = user6.color || '#ec4899'; // Pink
  const color7 = user7.color || '#10b981'; // Emerald
  const color8 = user8.color || '#f97316'; // Orange

  const avatarTag1 = top1Avatar ? `
    <image href="${top1Avatar}" x="778" y="283" width="244" height="244" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar1)"/>
  ` : `
    <circle cx="900" cy="405" r="122" fill="#292C32" />
    <text x="900" y="415" text-anchor="middle" fill="#FFD76A" font-family="Cairo, sans-serif" font-size="70" font-weight="900">${getInitial(top1.user_name)}</text>
  `;

  const avatarTag2 = top2Avatar ? `
    <image href="${top2Avatar}" x="408" y="373" width="184" height="184" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar2)"/>
  ` : `
    <circle cx="500" cy="465" r="92" fill="#292C32" />
    <text x="500" y="475" text-anchor="middle" fill="#D4D8DF" font-family="Cairo, sans-serif" font-size="52" font-weight="900">${getInitial(top2.user_name)}</text>
  `;

  const avatarTag3 = top3Avatar ? `
    <image href="${top3Avatar}" x="1208" y="373" width="184" height="184" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar3)"/>
  ` : `
    <circle cx="1300" cy="465" r="92" fill="#292C32" />
    <text x="1300" y="475" text-anchor="middle" fill="#C88A55" font-family="Cairo, sans-serif" font-size="52" font-weight="900">${getInitial(top3.user_name)}</text>
  `;

  const avatarTag4 = avatar4 ? `
    <image href="${avatar4}" x="1573" y="938" width="114" height="114" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar4)"/>
  ` : `
    <circle cx="1630" cy="995" r="57" fill="#17191E" />
    <text x="1630" y="1005" text-anchor="middle" fill="${color4}" font-family="Cairo, sans-serif" font-size="34" font-weight="900">${getInitial(user4.user_name)}</text>
  `;

  const avatarTag5 = avatar5 ? `
    <image href="${avatar5}" x="1208" y="938" width="114" height="114" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar5)"/>
  ` : `
    <circle cx="1265" cy="995" r="57" fill="#17191E" />
    <text x="1265" y="1005" text-anchor="middle" fill="${color5}" font-family="Cairo, sans-serif" font-size="34" font-weight="900">${getInitial(user5.user_name)}</text>
  `;

  const avatarTag6 = avatar6 ? `
    <image href="${avatar6}" x="843" y="938" width="114" height="114" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar6)"/>
  ` : `
    <circle cx="900" cy="995" r="57" fill="#17191E" />
    <text x="900" y="1005" text-anchor="middle" fill="${color6}" font-family="Cairo, sans-serif" font-size="34" font-weight="900">${getInitial(user6.user_name)}</text>
  `;

  const avatarTag7 = avatar7 ? `
    <image href="${avatar7}" x="478" y="938" width="114" height="114" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar7)"/>
  ` : `
    <circle cx="535" cy="995" r="57" fill="#17191E" />
    <text x="535" y="1005" text-anchor="middle" fill="${color7}" font-family="Cairo, sans-serif" font-size="34" font-weight="900">${getInitial(user7.user_name)}</text>
  `;

  const avatarTag8 = avatar8 ? `
    <image href="${avatar8}" x="113" y="938" width="114" height="114" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar8)"/>
  ` : `
    <circle cx="170" cy="995" r="57" fill="#17191E" />
    <text x="170" y="1005" text-anchor="middle" fill="${color8}" font-family="Cairo, sans-serif" font-size="34" font-weight="900">${getInitial(user8.user_name)}</text>
  `;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg"
     width="1800"
     height="1350"
     viewBox="0 0 1800 1350">

  <defs>

    <!-- ================= BACKGROUND ================= -->

    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07080B"/>
      <stop offset="42%" stop-color="#15171C"/>
      <stop offset="72%" stop-color="#101217"/>
      <stop offset="100%" stop-color="#07080B"/>
    </linearGradient>

    <radialGradient id="redGlow">
      <stop offset="0%" stop-color="#D92D3F" stop-opacity=".28"/>
      <stop offset="45%" stop-color="#8B1727" stop-opacity=".10"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="goldGlow">
      <stop offset="0%" stop-color="#FFD76A" stop-opacity=".20"/>
      <stop offset="50%" stop-color="#D99A19" stop-opacity=".06"/>
      <stop offset="100%" stop-color="#FFD76A" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="blueGlow">
      <stop offset="0%" stop-color="#4D7CFF" stop-opacity=".09"/>
      <stop offset="100%" stop-color="#4D7CFF" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="centerLight">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity=".12"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity=".025"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>

    <!-- ================= MEDALS ================= -->

    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFF3B0"/>
      <stop offset="30%" stop-color="#FFD75A"/>
      <stop offset="70%" stop-color="#D99A19"/>
      <stop offset="100%" stop-color="#FFF0A0"/>
    </linearGradient>

    <linearGradient id="silver" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="40%" stop-color="#DDE1E8"/>
      <stop offset="75%" stop-color="#8F969F"/>
      <stop offset="100%" stop-color="#F5F7FA"/>
    </linearGradient>

    <linearGradient id="bronze" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFD0A0"/>
      <stop offset="40%" stop-color="#C88745"/>
      <stop offset="75%" stop-color="#7E4926"/>
      <stop offset="100%" stop-color="#E0A56C"/>
    </linearGradient>

    <!-- ================= CARDS ================= -->

    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#23262C"/>
      <stop offset="100%" stop-color="#111318"/>
    </linearGradient>

    <linearGradient id="topCard" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#292C32"/>
      <stop offset="100%" stop-color="#121419"/>
    </linearGradient>

    <!-- ================= USER COLORS ================= -->

    <linearGradient id="user4Card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color4}" stop-opacity=".18"/>
      <stop offset="55%" stop-color="#17191E"/>
      <stop offset="100%" stop-color="#101216"/>
    </linearGradient>

    <linearGradient id="user5Card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color5}" stop-opacity=".18"/>
      <stop offset="55%" stop-color="#17191E"/>
      <stop offset="100%" stop-color="#101216"/>
    </linearGradient>

    <linearGradient id="user6Card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color6}" stop-opacity=".18"/>
      <stop offset="55%" stop-color="#17191E"/>
      <stop offset="100%" stop-color="#101216"/>
    </linearGradient>

    <linearGradient id="user7Card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color7}" stop-opacity=".18"/>
      <stop offset="55%" stop-color="#17191E"/>
      <stop offset="100%" stop-color="#101216"/>
    </linearGradient>

    <linearGradient id="user8Card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color8}" stop-opacity=".18"/>
      <stop offset="55%" stop-color="#17191E"/>
      <stop offset="100%" stop-color="#101216"/>
    </linearGradient>

    <!-- ================= EFFECTS ================= -->

    <filter id="blur45">
      <feGaussianBlur stdDeviation="45"/>
    </filter>

    <filter id="blur20">
      <feGaussianBlur stdDeviation="20"/>
    </filter>

    <filter id="shadow">
      <feDropShadow dx="0" dy="18" stdDeviation="20"
                    flood-color="#000000" flood-opacity=".58"/>
    </filter>

    <filter id="smallShadow">
      <feDropShadow dx="0" dy="8" stdDeviation="10"
                    flood-color="#000000" flood-opacity=".48"/>
    </filter>

    <filter id="goldShadow">
      <feDropShadow dx="0" dy="8" stdDeviation="16"
                    flood-color="#E5AE35" flood-opacity=".27"/>
    </filter>

    <!-- ================= AVATARS ================= -->

    <clipPath id="avatar1">
      <circle cx="900" cy="405" r="122"/>
    </clipPath>

    <clipPath id="avatar2">
      <circle cx="500" cy="465" r="92"/>
    </clipPath>

    <clipPath id="avatar3">
      <circle cx="1300" cy="465" r="92"/>
    </clipPath>

    <clipPath id="avatar4">
      <circle cx="1630" cy="995" r="57"/>
    </clipPath>

    <clipPath id="avatar5">
      <circle cx="1265" cy="995" r="57"/>
    </clipPath>

    <clipPath id="avatar6">
      <circle cx="900" cy="995" r="57"/>
    </clipPath>

    <clipPath id="avatar7">
      <circle cx="535" cy="995" r="57"/>
    </clipPath>

    <clipPath id="avatar8">
      <circle cx="170" cy="995" r="57"/>
    </clipPath>

  </defs>


  <!-- ========================================================= -->
  <!-- BACKGROUND -->
  <!-- ========================================================= -->

  <rect width="1800" height="1350" fill="url(#bg)"/>

  <ellipse cx="900" cy="470"
           rx="760" ry="520"
           fill="url(#redGlow)"/>

  <ellipse cx="900" cy="390"
           rx="440" ry="330"
           fill="url(#goldGlow)"/>

  <ellipse cx="900" cy="450"
           rx="680" ry="500"
           fill="url(#centerLight)"/>

  <ellipse cx="130" cy="620"
           rx="330" ry="450"
           fill="url(#blueGlow)"/>

  <ellipse cx="1670" cy="620"
           rx="330" ry="450"
           fill="url(#redGlow)"/>


  <!-- Elegant background geometry -->

  <g fill="none"
     stroke="#FFFFFF"
     stroke-width="2"
     opacity=".045">

    <circle cx="900" cy="445" r="300"/>
    <circle cx="900" cy="445" r="395"/>
    <circle cx="900" cy="445" r="500"/>
    <circle cx="900" cy="445" r="620"/>

    <path d="M-150 340 L680 0"/>
    <path d="M80 650 L1250 -20"/>
    <path d="M520 900 L1800 180"/>
    <path d="M980 1350 L1800 650"/>
  </g>


  <!-- ONLY 02 and 03 remain as background numbers -->

  <text x="90" y="455"
        font-family="Cairo, sans-serif"
        font-size="350"
        font-weight="900"
        fill="#FFFFFF"
        opacity=".018">
    02
  </text>

  <text x="1370" y="455"
        font-family="Cairo, sans-serif"
        font-size="350"
        font-weight="900"
        fill="#FFFFFF"
        opacity=".018">
    03
  </text>


  <!-- Particles -->

  <g fill="#FFFFFF">
    <circle cx="220" cy="245" r="2" opacity=".28"/>
    <circle cx="280" cy="390" r="3" opacity=".16"/>
    <circle cx="355" cy="270" r="2" opacity=".24"/>
    <circle cx="440" cy="210" r="2" opacity=".18"/>

    <circle cx="1370" cy="220" r="2" opacity=".22"/>
    <circle cx="1470" cy="300" r="3" opacity=".18"/>
    <circle cx="1570" cy="410" r="2" opacity=".28"/>
    <circle cx="1640" cy="270" r="2" opacity=".16"/>
  </g>

  <g fill="#FFD76A">
    <circle cx="620" cy="255" r="2.5" opacity=".45"/>
    <circle cx="1180" cy="245" r="2.5" opacity=".35"/>
    <circle cx="710" cy="320" r="2" opacity=".4"/>
    <circle cx="1080" cy="315" r="2" opacity=".35"/>
  </g>


  <!-- ========================================================= -->
  <!-- HEADER -->
  <!-- ========================================================= -->

  <text x="900" y="78"
        text-anchor="middle"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="46"
        font-weight="850">
    لوحة الشرف — ${groupName}
  </text>

  <line x1="720" y1="96"
        x2="1080" y2="96"
        stroke="#FFFFFF"
        stroke-opacity=".10"
        stroke-width="2"/>


  <!-- Crown -->

  <g transform="translate(900 143) scale(.48)"
     filter="url(#goldShadow)">

    <path d="M-95 20
             L-120 -65
             L-55 -25
             L0 -100
             L55 -25
             L120 -65
             L95 20 Z"
          fill="url(#gold)"
          stroke="#FFF2AA"
          stroke-width="5"/>

    <rect x="-100" y="20"
          width="200"
          height="32"
          rx="12"
          fill="url(#gold)"/>

    <circle cx="-120" cy="-65" r="12" fill="#FFE88A"/>
    <circle cx="0" cy="-100" r="14" fill="#FFE88A"/>
    <circle cx="120" cy="-65" r="12" fill="#FFE88A"/>
  </g>

  <text x="900" y="205"
        text-anchor="middle"
        fill="#AEB4BE"
        font-family="Cairo, sans-serif"
        font-size="23">
    أبطال التفاعل الشهري
  </text>


  <!-- ========================================================= -->
  <!-- TOP 3 AVATARS -->
  <!-- ========================================================= -->

  <!-- #2 -->

  <circle cx="500" cy="465"
          r="105"
          fill="#090A0D"
          stroke="url(#silver)"
          stroke-width="5"
          filter="url(#smallShadow)"/>

  ${avatarTag2}

  <circle cx="500" cy="465"
          r="92"
          fill="none"
          stroke="#D4D8DF"
          stroke-width="3"/>


  <!-- #3 -->

  <circle cx="1300" cy="465"
          r="105"
          fill="#090A0D"
          stroke="url(#bronze)"
          stroke-width="5"
          filter="url(#smallShadow)"/>

  ${avatarTag3}

  <circle cx="1300" cy="465"
          r="92"
          fill="none"
          stroke="#C88A55"
          stroke-width="3"/>


  <!-- #1 -->

  <circle cx="900" cy="405"
          r="137"
          fill="#090A0D"
          stroke="url(#gold)"
          stroke-width="8"
          filter="url(#goldShadow)"/>

  ${avatarTag1}

  <circle cx="900" cy="405"
          r="122"
          fill="none"
          stroke="#FFE38A"
          stroke-width="4"/>


  <!-- ========================================================= -->
  <!-- TOP 3 NAME PANELS -->
  <!-- ========================================================= -->

  <!-- #2 -->

  <rect x="330" y="565"
        width="340" height="78"
        rx="21"
        fill="url(#topCard)"
        stroke="#FFFFFF"
        stroke-opacity=".08"
        stroke-width="2"
        filter="url(#smallShadow)"/>

  <text x="500" y="598"
        text-anchor="middle"
        direction="rtl"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="27"
        font-weight="700">
    ${name2}
  </text>

  <text x="500" y="627"
        text-anchor="middle"
        fill="#AEB4BE"
        font-family="Cairo, sans-serif"
        font-size="19">
    ${count2} رسالة
  </text>


  <!-- #3 -->

  <rect x="1130" y="565"
        width="340" height="78"
        rx="21"
        fill="url(#topCard)"
        stroke="#FFFFFF"
        stroke-opacity=".08"
        stroke-width="2"
        filter="url(#smallShadow)"/>

  <text x="1300" y="598"
        text-anchor="middle"
        direction="rtl"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="27"
        font-weight="700">
    ${name3}
  </text>

  <text x="1300" y="627"
        text-anchor="middle"
        fill="#AEB4BE"
        font-family="Cairo, sans-serif"
        font-size="19">
    ${count3} رسالة
  </text>


  <!-- #1 -->

  <rect x="675" y="535"
        width="450" height="96"
        rx="25"
        fill="url(#topCard)"
        stroke="#FFD76A"
        stroke-opacity=".23"
        stroke-width="2"
        filter="url(#shadow)"/>

  <text x="900" y="573"
        text-anchor="middle"
        direction="rtl"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="31"
        font-weight="800">
    ${name1}
  </text>

  <text x="900" y="606"
        text-anchor="middle"
        fill="#FFD76A"
        font-family="Cairo, sans-serif"
        font-size="21"
        font-weight="600">
    ${count1} رسالة
  </text>


  <!-- ========================================================= -->
  <!-- PODIUM / RANK BARS -->
  <!-- ========================================================= -->

  <!-- #2 BAR -->
  <rect x="245" y="690"
        width="435"
        height="110"
        rx="25"
        fill="url(#card)"
        stroke="#FFFFFF"
        stroke-opacity=".09"
        stroke-width="2"
        filter="url(#smallShadow)"/>

  <text x="295" y="765"
        fill="url(#silver)"
        font-family="Cairo, sans-serif"
        font-size="68"
        font-weight="900">
    2
  </text>

  <text x="635" y="735"
        text-anchor="end"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="24"
        font-weight="750">
    المركز الثاني
  </text>

  <text x="635" y="767"
        text-anchor="end"
        fill="#858B95"
        font-family="Cairo, sans-serif"
        font-size="16">
    الوصيف
  </text>


  <!-- #1 BAR -->
  <rect x="682" y="665"
        width="436"
        height="135"
        rx="28"
        fill="#1B1C20"
        stroke="#FFD76A"
        stroke-opacity=".30"
        stroke-width="2"
        filter="url(#shadow)"/>

  <text x="725" y="757"
        fill="#FFD76A"
        font-family="Cairo, sans-serif"
        font-size="76"
        font-weight="900">
    1
  </text>

  <text x="1075" y="716"
        text-anchor="end"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="27"
        font-weight="800">
    البطل الأول
  </text>

  <text x="1075" y="750"
        text-anchor="end"
        fill="#A58A4A"
        font-family="Cairo, sans-serif"
        font-size="16">
    بطل التفاعل
  </text>


  <!-- #3 BAR -->
  <rect x="1120" y="690"
        width="435"
        height="110"
        rx="25"
        fill="url(#card)"
        stroke="#FFFFFF"
        stroke-opacity=".09"
        stroke-width="2"
        filter="url(#smallShadow)"/>

  <text x="1170" y="765"
        fill="url(#bronze)"
        font-family="Cairo, sans-serif"
        font-size="68"
        font-weight="900">
    3
  </text>

  <text x="1510" y="735"
        text-anchor="end"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="24"
        font-weight="750">
    المركز الثالث
  </text>

  <text x="1510" y="767"
        text-anchor="end"
        fill="#858B95"
        font-family="Cairo, sans-serif"
        font-size="16">
    المركز البرونزي
  </text>


  <!-- ========================================================= -->
  <!-- LOWER SECTION -->
  <!-- ========================================================= -->

  <text x="900" y="860"
        text-anchor="middle"
        fill="#D8DCE3"
        font-family="Cairo, sans-serif"
        font-size="26"
        font-weight="700">
    بقية أبطال التفاعل
  </text>

  <line x1="690" y1="882"
        x2="1110" y2="882"
        stroke="#FFFFFF"
        stroke-opacity=".08"
        stroke-width="2"/>


  <!-- ========================================================= -->
  <!-- #8 -->
  <!-- ========================================================= -->

  <rect x="30" y="920"
        width="330" height="235"
        rx="26"
        fill="url(#user8Card)"
        stroke="${color8}"
        stroke-opacity=".22"
        stroke-width="2"
        filter="url(#smallShadow)"/>

  <text x="58" y="1055"
        fill="${color8}"
        font-family="Cairo, sans-serif"
        font-size="72"
        font-weight="900">
    8
  </text>

  <circle cx="170" cy="995"
          r="65"
          fill="#08090C"
          stroke="${color8}"
          stroke-opacity=".42"
          stroke-width="3"/>

  ${avatarTag8}

  <text x="195" y="1090"
        text-anchor="middle"
        direction="rtl"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="23"
        font-weight="700">
    ${name8}
  </text>

  <text x="195" y="1122"
        text-anchor="middle"
        fill="${color8}"
        font-family="Cairo, sans-serif"
        font-size="18"
        font-weight="600">
    ${count8} رسالة
  </text>


  <!-- ========================================================= -->
  <!-- #7 -->
  <!-- ========================================================= -->

  <rect x="380" y="920"
        width="330" height="235"
        rx="26"
        fill="url(#user7Card)"
        stroke="${color7}"
        stroke-opacity=".22"
        stroke-width="2"
        filter="url(#smallShadow)"/>

  <text x="408" y="1055"
        fill="${color7}"
        font-family="Cairo, sans-serif"
        font-size="72"
        font-weight="900">
    7
  </text>

  <circle cx="535" cy="995"
          r="65"
          fill="#08090C"
          stroke="${color7}"
          stroke-opacity=".42"
          stroke-width="3"/>

  ${avatarTag7}

  <text x="560" y="1090"
        text-anchor="middle"
        direction="rtl"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="23"
        font-weight="700">
    ${name7}
  </text>

  <text x="560" y="1122"
        text-anchor="middle"
        fill="${color7}"
        font-family="Cairo, sans-serif"
        font-size="18"
        font-weight="600">
    ${count7} رسالة
  </text>


  <!-- ========================================================= -->
  <!-- #6 -->
  <!-- ========================================================= -->

  <rect x="730" y="920"
        width="330" height="235"
        rx="26"
        fill="url(#user6Card)"
        stroke="${color6}"
        stroke-opacity=".22"
        stroke-width="2"
        filter="url(#smallShadow)"/>

  <text x="758" y="1055"
        fill="${color6}"
        font-family="Cairo, sans-serif"
        font-size="72"
        font-weight="900">
    6
  </text>

  <circle cx="900" cy="995"
          r="65"
          fill="#08090C"
          stroke="${color6}"
          stroke-opacity=".42"
          stroke-width="3"/>

  ${avatarTag6}

  <text x="925" y="1090"
        text-anchor="middle"
        direction="rtl"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="23"
        font-weight="700">
    ${name6}
  </text>

  <text x="925" y="1122"
        text-anchor="middle"
        fill="${color6}"
        font-family="Cairo, sans-serif"
        font-size="18"
        font-weight="600">
    ${count6} رسالة
  </text>


  <!-- ========================================================= -->
  <!-- #5 -->
  <!-- ========================================================= -->

  <rect x="1080" y="920"
        width="330" height="235"
        rx="26"
        fill="url(#user5Card)"
        stroke="${color5}"
        stroke-opacity=".22"
        stroke-width="2"
        filter="url(#smallShadow)"/>

  <text x="1108" y="1055"
        fill="${color5}"
        font-family="Cairo, sans-serif"
        font-size="72"
        font-weight="900">
    5
  </text>

  <circle cx="1265" cy="995"
          r="65"
          fill="#08090C"
          stroke="${color5}"
          stroke-opacity=".42"
          stroke-width="3"/>

  ${avatarTag5}

  <text x="1290" y="1090"
        text-anchor="middle"
        direction="rtl"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="23"
        font-weight="700">
    ${name5}
  </text>

  <text x="1290" y="1122"
        text-anchor="middle"
        fill="${color5}"
        font-family="Cairo, sans-serif"
        font-size="18"
        font-weight="600">
    ${count5} رسالة
  </text>


  <!-- ========================================================= -->
  <!-- #4 -->
  <!-- ========================================================= -->

  <rect x="1430" y="920"
        width="330" height="235"
        rx="26"
        fill="url(#user4Card)"
        stroke="${color4}"
        stroke-opacity=".22"
        stroke-width="2"
        filter="url(#smallShadow)"/>

  <text x="1458" y="1055"
        fill="${color4}"
        font-family="Cairo, sans-serif"
        font-size="72"
        font-weight="900">
    4
  </text>

  <circle cx="1630" cy="995"
          r="65"
          fill="#08090C"
          stroke="${color4}"
          stroke-opacity=".42"
          stroke-width="3"/>

  ${avatarTag4}

  <text x="1655" y="1090"
        text-anchor="middle"
        direction="rtl"
        fill="#FFFFFF"
        font-family="Cairo, sans-serif"
        font-size="23"
        font-weight="700">
    ${name4}
  </text>

  <text x="1655" y="1122"
        text-anchor="middle"
        fill="${color4}"
        font-family="Cairo, sans-serif"
        font-size="18"
        font-weight="600">
    ${count4} رسالة
  </text>


  <!-- ========================================================= -->
  <!-- FOOTER -->
  <!-- ========================================================= -->

  <line x1="650" y1="1200"
        x2="1150" y2="1200"
        stroke="#FFFFFF"
        stroke-opacity=".06"
        stroke-width="2"/>

  <text x="900" y="1250"
        text-anchor="middle"
        fill="#FFFFFF"
        fill-opacity=".45"
        font-family="Cairo, sans-serif"
        font-size="24"
        font-weight="700"
        letter-spacing="2">
    Activity Tracker Bot
  </text>

</svg>
  `;

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1800 }, // Full 1800x1350 Crisp HD Output
    font: hasCairoFont ? {
      fontFiles: hasEmojiFont ? [fontPath, fontPathEmoji] : [fontPath],
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
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch {
      // بيئة تشغيل لا تحتوي على vite (مثل مستودع API على Render)
    }
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
