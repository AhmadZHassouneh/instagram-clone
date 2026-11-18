// Fictional people and businesses for fixtures and seed data. Names are random combinations of
// common given names and family names; businesses are invented. [latin, arabic] pairs let tests
// exercise Arabic/English transliteration matching.
import type { Rng } from "./random";

export const FIRST_NAMES: readonly (readonly [string, string])[] = [
  ["RAMI", "رامي"], ["SAMIR", "سمير"], ["KHALED", "خالد"], ["HUDA", "هدى"], ["FARES", "فارس"],
  ["LAYAN", "ليان"], ["OMAR", "عمر"], ["ZAID", "زيد"], ["NOOR", "نور"], ["KAREEM", "كريم"],
  ["YAZAN", "يزن"], ["TALA", "تالا"], ["HAMZA", "حمزة"], ["RAWAN", "روان"], ["BASHAR", "بشار"],
  ["DIMA", "ديما"], ["MUTAZ", "معتز"], ["SALMA", "سلمى"], ["ODAI", "عدي"], ["JANA", "جنى"],
  ["QUSAI", "قصي"], ["LEEN", "لين"], ["ANAS", "أنس"], ["HALA", "هلا"], ["SUHAIB", "صهيب"],
  ["MAYAR", "ميار"], ["TAMER", "تامر"], ["REEM", "ريم"], ["WALEED", "وليد"], ["SHAHD", "شهد"],
];

export const FAMILY_NAMES: readonly (readonly [string, string])[] = [
  ["NASSAR", "نصار"], ["HADDAD", "حداد"], ["ZOUBI", "الزعبي"], ["MOMANI", "المومني"], ["KHALIL", "خليل"],
  ["SALEH", "صالح"], ["QUDAH", "القضاة"], ["SHAWABKEH", "الشوابكة"], ["OBEIDAT", "عبيدات"], ["MAJALI", "المجالي"],
  ["TARAWNEH", "الطراونة"], ["BATAINEH", "البطاينة"], ["RAWASHDEH", "الرواشدة"], ["AZZAM", "عزام"], ["JABER", "جابر"],
  ["FAKHOURI", "الفاخوري"], ["DAJANI", "الدجاني"], ["KHATIB", "الخطيب"], ["NIMRI", "النمري"], ["SMADI", "الصمادي"],
];

export type FakePerson = { latin: string; arabic: string; first: string; firstArabic: string };

/** "RAMI SAMIR NASSAR" / "رامي سمير نصار"; extraParts adds more middle names for long-name cases. */
export function fakePerson(rng: Rng, extraParts = 0): FakePerson {
  const first = rng.pick(FIRST_NAMES);
  const middles = Array.from({ length: 1 + extraParts }, () => rng.pick(FIRST_NAMES));
  const family = rng.pick(FAMILY_NAMES);
  const parts = [first, ...middles, family];
  return {
    latin: parts.map((p) => p[0]).join(" "),
    arabic: parts.map((p) => p[1]).join(" "),
    first: first[0],
    firstArabic: first[1],
  };
}

export type FakeBusiness = {
  username: string;
  name: string; // shown in the app
  nameArabic: string;
  /** Name as it would appear on a bank transfer. */
  latin: string;
  category: string;
  /** client = hires the developer (Scenario A); vendor = sells to the developer (Scenario B). */
  role: "client" | "vendor";
};

export const BUSINESSES: readonly FakeBusiness[] = [
  { username: "qahwet.albalad", name: "Qahwet Al Balad", nameArabic: "قهوة البلد", latin: "QAHWET AL BALAD CAFE", category: "Coffee shop", role: "client" },
  { username: "ibtisama.dental", name: "Ibtisama Dental Clinic", nameArabic: "عيادة ابتسامة لطب الأسنان", latin: "IBTISAMA DENTAL CLINIC", category: "Dental clinic", role: "client" },
  { username: "bait.almafatih", name: "Bait Al Mafatih Real Estate", nameArabic: "مكتب بيت المفاتيح للعقارات", latin: "BAIT AL MAFATIH REAL ESTATE", category: "Real estate", role: "client" },
  { username: "sahtein.kitchen", name: "Sahtein Kitchen", nameArabic: "مطبخ صحتين", latin: "SAHTEIN KITCHEN", category: "Restaurant", role: "client" },
  { username: "nashmi.fitness", name: "Nashmi Fitness", nameArabic: "نادي النشمي", latin: "NASHMI FITNESS CENTER", category: "Gym", role: "client" },
  { username: "zaha.salon", name: "Zaha Beauty Lounge", nameArabic: "صالون زها", latin: "ZAHA BEAUTY LOUNGE", category: "Beauty salon", role: "client" },
  { username: "alwaha.driving", name: "Al Waha Driving School", nameArabic: "مدرسة الواحة لتعليم السواقة", latin: "AL WAHA DRIVING SCHOOL", category: "Driving school", role: "client" },
  { username: "lamsa.furniture", name: "Lamsa Furniture", nameArabic: "لمسة للأثاث", latin: "LAMSA FURNITURE CO", category: "Furniture store", role: "client" },
  { username: "rawabi.kg", name: "Rawabi Kindergarten", nameArabic: "روضة الروابي", latin: "RAWABI KINDERGARTEN", category: "Kindergarten", role: "client" },
  { username: "bawabet.travel", name: "Bawabet Amman Travel", nameArabic: "بوابة عمان للسياحة", latin: "BAWABET AMMAN TRAVEL", category: "Travel agency", role: "client" },
  { username: "cloudjo.hosting", name: "CloudJo Hosting", nameArabic: "كلاود جو للاستضافة", latin: "CLOUDJO HOSTING SERVICES", category: "Web hosting", role: "vendor" },
  { username: "domainat.jo", name: "Domainat", nameArabic: "دومينات", latin: "DOMAINAT FOR DOMAINS", category: "Domain registrar", role: "vendor" },
  { username: "techzone.acc", name: "TechZone Accessories", nameArabic: "تك زون للإكسسوارات", latin: "TECHZONE ACCESSORIES", category: "Electronics store", role: "vendor" },
  { username: "pixel.studio.jo", name: "Pixel Studio", nameArabic: "بكسل ستوديو", latin: "PIXEL STUDIO DESIGN", category: "Design studio", role: "vendor" },
  { username: "codeacademy.jo", name: "Code Academy JO", nameArabic: "أكاديمية الكود", latin: "CODE ACADEMY JO", category: "Training center", role: "vendor" },
  { username: "licensehub.me", name: "License Hub", nameArabic: "لايسنس هب", latin: "LICENSE HUB MIDDLE EAST", category: "Software reseller", role: "vendor" },
];
