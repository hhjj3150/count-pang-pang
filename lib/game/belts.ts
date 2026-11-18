// 🥋 띠·그랄 (승급 기준과 색)

/* ------------------------- 🥋 승급 축하 연출 ------------------------- */
export const BELT_NAMES = ["화이트", "블루", "퍼플", "브라운", "블랙"] as const
export type BeltName = (typeof BELT_NAMES)[number]

// 띠 색상 (base: 띠 색, edge: 테두리, bar: 그랄이 감기는 랭크바, stitch: 박음질 선)
export const BELT_COLORS: Record<BeltName, { base: string; edge: string; bar: string; stitch: string }> = {
  화이트: { base: "#f8fafc", edge: "#cbd5e1", bar: "#18181b", stitch: "rgba(100,116,139,0.45)" },
  블루: { base: "#2563eb", edge: "#1e3a8a", bar: "#18181b", stitch: "rgba(255,255,255,0.35)" },
  퍼플: { base: "#7c3aed", edge: "#4c1d95", bar: "#18181b", stitch: "rgba(255,255,255,0.35)" },
  브라운: { base: "#92400e", edge: "#451a03", bar: "#18181b", stitch: "rgba(255,255,255,0.3)" },
  블랙: { base: "#18181b", edge: "#000000", bar: "#dc2626", stitch: "rgba(255,255,255,0.25)" },
}

// "🟦 블루 3그랄" → { name: "블루", stripes: 3 }
export function parseBelt(badge: string): { name: BeltName; stripes: number } {
  const name = BELT_NAMES.find((n) => badge.includes(n)) ?? "화이트"
  const m = badge.match(/(\d)그랄/)
  return { name, stripes: m ? Number(m[1]) : 0 }
}

export const getBeltInfo = (lp: number) => {
  const ranks = [
    // ⬜ 화이트 벨트 구간 (0 ~ 20,000) - 4000P마다 1그랄
    { req: 0,     badge: "⬜ 화이트",        style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
    { req: 4000,  badge: "⬜ 화이트 1그랄",  style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
    { req: 8000,  badge: "⬜ 화이트 2그랄",  style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
    { req: 12000,  badge: "⬜ 화이트 3그랄",  style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
    { req: 16000,  badge: "⬜ 화이트 4그랄",  style: "bg-white text-gray-700 border border-gray-300 shadow-sm" },
    
    // 🟦 블루 벨트 구간 (20,000 ~ 60,000) - 8000P마다 1그랄
    { req: 20000, badge: "🟦 블루",        style: "bg-blue-600 text-white shadow-sm" },
    { req: 28000, badge: "🟦 블루 1그랄",  style: "bg-blue-600 text-white shadow-sm" },
    { req: 36000, badge: "🟦 블루 2그랄",  style: "bg-blue-600 text-white shadow-sm" },
    { req: 44000, badge: "🟦 블루 3그랄",  style: "bg-blue-600 text-white shadow-sm" },
    { req: 52000, badge: "🟦 블루 4그랄",  style: "bg-blue-600 text-white shadow-sm" },
    
    // 🟪 퍼플 벨트 구간 (60,000 ~ 120,000) - 12000P마다 1그랄
    { req: 60000, badge: "🟪 퍼플",        style: "bg-purple-600 text-white shadow-sm" },
    { req: 72000, badge: "🟪 퍼플 1그랄",  style: "bg-purple-600 text-white shadow-sm" },
    { req: 84000, badge: "🟪 퍼플 2그랄",  style: "bg-purple-600 text-white shadow-sm" },
    { req: 96000, badge: "🟪 퍼플 3그랄",  style: "bg-purple-600 text-white shadow-sm" },
    { req: 108000, badge: "🟪 퍼플 4그랄",  style: "bg-purple-600 text-white shadow-sm" },
    
    // 🟫 브라운 벨트 구간 (120,000 ~ 200,000) - 16000P마다 1그랄
    { req: 120000, badge: "🟫 브라운",        style: "bg-amber-800 text-white shadow-sm" },
    { req: 136000, badge: "🟫 브라운 1그랄",  style: "bg-amber-800 text-white shadow-sm" },
    { req: 152000, badge: "🟫 브라운 2그랄",  style: "bg-amber-800 text-white shadow-sm" },
    { req: 168000, badge: "🟫 브라운 3그랄",  style: "bg-amber-800 text-white shadow-sm" },
    { req: 184000, badge: "🟫 브라운 4그랄",  style: "bg-amber-800 text-white shadow-sm" },
    
    // ⬛ 블랙 벨트 (200,000 ~ )
    { req: 200000, badge: "⬛ 블랙 벨트",    style: "bg-zinc-900 text-yellow-400 ring-1 ring-yellow-400/30 shadow-md" },
  ];
  
  let currentRankIndex = 0;
  for (let i = 0; i < ranks.length; i++) {
    if (lp >= ranks[i].req) currentRankIndex = i;
    else break;
  }
  
  return { 
    currentRank: ranks[currentRankIndex], 
    nextRank: currentRankIndex < ranks.length - 1 ? ranks[currentRankIndex + 1] : null 
  };
};
