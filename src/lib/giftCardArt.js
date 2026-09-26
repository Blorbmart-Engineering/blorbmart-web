// GENERATED from Blorbmart-backend/services/giftCards/art.js by
// scripts/sync-gift-card-art.js. Do not edit here: edit the backend copy and
// run the script, or the backend test suite will fail.
/* eslint-disable */

/* ═══════════════════════════════════════════════════════════════════════
   Gift card artwork.

   One template draws every Blorbmart gift card, wherever it appears: the
   live preview while someone composes a card in the web app, the PNG the
   backend renders for downloads, the Flutter app and the recipient's email.
   It is plain JavaScript with no dependencies so that the same file runs in
   Node and in a browser, and the two can never drift apart.

   The canonical copy lives in Blorbmart-backend/services/giftCards/art.js.
   blorbmart-web/src/lib/giftCardArt.js is generated from it by
   `node scripts/sync-gift-card-art.js`, and a test fails if they differ.
   Edit this file, never the copy.

   Text layout is computed here, not left to the renderer, from advance
   widths taken out of the very font files the backend bundles
   (assets/fonts). That is what lets a browser and resvg break a message on
   the same words.

   Everything a customer types passes through cleanText() and is escaped on
   the way into the markup. Colours, motifs and fonts are only ever picked
   from the catalogues below, never taken from input.
   ═══════════════════════════════════════════════════════════════════════ */

const CARD_W = 1600;
const CARD_H = 1000;

/** How much a customer may write, in characters. */
const LIMITS = { headline: 28, name: 24, message: 140 };

const FAMILY = {
  serif: "Fraunces, Georgia, 'Times New Roman', serif",
  script: "'Great Vibes', 'Brush Script MT', cursive",
  sans: "'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif",
  hand: "Caveat, 'Segoe Print', cursive",
  mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
};

/* Advance widths for printable ASCII (32–126), in thousandths of an em,
   read from the bundled fonts. */
const ADVANCE = {
  serif: '211,332,411,673,617,825,995,199,382,382,623,566,310,404,298,502,702,489,642,591,663,610,646,550,654,647,300,312,523,566,523,569,953,761,741,712,817,676,632,775,876,434,555,828,649,955,772,800,732,801,791,628,721,758,738,1089,743,700,652,367,501,375,476,505,271,580,629,539,640,546,424,597,662,334,334,638,335,982,661,609,644,630,505,510,414,650,571,861,575,588,510,415,305,415,639',
  serifItalic: '202,328,363,652,584,754,689,176,368,365,621,554,256,385,248,457,658,440,599,545,576,563,603,528,577,602,298,308,515,558,515,503,898,651,675,650,757,636,608,712,797,388,377,725,571,864,713,770,668,770,700,583,599,710,640,971,663,596,619,379,428,379,461,465,239,563,560,467,573,498,332,532,583,325,312,564,322,867,603,540,561,546,483,449,383,600,580,844,594,522,514,409,318,407,623',
  script: '171,312,206,801,452,624,610,106,532,512,553,343,215,404,205,501,458,303,392,387,406,372,395,347,384,402,295,296,235,378,253,405,1028,716,1047,714,1050,819,1053,702,1395,917,972,1203,716,1336,1044,730,925,756,1028,926,933,947,980,1351,791,963,681,411,831,451,321,729,183,358,327,263,372,256,194,396,336,176,178,360,213,509,338,338,336,347,259,267,201,356,309,495,334,381,343,549,463,508,373',
  sans: '180,400,532,956,647,1070,813,333,407,407,560,678,386,634,408,532,700,413,596,612,662,614,604,564,633,604,408,428,678,678,678,611,926,732,690,772,739,589,587,804,732,287,396,687,547,912,742,878,649,878,667,647,552,724,712,1032,682,672,567,449,532,449,678,684,391,583,673,611,673,611,410,648,599,260,260,586,260,929,599,651,673,673,386,515,421,599,582,912,582,602,492,425,426,425,678',
  hand: '242,210,237,559,450,600,564,117,330,330,363,446,198,326,198,330,450,450,450,450,450,439,464,447,450,442,198,198,446,446,446,374,643,508,522,475,584,532,462,492,570,406,312,505,426,726,612,502,467,495,542,492,458,482,490,720,524,504,522,330,330,330,446,446,353,443,441,361,399,331,297,361,470,193,210,371,175,566,456,359,378,377,360,347,331,370,331,517,343,341,315,330,330,330,446',
};
const AVERAGE = { serif: 576, serifItalic: 528, script: 317, sans: 569, hand: 363, mono: 600 };
const WIDTHS = {};
for (const key of Object.keys(ADVANCE)) WIDTHS[key] = ADVANCE[key].split(',').map(Number);

/* The cart-handle B and the wordmark, traced from the master artwork (the
   same paths as blorbmart-landing/src/components/Logo.tsx). */
const MARK_D =
  'M 282.1 325.1 C 277 325.6, 270 327, 266.6 328.1 C 226.1 341.6, 220.7 400, 257.8 422.4 C 266.1 427.3, 271.9 429, 286.5 430.5 C 305.6 432.5, 315.9 436.9, 327.1 448.1 C 341 461.9, 342.3 466.8, 357.4 561 C 360.9 582.7, 367.4 621.9, 371.8 648 C 376.2 674.1, 381.9 707.9, 384.3 723 C 406.5 857.9, 408.9 868.2, 423.5 892.9 C 445.8 930.6, 478.5 958.4, 516 971.5 C 540.5 980, 560.8 982, 622.5 982 C 691 982, 712.8 978.8, 742.3 964.6 C 782.2 945.4, 816.4 905.5, 831.4 860.8 C 850.8 802.8, 831.8 730.4, 786.8 691.1 C 775.3 681.1, 775.3 681.2, 783.5 668.6 C 845.7 572.8, 791.9 440.7, 683.5 423.5 C 667.4 420.9, 637.6 420, 574 419.9 C 539.6 419.9, 508.1 419.8, 503.9 419.7 C 489.8 419.4, 489.7 419.9, 496.9 463.6 C 499.7 480.1, 503 501.4, 504.5 511 C 507.5 531.8, 507.4 531.4, 510.7 534 C 513.2 536, 514.5 536, 582.9 536 C 659.1 536, 657.4 535.9, 668.9 542 C 681.8 548.9, 693.6 566.1, 696.2 581.8 C 700.4 607, 681.2 634.3, 654.8 640.5 C 649.6 641.7, 638.3 642, 590.2 642 C 551.9 642, 531.2 642.4, 529.9 643 C 527.2 644.5, 527.3 645.1, 534.5 686.4 C 538 706.8, 542.1 730.7, 543.6 739.5 C 545.2 749.5, 546.7 756.2, 547.7 757.3 C 549.2 758.9, 553.5 759, 610.4 759 C 678.2 759, 679.8 759.2, 692.6 765.5 C 719.4 778.7, 729.3 808.7, 716 836.6 C 708.1 853, 696.3 861.1, 675.6 864.5 C 662.7 866.5, 583.5 866.6, 572 864.6 C 553.6 861.3, 535.3 848.4, 525.1 831.6 C 517.1 818.3, 513.8 805.9, 507.5 765.4 C 504.9 748.9, 499.9 719.8, 496.4 700.5 C 492.8 681.3, 486.8 647.1, 483 624.5 C 479.2 602, 474.8 575.6, 473.1 566 C 471.4 556.4, 469.1 541.3, 468 532.5 C 465.4 512.6, 454.5 447.5, 452.4 439.8 C 439.3 389.2, 402 347.9, 355.1 331.9 C 335.9 325.3, 306.5 322.6, 282.1 325.1';
const WORDMARK_D =
  'M 1111 1164.5 C 1111 1235.2, 1111 1237.1, 1113.1 1242.4 C 1118 1255.7, 1132.1 1260.3, 1153.1 1255.6 C 1164.3 1253.1, 1164.2 1253.3, 1162.3 1242.5 C 1161.4 1237.6, 1160.6 1233.4, 1160.5 1233.2 C 1160.4 1233.1, 1157.4 1233.7, 1153.7 1234.6 C 1145.7 1236.6, 1140.9 1235.9, 1138 1232.3 C 1136 1229.8, 1136 1228.7, 1136 1160.9 L 1136 1092 1123.5 1092 L 1111 1092 1111 1164.5 M 1397 1173.5 L 1397 1255 1407.5 1255 L 1418 1255 1418 1245.5 C 1418 1240.3, 1418.3 1236, 1418.8 1236 C 1419.2 1236, 1420.9 1237.9, 1422.5 1240.1 C 1440 1263.9, 1479.7 1263, 1500.8 1238.4 C 1527.6 1207.1, 1514.6 1151.3, 1477.9 1139.9 C 1458.8 1133.9, 1436.7 1140.7, 1425.3 1156 L 1421.5 1161.1 1421.2 1126.6 L 1421 1092 1409 1092 L 1397 1092 1397 1173.5 M 962 1176 L 962 1255 1005.3 1255 C 1052.6 1255, 1054.5 1254.8, 1065.8 1249.1 C 1073.2 1245.4, 1080 1238.8, 1083.7 1231.9 C 1087.8 1224, 1087.9 1204.5, 1083.8 1195.8 C 1080.1 1187.9, 1073 1180.6, 1065.4 1176.9 L 1059.1 1173.8 1063.8 1170.6 C 1087.8 1154.1, 1085.5 1113.5, 1059.8 1099.8 C 1055.5 1097.5, 1055.5 1097.5, 1008.8 1097.2 L 962 1096.9 962 1176 M 1961 1120 L 1961 1139 1953.5 1139 L 1946 1139 1946 1148.5 L 1946 1158 1953.5 1158 L 1961 1158 1961 1196.8 C 1961 1240.9, 1961.3 1242.9, 1967.9 1249.8 C 1974.1 1256.2, 1985.4 1259, 1997.5 1257 C 2004.7 1255.9, 2017.6 1251.8, 2019.2 1250.2 C 2020.1 1249.3, 2016.5 1233.2, 2015.1 1231.7 C 2014.6 1231.2, 2011.5 1231.8, 2008.2 1232.9 C 2001 1235.4, 1997.2 1235.5, 1992.5 1233.6 C 1986.1 1230.9, 1986 1230, 1986 1192.1 L 1986 1158 1998.5 1158 L 2011 1158 2011 1148.5 L 2011 1139 1998.5 1139 L 1986 1139 1986 1120 L 1986 1101 1973.5 1101 L 1961 1101 1961 1120 M 988 1141.5 L 988 1165 1012.1 1165 C 1038.3 1165, 1041.7 1164.5, 1047.4 1159.9 C 1060.7 1148.8, 1056.4 1123.5, 1040.3 1119.1 C 1038.1 1118.5, 1026.1 1118, 1012.3 1118 L 988 1118 988 1141.5 M 1366.7 1138.1 C 1357 1140.4, 1346 1148.6, 1339.4 1158.5 L 1336 1163.5 1336 1151.2 L 1336 1139 1324.5 1139 L 1313 1139 1313 1197 L 1313 1255 1325.5 1255 L 1338 1255 1338 1218.6 L 1338 1182.2 1341.3 1177.4 C 1347.4 1168.4, 1359.8 1161.8, 1373.3 1160.3 L 1379.1 1159.7 1378.8 1148.6 L 1378.5 1137.5 1374.5 1137.3 C 1372.3 1137.2, 1368.8 1137.6, 1366.7 1138.1 M 1924.4 1138.4 C 1914.6 1140.8, 1905.1 1147.8, 1898.4 1157.6 L 1894.5 1163.3 1894.2 1151.1 L 1893.9 1139 1882.5 1139 L 1871 1139 1871 1197 L 1871 1255 1883.5 1255 L 1896 1255 1896 1219.2 L 1896 1183.4 1898.8 1178.9 C 1905.6 1168.2, 1920.8 1160, 1933.7 1160 L 1937 1160 1937 1148.5 L 1937 1137 1933.3 1137.1 C 1931.2 1137.1, 1927.2 1137.7, 1924.4 1138.4 M 1214 1139.6 C 1169.8 1151.2, 1155.4 1208.3, 1188.4 1241.1 C 1199.6 1252.2, 1213 1257.3, 1230.5 1257.3 C 1259.8 1257.3, 1281.9 1240.4, 1289 1212.4 C 1297.2 1180.5, 1277.7 1146.8, 1246.9 1139.5 C 1238.8 1137.6, 1221.3 1137.7, 1214 1139.6 M 1589 1139.3 C 1578.7 1142.2, 1566.5 1151.1, 1560.7 1160 C 1559.2 1162.4, 1559.1 1162, 1559.1 1150.8 L 1559 1139 1548 1139 L 1537 1139 1537 1197 L 1537 1255 1549.5 1255 L 1562 1255 1562 1220 L 1562 1184.9 1564.6 1179.9 C 1570.5 1168.1, 1580.1 1161, 1591 1160.2 C 1599.4 1159.6, 1602.7 1160.8, 1607.4 1166 C 1613.2 1172.4, 1613.4 1173.8, 1613.7 1216.3 L 1614.1 1255 1626.6 1255 L 1639 1255 1639 1220.3 L 1639 1185.5 1641.5 1180.1 C 1651.6 1158.4, 1678.6 1152.7, 1687.5 1170.5 L 1690.5 1176.5 1690.8 1215.8 L 1691.1 1255 1703.5 1255 L 1716 1255 1716 1215.1 C 1716 1171.6, 1715.4 1164.9, 1710.5 1154.6 C 1704.7 1142.4, 1695.2 1137.6, 1678.2 1138.2 C 1662.4 1138.8, 1650.5 1144.9, 1641.4 1157.3 C 1637.8 1162.2, 1636.9 1162.9, 1636.4 1161.4 C 1632.8 1151.1, 1628.2 1145.2, 1620.6 1141.2 C 1614.5 1138.1, 1597.1 1137, 1589 1139.3 M 1771 1140 C 1763 1142.1, 1743 1151.4, 1743 1153.1 C 1743 1154, 1749.7 1167.9, 1750.6 1168.9 C 1750.8 1169.2, 1754.9 1167.3, 1759.8 1164.8 C 1771.3 1158.7, 1777.5 1157, 1788 1157 C 1806.8 1157, 1815.4 1164.4, 1816.7 1181.9 C 1817.3 1188.9, 1817.2 1189.3, 1815.4 1188.6 C 1801 1182.9, 1771.8 1183.8, 1757.3 1190.5 C 1734.3 1201, 1729.3 1230.1, 1747.6 1247 C 1764.5 1262.5, 1795.8 1260.6, 1814.6 1242.8 L 1819.9 1237.8 1820.5 1241.7 C 1822.5 1253.4, 1829 1257.9, 1842 1256.4 L 1848 1255.7 1848 1245.9 C 1848 1236.2, 1848 1236.1, 1845.3 1234.8 C 1841.5 1233, 1841.3 1231.3, 1841.1 1200.9 C 1841 1177.4, 1840.8 1173.5, 1839 1167.8 C 1835.1 1155.2, 1825 1145, 1812 1140.6 C 1803.5 1137.7, 1780.9 1137.4, 1771 1140 M 1219.8 1160.6 C 1207.4 1164.4, 1196.9 1179.7, 1196.2 1195 C 1194.2 1237.4, 1243.4 1252.6, 1261.7 1215.1 C 1266 1206.5, 1265.9 1188.3, 1261.6 1179.5 C 1253.6 1163.1, 1236.6 1155.4, 1219.8 1160.6 M 1443.2 1161.4 C 1435.4 1165.2, 1431.3 1168.7, 1425.9 1176.4 L 1421 1183.3 1421 1198.4 C 1421 1215.8, 1422 1219.1, 1429 1225.9 C 1459 1255, 1503.5 1218.6, 1485.7 1179.6 C 1477.9 1162.6, 1458.3 1154.2, 1443.2 1161.4 M 988 1209.6 L 988 1234.1 1016.3 1233.8 C 1044.2 1233.5, 1044.5 1233.5, 1049 1231 C 1066.3 1221.3, 1065.4 1195.1, 1047.5 1186.9 C 1043.9 1185.2, 1040.5 1185, 1015.8 1185 L 988 1185 988 1209.6 M 1775.1 1201.9 C 1764.2 1205.7, 1759.6 1211.4, 1760.2 1220.2 C 1761.1 1232.8, 1770.4 1239.6, 1785.8 1238.8 C 1805.2 1237.9, 1817 1227.5, 1817 1211.3 L 1817 1204.3 1811.3 1202.5 C 1802.3 1199.8, 1782 1199.4, 1775.1 1201.9';

/* ── Palettes ─────────────────────────────────────────────────────────── */

const FOIL = {
  gold: ['#FBE9B7', '#E2B550', '#FFF3CC', '#C8961F', '#F6D98A'],
  deepGold: ['#B98F3E', '#8C6420', '#CFA95A', '#76521A', '#A8813A'],
  rose: ['#E0245E', '#B0123F', '#F05A83', '#A10F37', '#D6245B'],
  copper: ['#D17A52', '#A9442A', '#E08E66', '#93381F', '#C0512F'],
  jade: ['#139A6E', '#0A6B4C', '#26B083', '#075C41', '#0E8F66'],
  azure: ['#3D8BF5', '#1560D6', '#6AA8FF', '#0B4FB8', '#1F77F1'],
};

const DARK_PANEL = { panel: 'rgba(255,255,255,0.10)', panelLine: 'rgba(255,255,255,0.24)' };
const LIGHT_PANEL = { panel: 'rgba(255,255,255,0.62)', panelLine: 'rgba(11,18,32,0.10)' };

const PALETTES = {
  midnight: {
    name: 'Midnight', dark: true, ...DARK_PANEL,
    bg: ['#120A36', '#2A0F68', '#521A86'], glow: ['#FF4FB8', '#7C5CFF', '#22D3EE'],
    ink: '#FFFFFF', soft: 'rgba(255,255,255,0.74)', accent: '#FFD27A', foil: FOIL.gold,
    motif: ['#FF4FB8', '#22D3EE', '#FFC94A', '#8B6CFF', '#FF7A59'],
  },
  wine: {
    name: 'Merlot', dark: true, ...DARK_PANEL,
    bg: ['#1C040B', '#46091D', '#6E1230'], glow: ['#C2335C', '#E8B04B', '#7A1535'],
    ink: '#FFF4E8', soft: 'rgba(255,244,232,0.74)', accent: '#F3D27A', foil: FOIL.gold,
    motif: ['#F3D27A', '#FFFFFF', '#E7A1B0', '#C2335C'],
  },
  pearl: {
    name: 'Pearl', dark: false, ...LIGHT_PANEL,
    bg: ['#FFFDF8', '#F8F0E3', '#EEDFC6'], glow: ['#F2D9A6', '#FFFFFF', '#E6CFAF'],
    ink: '#2B2118', soft: 'rgba(43,33,24,0.66)', accent: '#A67C2E', foil: FOIL.deepGold,
    motif: ['#C9A04A', '#FFFFFF', '#E9D2B0', '#8C6420'],
  },
  blush: {
    name: 'Blush', dark: false, ...LIGHT_PANEL,
    bg: ['#FFF3F6', '#FFD6E0', '#FFB5C7'], glow: ['#FF8FAB', '#FFE3BD', '#FF6B93'],
    ink: '#4A0D26', soft: 'rgba(74,13,38,0.68)', accent: '#D6245B', foil: FOIL.rose,
    motif: ['#E0245E', '#FF6B93', '#FFFFFF', '#FF9EB5', '#B0123F'],
  },
  emerald: {
    name: 'Emerald', dark: true, ...DARK_PANEL,
    bg: ['#021A14', '#053A2D', '#0B5D45'], glow: ['#18C58F', '#F5C451', '#0A7A58'],
    ink: '#FFFFFF', soft: 'rgba(255,255,255,0.74)', accent: '#F5D77A', foil: FOIL.gold,
    motif: ['#F5C451', '#FFFFFF', '#34D399', '#FF8A65', '#A7F3D0'],
  },
  terracotta: {
    name: 'Terracotta', dark: false, ...LIGHT_PANEL,
    bg: ['#FFF9F0', '#FBEBD6', '#F3D7B8'], glow: ['#F4A261', '#FFE7C2', '#E76F51'],
    ink: '#3A2416', soft: 'rgba(58,36,22,0.68)', accent: '#C0512F', foil: FOIL.copper,
    motif: ['#6B8F4E', '#A3B18A', '#3F6B3A', '#C0512F', '#E9C46A'],
  },
  mint: {
    name: 'Mint', dark: false, ...LIGHT_PANEL,
    bg: ['#F3FFFA', '#D8F5E9', '#BCEAD6'], glow: ['#7FE0B8', '#FFFFFF', '#FFD3C4'],
    ink: '#073B2C', soft: 'rgba(7,59,44,0.68)', accent: '#0E8F66', foil: FOIL.jade,
    motif: ['#2F9E6E', '#7CC9A2', '#1E6B4C', '#FF9F87', '#FFD166'],
  },
  festive: {
    name: 'Festive', dark: true, ...DARK_PANEL,
    bg: ['#3A040C', '#850C1B', '#B3121F'], glow: ['#FF5A5F', '#FFD166', '#5C0710'],
    ink: '#FFF8F0', soft: 'rgba(255,248,240,0.76)', accent: '#FFD98A', foil: FOIL.gold,
    motif: ['#FFD166', '#0F7A4F', '#FFFFFF', '#F25C54', '#1FA06A'],
  },
  nightteal: {
    name: 'Night teal', dark: true, ...DARK_PANEL,
    bg: ['#021720', '#063244', '#0E4C5E'], glow: ['#2EC4B6', '#F7D774', '#0B7285'],
    ink: '#FFFFFF', soft: 'rgba(255,255,255,0.74)', accent: '#F7D774', foil: FOIL.gold,
    motif: ['#F7D774', '#2EC4B6', '#FFFFFF', '#FFB86B'],
  },
  sky: {
    name: 'Sky', dark: false, ...LIGHT_PANEL,
    bg: ['#F1F7FF', '#DCEBFF', '#E8E0FF'], glow: ['#7CC4FF', '#B69CFF', '#FFC9E0'],
    ink: '#0B2A55', soft: 'rgba(11,42,85,0.66)', accent: '#1F77F1', foil: FOIL.azure,
    motif: ['#1F77F1', '#7C5CFF', '#FF7AB6', '#34D1BF', '#FFB020'],
  },
  azure: {
    name: 'Blorbmart blue', dark: true, ...DARK_PANEL,
    bg: ['#051C45', '#0B3E86', '#1F77F1'], glow: ['#3D8BF5', '#5EEAD4', '#A78BFA'],
    ink: '#FFFFFF', soft: 'rgba(255,255,255,0.76)', accent: '#AFE3FF', foil: FOIL.gold,
    motif: ['#FFB020', '#FF5A1F', '#5EEAD4', '#FFFFFF', '#A78BFA'],
  },
  noir: {
    name: 'Noir', dark: true, ...DARK_PANEL,
    bg: ['#040406', '#101017', '#1C1C26'], glow: ['#3A3A4A', '#D4AF37', '#232332'],
    ink: '#F5F1E8', soft: 'rgba(245,241,232,0.70)', accent: '#E6C872', foil: FOIL.gold,
    motif: ['#D4AF37', '#F5F1E8', '#8C8C99', '#E6C872'],
  },
  sunset: {
    name: 'Sunset', dark: true, ...DARK_PANEL,
    bg: ['#2E0838', '#A02C5E', '#FF7A3D'], glow: ['#FFB020', '#FF4F79', '#7C3AED'],
    ink: '#FFFFFF', soft: 'rgba(255,255,255,0.78)', accent: '#FFE29A', foil: FOIL.gold,
    motif: ['#FFE29A', '#FFFFFF', '#FF4F79', '#FFB020', '#8B5CF6'],
  },
};

const MOTIFS = {
  balloons: 'Balloons',
  rings: 'Rings',
  hearts: 'Hearts',
  burst: 'Fireworks',
  botanical: 'Botanical',
  ornaments: 'Ornaments',
  crescent: 'Crescent',
  waves: 'Waves',
  gift: 'Gift box',
};

const TYPES = { serif: 'Classic', script: 'Script', bold: 'Bold' };

const THEMES = [
  { id: 'birthday', name: 'Birthday', headline: 'Happy Birthday', palette: 'midnight', motif: 'balloons', type: 'serif', blurb: 'Balloons, confetti and a little gold.' },
  { id: 'anniversary', name: 'Anniversary', headline: 'Happy Anniversary', palette: 'wine', motif: 'rings', type: 'script', blurb: 'Two gold rings on deep merlot.' },
  { id: 'wedding', name: 'Wedding', headline: 'Happy Married Life', palette: 'pearl', motif: 'rings', type: 'script', blurb: 'Pearl, gold and a diamond.' },
  { id: 'love', name: 'Love', headline: 'With Love', palette: 'blush', motif: 'hearts', type: 'script', blurb: 'For the one who has your heart.' },
  { id: 'congrats', name: 'Congratulations', headline: 'Congratulations', palette: 'emerald', motif: 'burst', type: 'serif', blurb: 'Fireworks for the big win.' },
  { id: 'thanks', name: 'Thank you', headline: 'Thank You', palette: 'terracotta', motif: 'botanical', type: 'serif', blurb: 'Warm, grateful and green.' },
  { id: 'getwell', name: 'Get well', headline: 'Get Well Soon', palette: 'mint', motif: 'botanical', type: 'serif', blurb: 'Fresh leaves and soft light.' },
  { id: 'christmas', name: 'Christmas', headline: 'Merry Christmas', palette: 'festive', motif: 'ornaments', type: 'script', blurb: 'Baubles, snow and gold.' },
  { id: 'eid', name: 'Eid & Sallah', headline: 'Eid Mubarak', palette: 'nightteal', motif: 'crescent', type: 'serif', blurb: 'Crescent moon and lanterns.' },
  { id: 'justbecause', name: 'Just because', headline: 'Just Because', palette: 'sky', motif: 'waves', type: 'bold', blurb: 'No reason needed.' },
  { id: 'custom', name: 'Make your own', headline: 'A Gift For You', palette: 'azure', motif: 'gift', type: 'serif', blurb: 'Your words, your colours.', custom: true },
];

const THEME_BY_ID = {};
for (const theme of THEMES) THEME_BY_ID[theme.id] = theme;

/* ── Text ─────────────────────────────────────────────────────────────── */

const DISALLOWED = /[^\p{Script=Latin}\p{M}\p{N}\p{Zs}.,!?'’‘"“”&@#%*()\-–—:;/+₦]/gu;

/**
 * What survives of something a customer typed: Latin letters (with any
 * accents), digits, spaces and ordinary punctuation, at most `max`
 * characters. Emoji and other scripts are dropped because the card fonts
 * cannot draw them — a preview that shows them and a PNG that prints boxes
 * would be worse than neither.
 */
function cleanText(value, max) {
  let text = String(value == null ? '' : value).normalize('NFC');
  text = text.replace(/[\r\n\t]+/g, ' ').replace(DISALLOWED, '');
  text = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(text);
  if (max && chars.length > max) text = chars.slice(0, max).join('').trim();
  return text;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const COMBINING = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/;

function charWidth(font, ch) {
  if (font === 'mono') return 600;
  const table = WIDTHS[font];
  const code = ch.charCodeAt(0);
  if (code >= 32 && code < 127) return table[code - 32];
  if (COMBINING.test(ch)) return 0;
  if (ch === '₦') return table[78 - 32];
  if (ch === '’' || ch === '‘') return table[39 - 32];
  if (ch === '“' || ch === '”') return table[34 - 32];
  if (ch === '—') return 1000;
  if (ch === '–') return 560;
  const base = ch.normalize('NFD').charAt(0);
  const baseCode = base.charCodeAt(0);
  if (base !== ch && baseCode >= 32 && baseCode < 127) return table[baseCode - 32];
  return AVERAGE[font];
}

/** Width of `text` in user units, at `size`, with `tracking` between letters. */
function measure(text, font, size, tracking = 0) {
  let units = 0;
  let count = 0;
  for (const ch of text) {
    units += charWidth(font, ch);
    count += 1;
  }
  return (units / 1000) * size + tracking * Math.max(0, count - 1);
}

/** Greedy word wrap. A word longer than a whole line is broken inside. */
function wrap(text, font, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const attempt = line ? `${line} ${word}` : word;
    if (measure(attempt, font, size) <= maxWidth) {
      line = attempt;
      continue;
    }
    if (line) lines.push(line);
    if (measure(word, font, size) <= maxWidth) {
      line = word;
      continue;
    }
    let piece = '';
    for (const ch of word) {
      if (measure(piece + ch, font, size) > maxWidth && piece) {
        lines.push(piece);
        piece = ch;
      } else {
        piece += ch;
      }
    }
    line = piece;
  }
  if (line) lines.push(line);
  return lines;
}

/* ── Small helpers ────────────────────────────────────────────────────── */

const f1 = (n) => Math.round(n * 10) / 10;

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded generator, so a design scatters the same way everywhere. */
function seeded(seed) {
  let a = hashString(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function mix(a, b, t) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const rad = (deg) => (deg * Math.PI) / 180;
const polar = (cx, cy, r, deg) => [f1(cx + r * Math.cos(rad(deg))), f1(cy + r * Math.sin(rad(deg)))];

function formatAmount(amount) {
  const whole = Math.max(0, Math.round(Number(amount) || 0));
  return `₦${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "26 Sep 2027", on Lagos time, whichever timezone renders it. */
function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const lagos = new Date(date.getTime() + 60 * 60 * 1000);
  return `${lagos.getUTCDate()} ${MONTHS[lagos.getUTCMonth()]} ${lagos.getUTCFullYear()}`;
}

/**
 * The design a request asked for, reduced to values from the catalogues.
 * Anything unknown falls back to the occasion's own choice, so a stale app
 * sending a motif that has since been renamed still gets a good card.
 */
function resolveDesign(input) {
  const source = input || {};
  const theme = THEME_BY_ID[source.theme] || THEME_BY_ID.birthday;
  return {
    theme: theme.id,
    palette: PALETTES[source.palette] ? source.palette : theme.palette,
    motif: MOTIFS[source.motif] ? source.motif : theme.motif,
    type: TYPES[source.type] ? source.type : theme.type,
    headline: cleanText(source.headline, LIMITS.headline) || theme.headline,
  };
}

/* ── Shapes ───────────────────────────────────────────────────────────── */

function sparkle(x, y, s, fill, opacity = 1) {
  const q = s * 0.12;
  return `<path d="M${f1(x)} ${f1(y - s)} Q${f1(x + q)} ${f1(y - q)} ${f1(x + s)} ${f1(y)} Q${f1(x + q)} ${f1(y + q)} ${f1(x)} ${f1(y + s)} Q${f1(x - q)} ${f1(y + q)} ${f1(x - s)} ${f1(y)} Q${f1(x - q)} ${f1(y - q)} ${f1(x)} ${f1(y - s)}Z" fill="${fill}" opacity="${opacity}"/>`;
}

function starPath(cx, cy, outer, inner, points = 5, turn = -90) {
  const parts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const [x, y] = polar(cx, cy, r, turn + (i * 180) / points);
    parts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
  }
  return `${parts.join(' ')}Z`;
}

/** A heart `s` wide, centred on (cx, cy), turned `deg` degrees. */
function heartPath(cx, cy, s, deg = 0) {
  const pts = [
    [0, 0.36], [-0.08, 0.3], [-0.5, 0.04], [-0.5, -0.22], [-0.5, -0.42], [-0.36, -0.56], [-0.2, -0.56],
    [-0.1, -0.56], [-0.03, -0.5], [0, -0.42], [0.03, -0.5], [0.1, -0.56], [0.2, -0.56],
    [0.36, -0.56], [0.5, -0.42], [0.5, -0.22], [0.5, 0.04], [0.08, 0.3], [0, 0.36],
  ];
  const cos = Math.cos(rad(deg));
  const sin = Math.sin(rad(deg));
  const t = ([x, y]) => `${f1(cx + (x * cos - y * sin) * s)} ${f1(cy + (x * sin + y * cos) * s)}`;
  let d = `M${t(pts[0])}`;
  for (let i = 1; i < pts.length; i += 3) d += ` C${t(pts[i])} ${t(pts[i + 1])} ${t(pts[i + 2])}`;
  return `${d}Z`;
}

/** Where the words sit. Motifs keep their busiest parts out of it. */
const TEXT_ZONE = { x0: 70, x1: 930, y0: 190, y1: 790 };

function inTextZone(x, y, pad = 0) {
  return x > TEXT_ZONE.x0 - pad && x < TEXT_ZONE.x1 + pad && y > TEXT_ZONE.y0 - pad && y < TEXT_ZONE.y1 + pad;
}

/**
 * Places nothing scattered may land on: the words, the logo, the value in
 * the corner and the code panel. Those are what a person reads, and a piece
 * of confetti on a digit is a support ticket.
 */
function isReserved(x, y, pad = 0) {
  return (
    inTextZone(x, y, pad) ||
    (x < 620 + pad && y < 170 + pad) ||
    (x > 1110 - pad && y < 180 + pad) ||
    y > 780 - pad
  );
}

/** Confetti scattered over the card, clear of everything that has to be read. */
function confetti(ctx, count, colors) {
  const { rng } = ctx;
  const out = [];
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < count * 20) {
    const x = 30 + rng() * (CARD_W - 60);
    const y = 30 + rng() * 760;
    if (isReserved(x, y, 14)) continue;
    const c = colors[Math.floor(rng() * colors.length)];
    const a = Math.round(rng() * 360);
    const kind = rng();
    const op = f1(0.55 + rng() * 0.45);
    if (kind < 0.42) {
      const w = 7 + rng() * 6;
      const h = 16 + rng() * 12;
      out.push(`<rect x="${f1(-w / 2)}" y="${f1(-h / 2)}" width="${f1(w)}" height="${f1(h)}" rx="2" fill="${c}" opacity="${op}" transform="translate(${f1(x)} ${f1(y)}) rotate(${a})"/>`);
    } else if (kind < 0.66) {
      out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(3.5 + rng() * 4)}" fill="${c}" opacity="${op}"/>`);
    } else if (kind < 0.88) {
      out.push(`<path d="M-14 0 q3.5 -8 7 0 t7 0 t7 0 t7 0" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity="${op}" transform="translate(${f1(x)} ${f1(y)}) rotate(${a})"/>`);
    } else {
      out.push(sparkle(x, y, 9 + rng() * 9, c, op));
    }
    placed += 1;
  }
  return out.join('');
}

/* ── Motifs ───────────────────────────────────────────────────────────── */

function balloon(ctx, x, y, r, color, tilt) {
  const gid = ctx.id(`balloon${ctx.serial++}`);
  ctx.defs.push(
    `<radialGradient id="${gid}" cx="0.34" cy="0.3" r="0.78"><stop offset="0" stop-color="${mix(color, '#FFFFFF', 0.6)}"/><stop offset="0.42" stop-color="${color}"/><stop offset="1" stop-color="${mix(color, '#000000', 0.38)}"/></radialGradient>`
  );
  const ry = r * 1.2;
  const body = `M${f1(x)} ${f1(y - ry)} C${f1(x + r * 1.08)} ${f1(y - ry)} ${f1(x + r * 1.04)} ${f1(y + ry * 0.56)} ${f1(x)} ${f1(y + ry)} C${f1(x - r * 1.04)} ${f1(y + ry * 0.56)} ${f1(x - r * 1.08)} ${f1(y - ry)} ${f1(x)} ${f1(y - ry)}Z`;
  const knotY = y + ry;
  return `<g transform="rotate(${tilt} ${f1(x)} ${f1(knotY)})">
<path d="${body}" fill="url(#${gid})"/>
<path d="M${f1(x - 10)} ${f1(knotY + 13)} L${f1(x + 10)} ${f1(knotY + 13)} L${f1(x)} ${f1(knotY - 3)}Z" fill="${mix(color, '#000000', 0.3)}"/>
<ellipse cx="${f1(x - r * 0.4)}" cy="${f1(y - ry * 0.42)}" rx="${f1(r * 0.15)}" ry="${f1(r * 0.3)}" fill="#FFFFFF" opacity="0.5" transform="rotate(28 ${f1(x - r * 0.4)} ${f1(y - ry * 0.42)})"/>
<circle cx="${f1(x - r * 0.18)}" cy="${f1(y - ry * 0.72)}" r="${f1(r * 0.05)}" fill="#FFFFFF" opacity="0.6"/>
</g>`;
}

const motifBalloons = (ctx) => {
  const { p } = ctx;
  const m = p.motif;
  const set = [
    [1052, 600, 70, m[4 % m.length], -12],
    [1478, 520, 92, m[2 % m.length], 12],
    [1150, 386, 104, m[1 % m.length], -10],
    [1378, 298, 118, m[0], 8],
    [1268, 528, 96, m[3 % m.length], -3],
  ];
  // The strings gather into one knot above the code panel, tied with a bow,
  // as if somebody is holding the bunch out.
  const [gx, gy] = [1262, 752];
  const strings = set
    .map(([x, y, r], i) => {
      const k = y + r * 1.2 + 13;
      const sway = i % 2 ? 18 : -16;
      return `<path d="M${x} ${f1(k)} C${x + sway} ${f1(k + (gy - k) * 0.45)} ${f1((x + gx) / 2 - sway)} ${f1(gy - 30)} ${gx} ${gy}" fill="none" stroke="${p.ink}" stroke-opacity="0.45" stroke-width="2.4"/>`;
    })
    .join('');
  const bowColour = p.foil[1];
  const bow = `<path d="M${gx} ${gy} C${gx - 34} ${gy - 26} ${gx - 46} ${gy + 4} ${gx - 36} ${gy + 12} C${gx - 26} ${gy + 20} ${gx - 10} ${gy + 8} ${gx} ${gy}Z" fill="${bowColour}"/>
<path d="M${gx} ${gy} C${gx + 34} ${gy - 26} ${gx + 46} ${gy + 4} ${gx + 36} ${gy + 12} C${gx + 26} ${gy + 20} ${gx + 10} ${gy + 8} ${gx} ${gy}Z" fill="${bowColour}"/>
<path d="M${gx - 3} ${gy + 2} L${gx - 16} ${gy + 26} M${gx + 3} ${gy + 2} L${gx + 14} ${gy + 24}" stroke="${bowColour}" stroke-width="4" stroke-linecap="round"/>
<circle cx="${gx}" cy="${gy}" r="7" fill="${p.foil[3]}"/>`;
  return `${confetti(ctx, 46, [...m, p.foil[1]])}${strings}${bow}${set.map(([x, y, r, c, t]) => balloon(ctx, x, y, r, c, t)).join('')}${sparkle(1548, 250, 22, p.accent, 0.9)}${sparkle(1010, 220, 16, p.accent, 0.8)}`;
};

function ringArc(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

const motifRings = (ctx) => {
  const { p, id } = ctx;
  const foilId = id('ringfoil');
  ctx.defs.push(
    `<linearGradient id="${foilId}" x1="0" y1="0" x2="1" y2="1">${p.foil.map((c, i) => `<stop offset="${i / (p.foil.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`
  );
  const cx = 1250;
  const cy = 470;
  const rays = [];
  for (let i = 0; i < 48; i++) {
    const [x0, y0] = polar(cx, cy, 150, i * 7.5);
    const [x1, y1] = polar(cx, cy, 640, i * 7.5);
    rays.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${p.accent}" stroke-opacity="${i % 2 ? 0.1 : 0.05}" stroke-width="2"/>`);
  }
  const rings = [
    [1178, 488],
    [1322, 446],
  ];
  const R = 118;
  const ring = (x, y, a0, a1) => {
    const full = a0 === undefined;
    const d = (r) => (full ? `M${f1(x - r)} ${y} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0` : ringArc(x, y, r, a0, a1));
    return `<path d="${d(R)}" fill="none" stroke="url(#${foilId})" stroke-width="26" stroke-linecap="butt"/><path d="${d(R - 8)}" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="3"/><path d="${d(R + 11)}" fill="none" stroke="#000000" stroke-opacity="0.16" stroke-width="2"/>`;
  };
  // Where the first ring passes back over the second, so they interlock.
  const [ax, ay] = rings[0];
  const [bx, by] = rings[1];
  const toward = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  const half = (Math.acos(Math.hypot(bx - ax, by - ay) / 2 / R) * 180) / Math.PI;
  const cross = toward - half;
  const gemX = bx;
  const gemY = by - R - 30;
  const gem = `<g>
<path d="M${gemX - 36} ${gemY} L${gemX - 21} ${gemY - 20} L${gemX + 21} ${gemY - 20} L${gemX + 36} ${gemY} L${gemX} ${gemY + 42}Z" fill="#EAF7FF" stroke="#FFFFFF" stroke-width="2"/>
<path d="M${gemX - 36} ${gemY} L${gemX + 36} ${gemY} M${gemX - 21} ${gemY - 20} L${gemX - 10} ${gemY} L${gemX} ${gemY + 42} L${gemX + 10} ${gemY} L${gemX + 21} ${gemY - 20} M${gemX - 10} ${gemY} L${gemX} ${gemY - 20} L${gemX + 10} ${gemY}" fill="none" stroke="#9CCFEA" stroke-width="1.6"/>
<path d="M${gemX - 21} ${gemY - 20} L${gemX - 10} ${gemY} L${gemX - 36} ${gemY}Z" fill="#FFFFFF" opacity="0.8"/>
<rect x="${gemX - 16}" y="${gemY + 20}" width="32" height="14" rx="4" fill="url(#${foilId})"/>
</g>`;
  return `${rays.join('')}
<circle cx="${cx}" cy="${cy}" r="215" fill="none" stroke="${p.accent}" stroke-opacity="0.2" stroke-width="1.5"/>
<circle cx="${cx}" cy="${cy}" r="300" fill="none" stroke="${p.accent}" stroke-opacity="0.34" stroke-width="2" stroke-dasharray="1 12" stroke-linecap="round"/>
<circle cx="${cx}" cy="${cy}" r="420" fill="none" stroke="${p.accent}" stroke-opacity="0.09" stroke-width="1.5"/>
${ring(ax, ay)}${ring(bx, by)}${ring(ax, ay, cross - 16, cross + 16)}${gem}
${sparkle(gemX + 62, gemY - 40, 26, p.dark ? '#FFFFFF' : p.accent, 0.95)}${sparkle(gemX - 58, gemY - 58, 14, p.dark ? '#FFFFFF' : p.accent, 0.8)}
${sparkle(1500, 700, 20, p.accent, 0.8)}${sparkle(1030, 250, 18, p.accent, 0.7)}${sparkle(1480, 180, 12, p.accent, 0.7)}`;
};

const motifHearts = (ctx) => {
  const { p, rng, id } = ctx;
  const gid = id('heartfill');
  const base = p.motif[0];
  ctx.defs.push(
    `<radialGradient id="${gid}" cx="0.36" cy="0.3" r="0.85"><stop offset="0" stop-color="${mix(base, '#FFFFFF', 0.45)}"/><stop offset="0.5" stop-color="${base}"/><stop offset="1" stop-color="${mix(base, '#000000', 0.3)}"/></radialGradient>`
  );
  const small = [];
  let guard = 0;
  while (small.length < 15 && guard++ < 200) {
    const x = 960 + rng() * 620;
    const y = 60 + rng() * 740;
    const s = 30 + rng() * 70;
    if (Math.hypot(x - 1265, y - 450) < 300 || isReserved(x, y, s * 0.55)) continue;
    const deg = Math.round(rng() * 50 - 25);
    const c = p.motif[1 + Math.floor(rng() * (p.motif.length - 1))];
    const op = f1(0.5 + rng() * 0.5);
    small.push(
      rng() < 0.3
        ? `<path d="${heartPath(x, y, s, deg)}" fill="none" stroke="${p.accent}" stroke-width="3" opacity="${op}"/>`
        : `<path d="${heartPath(x, y, s, deg)}" fill="${c}" opacity="${op}"/>`
    );
  }
  return `${small.join('')}
<path d="${heartPath(1265, 470, 590, -8)}" fill="none" stroke="${p.accent}" stroke-opacity="0.5" stroke-width="3" stroke-dasharray="1 13" stroke-linecap="round"/>
<path d="${heartPath(1265, 462, 500, -8)}" fill="url(#${gid})"/>
<path d="${heartPath(1175, 330, 120, -30)}" fill="#FFFFFF" opacity="0.22"/>
<ellipse cx="1128" cy="298" rx="22" ry="44" fill="#FFFFFF" opacity="0.4" transform="rotate(38 1128 298)"/>
${sparkle(1450, 250, 24, '#FFFFFF', 0.95)}${sparkle(1080, 620, 16, '#FFFFFF', 0.85)}${sparkle(1500, 640, 14, p.accent, 0.8)}`;
};

function firework(cx, cy, R, n, colors, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i * 360) / n + (rng() * 6 - 3);
    const r0 = R * 0.24;
    const r1 = R * (0.78 + rng() * 0.22);
    const c = colors[i % colors.length];
    const [x0a, y0a] = polar(cx, cy, r0, a - 0.7);
    const [x0b, y0b] = polar(cx, cy, r0, a + 0.7);
    const [x1a, y1a] = polar(cx, cy, r1, a - 1.6);
    const [x1b, y1b] = polar(cx, cy, r1, a + 1.6);
    const [dx, dy] = polar(cx, cy, r1 + 14, a);
    out.push(`<path d="M${x0a} ${y0a} L${x1a} ${y1a} L${x1b} ${y1b} L${x0b} ${y0b}Z" fill="${c}" opacity="0.92"/><circle cx="${dx}" cy="${dy}" r="${f1(3 + R / 60)}" fill="${c}"/>`);
    if (i % 2 === 0) {
      const [mx, my] = polar(cx, cy, R * 0.52, a + 180 / n);
      out.push(`<circle cx="${mx}" cy="${my}" r="${f1(2 + R / 110)}" fill="${colors[(i + 1) % colors.length]}" opacity="0.8"/>`);
    }
  }
  return out.join('');
}

const motifBurst = (ctx) => {
  const { p, rng } = ctx;
  const colors = [p.foil[1], p.motif[1], p.motif[2 % p.motif.length], p.foil[0]];
  const stars = [];
  let guard = 0;
  while (stars.length < 9 && guard++ < 100) {
    const x = 980 + rng() * 580;
    const y = 90 + rng() * 680;
    const s = 8 + rng() * 14;
    if (isReserved(x, y, s)) continue;
    stars.push(`<path d="${starPath(x, y, s, s * 0.45)}" fill="${colors[stars.length % colors.length]}" opacity="${f1(0.6 + rng() * 0.4)}"/>`);
  }
  return `<circle cx="1262" cy="430" r="290" fill="${p.foil[1]}" opacity="0.08"/>
${firework(1262, 430, 236, 30, colors, rng)}${firework(1478, 668, 118, 20, colors, rng)}${firework(1058, 650, 104, 18, colors, rng)}${firework(1528, 292, 72, 14, colors, rng)}
${stars.join('')}${confetti(ctx, 16, colors)}${sparkle(1262, 430, 30, '#FFFFFF', 0.95)}`;
};

function sprig(ctx, from, c1, c2, to, leaves, scale, colors) {
  const { rng, p } = ctx;
  const at = (t) => {
    const u = 1 - t;
    return [
      u * u * u * from[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * to[0],
      u * u * u * from[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * to[1],
    ];
  };
  const out = [`<path d="M${from[0]} ${from[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${to[0]} ${to[1]}" fill="none" stroke="${colors[2]}" stroke-width="${f1(5 * scale)}" stroke-linecap="round"/>`];
  for (let i = 0; i < leaves; i++) {
    const t = 0.08 + (i / leaves) * 0.9;
    const [x, y] = at(t);
    const [nx, ny] = at(Math.min(1, t + 0.01));
    const heading = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
    const side = i % 2 ? 1 : -1;
    const L = (120 - t * 60) * scale * (0.85 + rng() * 0.3);
    const deg = heading + side * (48 + rng() * 14);
    const c = colors[i % 2];
    out.push(
      `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(deg)})"><path d="M0 0 C${f1(L * 0.3)} ${f1(-L * 0.34)} ${f1(L * 0.76)} ${f1(-L * 0.3)} ${f1(L)} 0 C${f1(L * 0.76)} ${f1(L * 0.3)} ${f1(L * 0.3)} ${f1(L * 0.34)} 0 0Z" fill="${c}"/><path d="M4 0 L${f1(L * 0.9)} 0" stroke="${p.dark ? '#000000' : '#FFFFFF'}" stroke-opacity="0.28" stroke-width="2" stroke-linecap="round"/></g>`
    );
  }
  const [tx, ty] = to;
  out.push(`<g transform="translate(${tx} ${ty}) rotate(-30)"><path d="M0 0 C${f1(26 * scale)} ${f1(-18 * scale)} ${f1(52 * scale)} ${f1(-12 * scale)} ${f1(64 * scale)} 0 C${f1(52 * scale)} ${f1(12 * scale)} ${f1(26 * scale)} ${f1(18 * scale)} 0 0Z" fill="${colors[0]}"/></g>`);
  return out.join('');
}

function flower(x, y, r, petal, centre) {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const [px, py] = polar(x, y, r * 0.62, i * 72 - 90);
    petals.push(`<circle cx="${px}" cy="${py}" r="${f1(r * 0.5)}" fill="${petal}"/>`);
  }
  return `${petals.join('')}<circle cx="${x}" cy="${y}" r="${f1(r * 0.36)}" fill="${centre}"/>`;
}

const motifBotanical = (ctx) => {
  const { p } = ctx;
  const m = p.motif;
  const leaves = [m[0], m[1], m[2]];
  return `<path d="M1040 900 L1040 440 A200 200 0 0 1 1440 440 L1440 900Z" fill="${p.glow[0]}" opacity="${p.dark ? 0.35 : 0.55}"/>
<path d="M1080 900 L1080 450 A160 160 0 0 1 1400 450 L1400 900" fill="none" stroke="${p.accent}" stroke-opacity="0.35" stroke-width="2"/>
<circle cx="1240" cy="420" r="70" fill="${m[4 % m.length]}" opacity="0.85"/>
${sprig(ctx, [1540, 820], [1360, 720], [1120, 600], [1010, 250], 13, 1, leaves)}
${sprig(ctx, [1610, 230], [1540, 320], [1480, 420], [1330, 560], 7, 0.8, [m[1], m[0], m[2]])}
${flower(1470, 620, 34, m[3 % m.length], m[4 % m.length])}${flower(1150, 520, 26, m[3 % m.length], m[4 % m.length])}${flower(1545, 300, 22, '#FFFFFF', m[3 % m.length])}
<circle cx="1210" cy="700" r="9" fill="${m[3 % m.length]}"/><circle cx="1228" cy="716" r="7" fill="${m[3 % m.length]}"/><circle cx="1200" cy="722" r="6" fill="${m[3 % m.length]}"/>
${sparkle(1560, 520, 16, p.accent, 0.7)}${sparkle(1050, 180, 14, p.accent, 0.6)}`;
};

function snowflake(x, y, s, color, opacity) {
  const arms = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 60 - 90;
    const [ex, ey] = polar(x, y, s, a);
    const [bx, by] = polar(x, y, s * 0.55, a);
    const [l1x, l1y] = polar(bx, by, s * 0.3, a - 45);
    const [r1x, r1y] = polar(bx, by, s * 0.3, a + 45);
    arms.push(`M${f1(x)} ${f1(y)} L${ex} ${ey} M${bx} ${by} L${l1x} ${l1y} M${bx} ${by} L${r1x} ${r1y}`);
  }
  return `<path d="${arms.join(' ')}" fill="none" stroke="${color}" stroke-width="${f1(Math.max(2, s / 12))}" stroke-linecap="round" opacity="${opacity}"/>`;
}

function bauble(ctx, x, y, r, color, style) {
  const { p, id } = ctx;
  const gid = id(`bauble${ctx.serial}`);
  const cid = id(`baubleclip${ctx.serial++}`);
  ctx.defs.push(
    `<radialGradient id="${gid}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${mix(color, '#FFFFFF', 0.55)}"/><stop offset="0.45" stop-color="${color}"/><stop offset="1" stop-color="${mix(color, '#000000', 0.42)}"/></radialGradient><clipPath id="${cid}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>`
  );
  const band = p.foil[0];
  let deco = '';
  if (style === 0) {
    deco = `<path d="M${x - r} ${f1(y - r * 0.2)} Q${x} ${f1(y - r * 0.02)} ${x + r} ${f1(y - r * 0.2)}" fill="none" stroke="${band}" stroke-width="${f1(r * 0.12)}"/><path d="M${x - r} ${f1(y + r * 0.22)} Q${x} ${f1(y + r * 0.4)} ${x + r} ${f1(y + r * 0.22)}" fill="none" stroke="${band}" stroke-width="${f1(r * 0.06)}"/>`;
  } else if (style === 1) {
    const dots = [];
    for (let i = -3; i <= 3; i++) dots.push(`<circle cx="${f1(x + i * r * 0.3)}" cy="${f1(y + r * 0.05 + Math.abs(i) * r * 0.025)}" r="${f1(r * 0.07)}" fill="${band}"/>`);
    deco = dots.join('');
  } else {
    let z = `M${x - r} ${y}`;
    for (let i = 0; i < 8; i++) z += ` L${f1(x - r + (i + 0.5) * (r / 4))} ${f1(y + (i % 2 ? 1 : -1) * r * 0.14)}`;
    deco = `<path d="${z} L${x + r} ${y}" fill="none" stroke="${band}" stroke-width="${f1(r * 0.07)}" stroke-linejoin="round"/>`;
  }
  return `<line x1="${x}" y1="${f1(ctx.hangFrom ? ctx.hangFrom(x) : 0)}" x2="${x}" y2="${f1(y - r - 16)}" stroke="${p.foil[0]}" stroke-opacity="0.75" stroke-width="2"/>
<circle cx="${x}" cy="${f1(y - r - 22)}" r="7" fill="none" stroke="${p.foil[1]}" stroke-width="3"/>
<rect x="${x - 15}" y="${f1(y - r - 18)}" width="30" height="22" rx="4" fill="${p.foil[1]}"/>
<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${gid})"/>
<g clip-path="url(#${cid})">${deco}</g>
<ellipse cx="${f1(x - r * 0.38)}" cy="${f1(y - r * 0.4)}" rx="${f1(r * 0.16)}" ry="${f1(r * 0.28)}" fill="#FFFFFF" opacity="0.5" transform="rotate(35 ${f1(x - r * 0.38)} ${f1(y - r * 0.4)})"/>`;
}

const motifOrnaments = (ctx) => {
  const { p, rng } = ctx;
  const m = p.motif;
  const flakes = [];
  let guard = 0;
  while (flakes.length < 9 && guard++ < 120) {
    const x = 980 + rng() * 600;
    const y = 240 + rng() * 540;
    const s = 14 + rng() * 22;
    if (isReserved(x, y, s)) continue;
    flakes.push(snowflake(x, y, s, '#FFFFFF', f1(0.35 + rng() * 0.45)));
  }
  const snow = [];
  guard = 0;
  while (snow.length < 60 && guard++ < 600) {
    const x = rng() * CARD_W;
    const y = rng() * CARD_H;
    if (isReserved(x, y, 6)) continue;
    snow.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(1.5 + rng() * 3.5)}" fill="#FFFFFF" opacity="${f1(0.15 + rng() * 0.5)}"/>`);
  }

  // A garland swagged across under the value; the baubles hang from it.
  const g0 = [960, 196];
  const gc = [1290, 330];
  const g1 = [1640, 188];
  const onGarland = (t) => [
    (1 - t) * (1 - t) * g0[0] + 2 * (1 - t) * t * gc[0] + t * t * g1[0],
    (1 - t) * (1 - t) * g0[1] + 2 * (1 - t) * t * gc[1] + t * t * g1[1],
  ];
  ctx.hangFrom = (x) => {
    let best = 0;
    for (let t = 0; t <= 1; t += 0.005) {
      if (Math.abs(onGarland(t)[0] - x) < Math.abs(onGarland(best)[0] - x)) best = t;
    }
    return onGarland(best)[1];
  };
  const garlandD = `M${g0[0]} ${g0[1]} Q${gc[0]} ${gc[1]} ${g1[0]} ${g1[1]}`;
  const beads = [];
  for (let t = 0.03; t < 1; t += 0.045) {
    const [bx, by] = onGarland(t);
    beads.push(`<circle cx="${f1(bx)}" cy="${f1(by)}" r="6" fill="${p.foil[1]}"/>`);
  }
  const garland = `<path d="${garlandD}" fill="none" stroke="${mix(m[1], '#000000', 0.25)}" stroke-width="22" stroke-linecap="round"/>
<path d="${garlandD}" fill="none" stroke="${m[1]}" stroke-width="14" stroke-dasharray="3 9" stroke-linecap="round"/>
<path d="${garlandD}" fill="none" stroke="${m[4 % m.length]}" stroke-width="6" stroke-dasharray="2 16" stroke-dashoffset="6" stroke-linecap="round"/>${beads.join('')}`;

  const baubles = [
    bauble(ctx, 1072, 350, 58, m[0], 1),
    bauble(ctx, 1405, 432, 70, m[3 % m.length], 2),
    bauble(ctx, 1238, 468, 90, m[1], 0),
    bauble(ctx, 1532, 356, 58, m[0], 0),
    bauble(ctx, 1150, 590, 46, m[4 % m.length], 1),
  ];
  delete ctx.hangFrom;
  return `${snow.join('')}${flakes.join('')}${baubles.join('')}${garland}
${sparkle(1320, 640, 20, p.foil[0], 0.9)}${sparkle(1560, 560, 16, p.foil[0], 0.8)}`;
};

function lantern(ctx, x, top, s) {
  const { p, id } = ctx;
  const gid = id(`lantern${ctx.serial}`);
  const hid = id(`lanternglow${ctx.serial++}`);
  ctx.defs.push(
    `<radialGradient id="${gid}" cx="0.5" cy="0.55" r="0.6"><stop offset="0" stop-color="#FFF6D5"/><stop offset="0.55" stop-color="${p.accent}"/><stop offset="1" stop-color="${mix(p.accent, '#7A4A00', 0.45)}"/></radialGradient><radialGradient id="${hid}"><stop offset="0" stop-color="${p.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient>`
  );
  const y = top;
  const w = s * 0.5;
  const body = `M${f1(x - w)} ${f1(y)} L${f1(x + w)} ${f1(y)} L${f1(x + s * 0.64)} ${f1(y + s * 0.4)} L${f1(x + w)} ${f1(y + s * 1.12)} L${f1(x - w)} ${f1(y + s * 1.12)} L${f1(x - s * 0.64)} ${f1(y + s * 0.4)}Z`;
  return `<circle cx="${x}" cy="${f1(y + s * 0.55)}" r="${f1(s * 1.5)}" fill="url(#${hid})"/>
<line x1="${x}" y1="0" x2="${x}" y2="${f1(y - s * 0.34)}" stroke="${p.foil[0]}" stroke-opacity="0.7" stroke-width="2"/>
<circle cx="${x}" cy="${f1(y - s * 0.4)}" r="${f1(s * 0.07)}" fill="none" stroke="${p.foil[1]}" stroke-width="3"/>
<path d="M${f1(x - s * 0.2)} ${f1(y - s * 0.3)} L${f1(x + s * 0.2)} ${f1(y - s * 0.3)} L${f1(x + w + 6)} ${f1(y)} L${f1(x - w - 6)} ${f1(y)}Z" fill="${p.foil[1]}"/>
<path d="${body}" fill="url(#${gid})" stroke="${p.foil[1]}" stroke-width="5" stroke-linejoin="round"/>
<path d="M${x} ${f1(y)} L${x} ${f1(y + s * 1.12)} M${f1(x - s * 0.28)} ${f1(y + 2)} L${f1(x - s * 0.34)} ${f1(y + s * 0.4)} L${f1(x - s * 0.28)} ${f1(y + s * 1.1)} M${f1(x + s * 0.28)} ${f1(y + 2)} L${f1(x + s * 0.34)} ${f1(y + s * 0.4)} L${f1(x + s * 0.28)} ${f1(y + s * 1.1)}" fill="none" stroke="${p.foil[3]}" stroke-width="2.4" opacity="0.8"/>
<path d="M${f1(x - w - 4)} ${f1(y + s * 1.12)} L${f1(x + w + 4)} ${f1(y + s * 1.12)} L${f1(x + s * 0.16)} ${f1(y + s * 1.3)} L${f1(x - s * 0.16)} ${f1(y + s * 1.3)}Z" fill="${p.foil[1]}"/>
<circle cx="${x}" cy="${f1(y + s * 1.38)}" r="${f1(s * 0.06)}" fill="${p.foil[1]}"/>`;
}

const motifCrescent = (ctx) => {
  const { p, id } = ctx;
  const foilId = id('moonfoil');
  const maskId = id('moonmask');
  const fadeId = id('patternfade');
  const fadeMask = id('patternmask');
  const glowId = id('moonglow');
  ctx.defs.push(
    `<linearGradient id="${foilId}" x1="0" y1="0" x2="1" y2="1">${p.foil.map((c, i) => `<stop offset="${i / (p.foil.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`,
    `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${CARD_W}" height="${CARD_H}"><rect width="${CARD_W}" height="${CARD_H}" fill="#000000"/><circle cx="1290" cy="410" r="185" fill="#FFFFFF"/><circle cx="1368" cy="352" r="165" fill="#000000"/></mask>`,
    `<linearGradient id="${fadeId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0.45" stop-color="#000000"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>`,
    `<mask id="${fadeMask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${CARD_W}" height="${CARD_H}"><rect width="${CARD_W}" height="${CARD_H}" fill="url(#${fadeId})"/></mask>`,
    `<radialGradient id="${glowId}"><stop offset="0" stop-color="${p.accent}" stop-opacity="0.32"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient>`
  );
  const tiles = [];
  for (let gx = 700; gx < CARD_W + 60; gx += 110) {
    for (let gy = 0; gy < CARD_H + 60; gy += 110) {
      const s = 34;
      tiles.push(`M${gx - s} ${gy - s}h${s * 2}v${s * 2}h${-s * 2}Z`);
      const d = s * 1.414;
      tiles.push(`M${gx} ${f1(gy - d)}L${f1(gx + d)} ${gy}L${gx} ${f1(gy + d)}L${f1(gx - d)} ${gy}Z`);
    }
  }
  return `<g mask="url(#${fadeMask})"><path d="${tiles.join('')}" fill="none" stroke="${p.accent}" stroke-opacity="0.13" stroke-width="1.6"/></g>
<circle cx="1290" cy="410" r="330" fill="url(#${glowId})"/>
<rect width="${CARD_W}" height="${CARD_H}" fill="url(#${foilId})" mask="url(#${maskId})"/>
<path d="${starPath(1395, 455, 32, 13)}" fill="url(#${foilId})"/>
${lantern(ctx, 1075, 300, 96)}${lantern(ctx, 1532, 520, 76)}
${sparkle(1180, 220, 18, '#FFFFFF', 0.85)}${sparkle(1520, 200, 14, '#FFFFFF', 0.7)}${sparkle(1230, 690, 12, p.accent, 0.8)}${sparkle(1440, 260, 10, '#FFFFFF', 0.7)}`;
};

const motifWaves = (ctx) => {
  const { p, id, rng } = ctx;
  const m = p.motif;
  const out = [];
  const sunId = id('wavesun');
  ctx.defs.push(
    `<radialGradient id="${sunId}" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="${m[4 % m.length]}"/></radialGradient>`
  );
  out.push(`<circle cx="1330" cy="300" r="140" fill="url(#${sunId})" opacity="0.95"/>`);
  for (let b = 0; b < 5; b++) {
    const gid = id(`wave${b}`);
    const c = m[b % m.length];
    ctx.defs.push(
      `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}" stop-opacity="0"/><stop offset="0.35" stop-color="${c}" stop-opacity="0.55"/><stop offset="1" stop-color="${c}" stop-opacity="0.95"/></linearGradient>`
    );
    const base = 430 + b * 78;
    const amp = 38 + b * 6;
    const k = 0.0075 - b * 0.0006;
    const phase = b * 1.3;
    const top = [];
    const bottom = [];
    for (let i = 0; i <= 48; i++) {
      const x = 640 + (i / 48) * 1000;
      const thick = 26 + 22 * Math.sin(i / 7 + b);
      const y = base + amp * Math.sin(k * x + phase);
      top.push(`${f1(x)} ${f1(y)}`);
      bottom.unshift(`${f1(x)} ${f1(y + thick)}`);
    }
    out.push(`<path d="M${top.join(' L')} L${bottom.join(' L')}Z" fill="url(#${gid})"/>`);
  }
  for (let i = 0; i < 8; i++) {
    const x = 1000 + rng() * 560;
    const y = 120 + rng() * 280;
    out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(8 + rng() * 18)}" fill="none" stroke="${m[i % m.length]}" stroke-width="3" opacity="0.6"/>`);
  }
  out.push(sparkle(1490, 180, 22, p.accent, 0.9), sparkle(1150, 220, 14, m[2 % m.length], 0.9), sparkle(1560, 400, 12, m[1], 0.8));
  return out.join('');
};

const motifGift = (ctx) => {
  const { p, id } = ctx;
  const boxId = id('giftbox');
  const lidId = id('giftlid');
  const foilId = id('giftfoil');
  // The box takes whichever palette colour sits furthest from both the gold
  // ribbon and white, so the ribbon always reads against it.
  const distance = (a, b) => {
    const x = hexToRgb(a);
    const y = hexToRgb(b);
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };
  const box = [...p.motif].sort(
    (a, b) =>
      Math.min(distance(b, p.foil[1]), distance(b, '#FFFFFF')) -
      Math.min(distance(a, p.foil[1]), distance(a, '#FFFFFF'))
  )[0];
  ctx.defs.push(
    `<linearGradient id="${boxId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(box, '#FFFFFF', 0.25)}"/><stop offset="1" stop-color="${mix(box, '#000000', 0.25)}"/></linearGradient>`,
    `<linearGradient id="${lidId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(box, '#FFFFFF', 0.4)}"/><stop offset="1" stop-color="${box}"/></linearGradient>`,
    `<linearGradient id="${foilId}" x1="0" y1="0" x2="1" y2="1">${p.foil.map((c, i) => `<stop offset="${i / (p.foil.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`
  );
  const rays = [];
  for (let i = 0; i < 15; i++) {
    const a = -172 + i * 11.7;
    const [x0, y0] = polar(1270, 440, 228, a);
    const [x1, y1] = polar(1270, 440, 262 + (i % 3) * 14, a);
    rays.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${p.accent}" stroke-width="5" stroke-linecap="round" opacity="0.55"/>`);
  }
  const ribbon = `url(#${foilId})`;
  return `${confetti(ctx, 30, [...p.motif, p.foil[1]])}${rays.join('')}
<ellipse cx="1270" cy="770" rx="210" ry="26" fill="#000000" opacity="${p.dark ? 0.25 : 0.1}"/>
<g transform="rotate(-6 1270 600)">
<rect x="1120" y="480" width="300" height="270" rx="16" fill="url(#${boxId})"/>
<rect x="1320" y="480" width="100" height="270" rx="16" fill="#000000" opacity="0.12"/>
<rect x="1100" y="420" width="340" height="80" rx="16" fill="url(#${lidId})"/>
<rect x="1100" y="486" width="340" height="14" fill="#000000" opacity="0.1"/>
<rect x="1248" y="420" width="44" height="330" fill="${ribbon}"/>
<rect x="1120" y="590" width="300" height="36" fill="${ribbon}"/>
<path d="M1270 420 C1200 330 1128 356 1158 404 C1180 440 1238 432 1270 420Z" fill="${ribbon}"/>
<path d="M1270 420 C1340 330 1412 356 1382 404 C1360 440 1302 432 1270 420Z" fill="${ribbon}"/>
<path d="M1270 420 C1215 372 1170 380 1178 402" fill="none" stroke="#000000" stroke-opacity="0.18" stroke-width="3"/>
<path d="M1270 420 C1325 372 1370 380 1362 402" fill="none" stroke="#000000" stroke-opacity="0.18" stroke-width="3"/>
<path d="M1262 424 L1215 520 L1236 512 L1244 536 L1276 430Z" fill="${ribbon}"/>
<path d="M1278 424 L1325 520 L1304 512 L1296 536 L1264 430Z" fill="${ribbon}"/>
<rect x="1248" y="400" width="44" height="38" rx="12" fill="${ribbon}"/>
<rect x="1130" y="430" width="120" height="10" rx="5" fill="#FFFFFF" opacity="0.3"/>
</g>
${sparkle(1470, 330, 22, '#FFFFFF', 0.9)}${sparkle(1080, 380, 16, p.accent, 0.9)}`;
};

const MOTIF_DRAW = {
  balloons: motifBalloons,
  rings: motifRings,
  hearts: motifHearts,
  burst: motifBurst,
  botanical: motifBotanical,
  ornaments: motifOrnaments,
  crescent: motifCrescent,
  waves: motifWaves,
  gift: motifGift,
};

/* ── Headline ─────────────────────────────────────────────────────────── */

const HEADLINE = {
  serif: { font: 'serif', second: 'serifItalic', max: 124, min: 60, lead: 1.02, tracking: -1.5 },
  script: { font: 'script', second: 'script', max: 158, min: 80, lead: 0.9, tracking: 0 },
  bold: { font: 'sans', second: 'sans', max: 118, min: 58, lead: 1.0, tracking: -3 },
};
const HEADLINE_WIDTH = 860;

/**
 * One line when it fits comfortably, otherwise two, split where the lines
 * come out closest in length. Then the size that fits the widest line.
 */
function layoutHeadline(text, type) {
  const spec = HEADLINE[type];
  const words = text.split(' ');
  const widthAt = (line, idx) => measure(line, idx === 0 || words.length === 1 ? spec.font : spec.second, 1, 0);
  let lines = [text];
  const single = measure(text, spec.font, spec.max, spec.tracking);
  if (words.length > 1 && single > HEADLINE_WIDTH * 0.8) {
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' ');
      const b = words.slice(i).join(' ');
      const worst = Math.max(widthAt(a, 0), widthAt(b, 1));
      if (!best || worst < best.worst) best = { worst, lines: [a, b] };
    }
    lines = best.lines;
  }
  let size = spec.max;
  lines.forEach((line, i) => {
    const font = lines.length > 1 && i === 1 ? spec.second : spec.font;
    const w = measure(line, font, 1, 0) + (spec.tracking * Math.max(0, Array.from(line).length - 1)) / spec.max;
    size = Math.min(size, HEADLINE_WIDTH / Math.max(w, 0.01));
  });
  size = Math.max(spec.min, Math.floor(size));
  return { lines, size, spec };
}

/* ── The card ─────────────────────────────────────────────────────────── */

/**
 * Draws a card as an SVG string.
 *
 * @param {object} input
 * @param {object} input.design     theme, palette, motif, type, headline
 * @param {number} input.amount     naira
 * @param {string} [input.code]     the redeemable code; omitted on a preview
 * @param {string} [input.to]       recipient's name
 * @param {string} [input.from]     sender's name
 * @param {string} [input.message]  a short personal note
 * @param {string} [input.expiresAt] ISO date
 * @param {string} [input.qrPath]   SVG path data for a QR, in a 0–`qrSize` box
 * @param {number} [input.qrSize]   modules across the QR
 * @param {string} [input.maskedCode] shown in place of a code the viewer has
 *                                   not unlocked yet, e.g. ••••-••••-••••-H8TC
 * @param {string} [input.note]     replaces the line beside a hidden code
 * @param {string} [input.status]   redeemed | revoked | expired stamp the card
 * @param {string} [input.uid]      prefix for ids, when several cards share a page
 */
function renderGiftCardSvg(input = {}) {
  const design = resolveDesign(input.design);
  const p = PALETTES[design.palette];
  const uid = String(input.uid || 'gc').replace(/[^a-zA-Z0-9_-]/g, '') || 'gc';
  const ctx = {
    p,
    rng: seeded(`${design.theme}|${design.palette}|${design.motif}`),
    id: (name) => `${uid}-${name}`,
    defs: [],
    serial: 0,
  };
  const id = ctx.id;
  const to = cleanText(input.to, LIMITS.name);
  const from = cleanText(input.from, LIMITS.name);
  const message = cleanText(input.message, LIMITS.message);
  const amount = formatAmount(input.amount);
  const code = input.code ? String(input.code).toUpperCase().replace(/[^0-9A-Z-]/g, '') : '';
  const until = formatDate(input.expiresAt);

  const foilStops = p.foil.map((c, i) => `<stop offset="${i / (p.foil.length - 1)}" stop-color="${c}"/>`).join('');
  ctx.defs.push(
    `<clipPath id="${id('clip')}"><rect width="${CARD_W}" height="${CARD_H}" rx="56"/></clipPath>`,
    `<linearGradient id="${id('bg')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg[0]}"/><stop offset="0.55" stop-color="${p.bg[1]}"/><stop offset="1" stop-color="${p.bg[2]}"/></linearGradient>`,
    `<radialGradient id="${id('glowA')}"><stop offset="0" stop-color="${p.glow[0]}" stop-opacity="${p.dark ? 0.55 : 0.6}"/><stop offset="1" stop-color="${p.glow[0]}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${id('glowB')}"><stop offset="0" stop-color="${p.glow[1]}" stop-opacity="${p.dark ? 0.42 : 0.7}"/><stop offset="1" stop-color="${p.glow[1]}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${id('glowC')}"><stop offset="0" stop-color="${p.glow[2]}" stop-opacity="${p.dark ? 0.4 : 0.45}"/><stop offset="1" stop-color="${p.glow[2]}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="${id('foil')}" x1="0" y1="0" x2="1" y2="1">${foilStops}</linearGradient>`,
    `<linearGradient id="${id('sheen')}" x1="0" y1="0" x2="1" y2="1"><stop offset="0.28" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="0.4" stop-color="#FFFFFF" stop-opacity="${p.dark ? 0.1 : 0.35}"/><stop offset="0.52" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>`
  );

  const art = (MOTIF_DRAW[design.motif] || motifGift)(ctx);

  /* Header: the mark, the wordmark and the value. */
  const header = `<path d="${MARK_D}" fill="${p.dark ? p.accent : p.accent}" transform="translate(96 70) scale(0.0987) translate(-220 -322)"/>
<path d="${WORDMARK_D}" fill="${p.ink}" fill-rule="evenodd" transform="translate(176 87) scale(0.1724) translate(-958 -1088)"/>
<line x1="384" y1="86" x2="384" y2="118" stroke="${p.ink}" stroke-opacity="0.3" stroke-width="2"/>
<text x="404" y="110" font-family="${FAMILY.sans}" font-weight="800" font-size="20" letter-spacing="5" fill="${p.ink}" fill-opacity="0.78">GIFT CARD</text>
<text x="1504" y="134" text-anchor="end" font-family="${FAMILY.serif}" font-weight="700" font-size="96" letter-spacing="-1" fill="url(#${id('foil')})">${escapeXml(amount)}</text>`;

  /* The words, stacked and centred in the space between header and code. */
  const head = layoutHeadline(design.headline, design.type);
  const overline = to ? `FOR ${to.toLocaleUpperCase('en')}` : 'A GIFT FOR YOU';
  let messageSize = 46;
  let messageLines = message ? wrap(message, 'hand', messageSize, 820) : [];
  if (messageLines.length > 3) {
    messageSize = 40;
    messageLines = wrap(message, 'hand', messageSize, 820).slice(0, 4);
  }
  const signature = from ? `— ${from}` : '';
  const headHeight = head.lines.length * head.size * head.spec.lead;
  const overlineBlock = 54;
  const messageBlock = messageLines.length ? 34 + messageLines.length * messageSize * 1.16 : 0;
  const signatureBlock = signature ? (messageLines.length ? 12 : 34) + 52 : 0;
  const total = overlineBlock + headHeight + messageBlock + signatureBlock;
  let y = Math.max(200, 486 - total / 2);

  const words = [];
  words.push(
    `<line x1="96" y1="${f1(y + 8)}" x2="136" y2="${f1(y + 8)}" stroke="${p.accent}" stroke-width="3" stroke-linecap="round"/>`,
    `<text x="152" y="${f1(y + 16)}" font-family="${FAMILY.sans}" font-weight="800" font-size="22" letter-spacing="5" fill="${p.accent}">${escapeXml(overline)}</text>`
  );
  y += overlineBlock;

  head.lines.forEach((line, i) => {
    y += head.size * head.spec.lead * (i === 0 ? 0.86 : 1);
    const second = head.lines.length > 1 && i === 1;
    let attrs;
    if (design.type === 'serif') {
      const italic = second || head.lines.length === 1;
      attrs = italic
        ? `font-family="${FAMILY.serif}" font-style="italic" font-weight="500" fill="url(#${id('foil')})"`
        : `font-family="${FAMILY.serif}" font-weight="700" fill="${p.ink}"`;
    } else if (design.type === 'script') {
      attrs = `font-family="${FAMILY.script}" font-weight="400" fill="url(#${id('foil')})"`;
    } else {
      attrs = `font-family="${FAMILY.sans}" font-weight="800" fill="${second ? p.accent : p.ink}"`;
    }
    words.push(
      `<text x="${design.type === 'script' ? 88 : 92}" y="${f1(y)}" ${attrs} font-size="${head.size}" letter-spacing="${head.spec.tracking}">${escapeXml(line)}</text>`
    );
  });
  y += head.size * head.spec.lead * 0.2;

  if (messageLines.length) {
    y += 34;
    messageLines.forEach((line, i) => {
      y += messageSize * (i === 0 ? 0.9 : 1.16);
      words.push(
        `<text x="98" y="${f1(y)}" font-family="${FAMILY.hand}" font-weight="600" font-size="${messageSize}" fill="${p.ink}" fill-opacity="0.92">${escapeXml(line)}</text>`
      );
    });
  }
  if (signature) {
    y += (messageLines.length ? 12 : 34) + 46;
    words.push(
      `<text x="98" y="${f1(y)}" font-family="${FAMILY.hand}" font-weight="600" font-size="50" fill="${p.accent}">${escapeXml(signature)}</text>`
    );
  }

  /* The code, on a panel along the bottom. */
  const qrBox = 112;
  const hasQr = Boolean(code && input.qrPath && input.qrSize);
  const infoRight = hasQr ? 1368 : 1488;
  const qr = hasQr
    ? `<rect x="1392" y="818" width="${qrBox}" height="${qrBox}" rx="16" fill="#FFFFFF"/><g transform="translate(1400 826) scale(${f1((qrBox - 16) / input.qrSize * 1000) / 1000})"><path d="${String(input.qrPath).replace(/[^0-9MmHhVvZz .,-]/g, '')}" fill="#0B1220"/></g>`
    : '';
  const masked = !code && input.maskedCode ? String(input.maskedCode).replace(/[^0-9A-Z•-]/g, '').slice(0, 19) : '';
  const shownCode = code || masked || '••••-••••-••••-••••';
  const codeNote = code
    ? ''
    : cleanText(input.note, 40) || (masked ? 'Hidden until you unlock it' : 'Revealed after payment');
  const panel = `<rect x="64" y="806" width="1472" height="136" rx="34" fill="${p.panel}" stroke="${p.panelLine}" stroke-width="2"/>
<text x="112" y="853" font-family="${FAMILY.sans}" font-weight="800" font-size="17" letter-spacing="5" fill="${p.ink}" fill-opacity="0.66">${code || masked ? 'GIFT CODE' : 'YOUR GIFT CODE'}</text>
<text x="110" y="910" font-family="${FAMILY.mono}" font-weight="700" font-size="46" letter-spacing="3" fill="${p.ink}" fill-opacity="${code ? 1 : masked ? 0.72 : 0.42}">${escapeXml(shownCode)}</text>
${codeNote ? `<text x="740" y="905" font-family="${FAMILY.sans}" font-weight="600" font-size="18" fill="${p.ink}" fill-opacity="0.6">${escapeXml(codeNote)}</text>` : ''}
<text x="${infoRight}" y="852" text-anchor="end" font-family="${FAMILY.sans}" font-weight="600" font-size="19" fill="${p.ink}" fill-opacity="0.7">Redeem on Blorbmart</text>
<text x="${infoRight}" y="887" text-anchor="end" font-family="${FAMILY.sans}" font-weight="800" font-size="24" fill="${p.ink}">shop.blorbmart.com.ng/gift</text>
<text x="${infoRight}" y="919" text-anchor="end" font-family="${FAMILY.sans}" font-weight="600" font-size="18" fill="${p.ink}" fill-opacity="0.62">${escapeXml(until ? `Valid until ${until}` : 'Valid for 12 months')}</text>
${qr}`;

  const stampWord = { redeemed: 'REDEEMED', revoked: 'VOID', expired: 'EXPIRED' }[input.status] || '';
  const stamp = stampWord
    ? `<g transform="rotate(-14 800 480)" opacity="0.92"><rect x="${800 - (stampWord.length * 44 + 120) / 2}" y="400" width="${stampWord.length * 44 + 120}" height="160" rx="26" fill="none" stroke="${input.status === 'redeemed' ? '#FFFFFF' : '#FF6B6B'}" stroke-width="10"/><text x="800" y="512" text-anchor="middle" font-family="${FAMILY.sans}" font-weight="800" font-size="96" letter-spacing="10" fill="${input.status === 'redeemed' ? '#FFFFFF' : '#FF6B6B'}">${stampWord}</text></g>`
    : '';
  const stampScrim = stampWord ? `<rect width="${CARD_W}" height="${CARD_H}" fill="#000000" opacity="0.38"/>` : '';

  const label = `Blorbmart gift card: ${amount}, ${design.headline}${to ? ` for ${to}` : ''}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}" role="img" aria-label="${escapeXml(label)}">
<defs>${ctx.defs.join('')}</defs>
<g clip-path="url(#${id('clip')})">
<rect width="${CARD_W}" height="${CARD_H}" fill="url(#${id('bg')})"/>
<circle cx="1260" cy="380" r="640" fill="url(#${id('glowA')})"/>
<circle cx="160" cy="980" r="720" fill="url(#${id('glowB')})"/>
<circle cx="820" cy="-120" r="520" fill="url(#${id('glowC')})"/>
${art}
<rect width="${CARD_W}" height="${CARD_H}" fill="url(#${id('sheen')})"/>
${header}
${words.join('\n')}
${panel}
${stampScrim}${stamp}
</g>
<rect x="1.5" y="1.5" width="${CARD_W - 3}" height="${CARD_H - 3}" rx="55" fill="none" stroke="${p.dark ? '#FFFFFF' : '#0B1220'}" stroke-opacity="${p.dark ? 0.16 : 0.08}" stroke-width="3"/>
</svg>`;
}

/** The catalogue a picker needs, without the drawing code. */
function catalogue() {
  return {
    limits: { ...LIMITS },
    themes: THEMES.map((t) => ({ ...t })),
    palettes: Object.entries(PALETTES).map(([key, v]) => ({
      id: key,
      name: v.name,
      dark: v.dark,
      swatch: [v.bg[1], v.bg[2], v.foil[1]],
    })),
    motifs: Object.entries(MOTIFS).map(([key, name]) => ({ id: key, name })),
    types: Object.entries(TYPES).map(([key, name]) => ({ id: key, name })),
  };
}

const GiftCardArt = {
  CARD_W,
  CARD_H,
  LIMITS,
  THEMES,
  PALETTES,
  MOTIFS,
  TYPES,
  cleanText,
  resolveDesign,
  formatAmount,
  formatDate,
  renderGiftCardSvg,
  catalogue,
  measure,
};

export default GiftCardArt;
