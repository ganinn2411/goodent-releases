import QRCode from 'qrcode'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/**
 * İş için etiket yazdırır (50x30 mm). İçindeki QR: <site adresi>/?scan=<iş numarası>
 *
 * Kullanım (iş kaydedildikten sonra):
 *   const { data } = await supabase.from('cases').insert({...}).select().single()
 *   await printCaseLabel({
 *     case_no: data.case_no,
 *     patient: hastaAdi,
 *     doctor: doktorAdi,
 *     work_type: data.work_type,
 *     tooth_numbers: data.tooth_numbers,
 *     due_date: data.due_date,
 *   })
 */
// QR resmi (data URL). Ekranda önizleme ve etiket için ortak kullanılır.
export async function caseQrUrl(case_no, width = 300) {
  // QR içeriği: https://siteniz.com/?scan=1042  -> telefonun normal kamerası da okuyabilir.
  // Adres .env içindeki VITE_PUBLIC_URL'den alınır (Windows .exe içinde zorunlu).
  const envUrl = (import.meta.env.VITE_PUBLIC_URL || '').trim().replace(/\/+$/, '')
  const base = envUrl || (/^https?:$/.test(location.protocol) ? location.origin : '')
  const content = base ? `${base}/?scan=${case_no}` : `GD-${case_no}`
  // margin:1 -> QR çevresinde boşluk (okuyucular için gerekli)
  return QRCode.toDataURL(content, { margin: 1, width, errorCorrectionLevel: 'M' })
}

export async function printCaseLabel(c) {
  const qr = await caseQrUrl(c.case_no, 300)

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiket ${esc(c.case_no)}</title>
<style>
  @page { size: 50mm 30mm; margin: 0 }
  * { box-sizing: border-box }
  html, body { width: 50mm; height: 30mm; overflow: hidden }
  body { margin: 0; font-family: Arial, sans-serif; color: #000 }
  .l { width: 50mm; height: 30mm; padding: 1.5mm; display: flex; gap: 2mm; align-items: center }
  img { width: 24mm; height: 24mm; flex: none; image-rendering: pixelated }
  .t { flex: 1; min-width: 0; font-size: 7pt; line-height: 1.25 }
  .n { font-size: 13pt; font-weight: 700 }
  .t div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
</style></head><body>
<div class="l">
  <img src="${qr}" alt="">
  <div class="t">
    <div class="n">#${esc(c.case_no)}</div>
    <div>${esc(c.patient)}</div>
    <div>${c.doctor ? 'Dr. ' + esc(c.doctor) : ''}</div>
    <div>${esc(c.work_type)}${c.tooth_numbers ? ' · ' + esc(c.tooth_numbers) : ''}</div>
    <div>${c.due_date ? 'Teslim: ' + esc(c.due_date) : ''}</div>
  </div>
</div></body></html>`

  // Windows .exe (Electron): iframe'den yazdırma ana sayfayı yazdırır (boş çıkar).
  // Bu yüzden ana süreçteki gizli pencereden yazdır.
  if (window.goodent && window.goodent.printHtml) {
    await window.goodent.printHtml(html)
    return
  }

  // Tarayıcı / telefon: gizli iframe (pop-up engelleyicilere takılmaz).
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  iframe.srcdoc = html
  iframe.onload = () => {
    const w = iframe.contentWindow
    w.focus()
    w.print()
    setTimeout(() => iframe.remove(), 2000)
  }
}