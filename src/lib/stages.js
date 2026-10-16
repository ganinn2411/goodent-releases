// İş aşamaları: kodlar veritabanındaki `stage_code` enum'u ile birebir aynıdır (DEĞİŞTİRMEYİN).
// Ekranda görünen adlar buradaki varsayılanlardır; yönetici Ayarlar > "Aşama adları"
// bölümünden dil bazında değiştirebilir (app_settings tablosu, id = 'stage_names').

export const STAGE_CODES = ['kabul', 'tasarim', 'uretim', 'porselen', 'kalite', 'prova', 'sevkiyat', 'teslim']

export const STAGE_DEF = {
  tr: { kabul: 'Kabul', tasarim: 'Tasarım', uretim: 'Üretim', porselen: 'Porselen', kalite: 'Kalite', prova: 'Prova', sevkiyat: 'Sevkiyat', teslim: 'Teslim' },
  en: { kabul: 'Intake', tasarim: 'Design', uretim: 'Production', porselen: 'Porcelain', kalite: 'Quality', prova: 'Try-in', sevkiyat: 'Shipping', teslim: 'Delivery' },
  ar: { kabul: 'الاستلام', tasarim: 'التصميم', uretim: 'التصنيع', porselen: 'البورسلين', kalite: 'الجودة', prova: 'التجربة', sevkiyat: 'الشحن', teslim: 'التسليم' },
}

export const STAGE_NAME_MAX = 24

/**
 * Bir aşamanın ekranda görünecek adı.
 * Öncelik: yöneticinin girdiği özel ad -> dilin varsayılanı -> Türkçe varsayılan -> kodun kendisi.
 * overrides: { tr: { kabul: '...' }, en: {...}, ar: {...} }
 */
export function stageLabel(code, lang = 'tr', overrides = null) {
  const custom = overrides?.[lang]?.[code]
  if (typeof custom === 'string' && custom.trim()) return custom.trim()
  return STAGE_DEF[lang]?.[code] || STAGE_DEF.tr[code] || code
}