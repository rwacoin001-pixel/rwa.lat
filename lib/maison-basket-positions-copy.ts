import type { AppLocale } from '@/lib/app-locales'

/** Basket holdings on /assets. Product cost/P&L/yield labels are scoped so they are never read as basket figures. */
export type BasketPositionsCopy = {
  title: string; note: string; loadError: string; partial: string; units: string; nav: string
  quality: { stale: string; partial: string; unavailable: string }
  productCost: string; productPnl: string; productYield: string
}

const en: BasketPositionsCopy = {
  title: 'Baskets', note: 'Net units at latest NAV', loadError: 'Baskets could not be loaded', partial: 'Some values are unavailable, so totals are incomplete.', units: 'units', nav: 'NAV',
  quality: { stale: 'NAV stale', partial: 'NAV partial', unavailable: 'NAV unavailable' },
  productCost: 'Product cost', productPnl: 'Product P&L', productYield: 'Product yield',
}

const zh: BasketPositionsCopy = {
  title: '篮子', note: '按最新净值计的净持有份额', loadError: '篮子持仓加载失败', partial: '部分估值暂不可用，合计不完整。', units: '份', nav: '净值',
  quality: { stale: '净值已过期', partial: '净值不完整', unavailable: '净值暂不可用' },
  productCost: '产品成本', productPnl: '产品盈亏', productYield: '产品收益',
}

const hi: BasketPositionsCopy = {
  title: 'बास्केट', note: 'नवीनतम NAV पर शुद्ध यूनिट', loadError: 'बास्केट लोड नहीं हो सके', partial: 'कुछ मूल्य उपलब्ध नहीं हैं, इसलिए कुल अधूरा है।', units: 'यूनिट', nav: 'NAV',
  quality: { stale: 'NAV पुराना', partial: 'NAV आंशिक', unavailable: 'NAV उपलब्ध नहीं' },
  productCost: 'उत्पाद लागत', productPnl: 'उत्पाद लाभ/हानि', productYield: 'उत्पाद आय',
}

const es: BasketPositionsCopy = {
  title: 'Cestas', note: 'Unidades netas al último NAV', loadError: 'No se pudieron cargar las cestas', partial: 'Faltan algunos valores; los totales están incompletos.', units: 'unid.', nav: 'NAV',
  quality: { stale: 'NAV desactualizado', partial: 'NAV parcial', unavailable: 'NAV no disponible' },
  productCost: 'Coste de productos', productPnl: 'P&G de productos', productYield: 'Rend. de productos',
}

const ar: BasketPositionsCopy = {
  title: 'السلال', note: 'الوحدات الصافية بآخر صافي قيمة', loadError: 'تعذر تحميل السلال', partial: 'بعض القيم غير متاحة، لذا الإجماليات غير مكتملة.', units: 'وحدة', nav: 'صافي القيمة',
  quality: { stale: 'صافي القيمة قديم', partial: 'صافي القيمة جزئي', unavailable: 'صافي القيمة غير متاح' },
  productCost: 'تكلفة المنتجات', productPnl: 'ربح/خسارة المنتجات', productYield: 'عائد المنتجات',
}

const fr: BasketPositionsCopy = {
  title: 'Paniers', note: 'Parts nettes à la dernière VL', loadError: 'Impossible de charger les paniers', partial: 'Certaines valeurs sont indisponibles : les totaux sont incomplets.', units: 'parts', nav: 'VL',
  quality: { stale: 'VL périmée', partial: 'VL partielle', unavailable: 'VL indisponible' },
  productCost: 'Coût des produits', productPnl: 'P&L des produits', productYield: 'Rendement des produits',
}

const pt: BasketPositionsCopy = {
  title: 'Cestas', note: 'Unidades líquidas no último NAV', loadError: 'Não foi possível carregar as cestas', partial: 'Alguns valores estão indisponíveis; os totais estão incompletos.', units: 'unid.', nav: 'NAV',
  quality: { stale: 'NAV desatualizado', partial: 'NAV parcial', unavailable: 'NAV indisponível' },
  productCost: 'Custo dos produtos', productPnl: 'L/P dos produtos', productYield: 'Rend. dos produtos',
}

export const basketPositionsCopy: Record<AppLocale, BasketPositionsCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
