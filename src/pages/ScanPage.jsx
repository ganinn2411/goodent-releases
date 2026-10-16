import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { supabase } from '../lib/supabase'
import { stageLabel } from '../lib/stages'

// Uygulamanın diliyle aynı: tr / en / ar
const T = {
  tr: {
    title: 'Barkod okut',
    hint: 'İlk okutma: işi teslim alırsınız. İş bitince tekrar okutun: sonraki aşamaya geçer.',
    manual: 'İş numarasını elle yazın (örn. 1042)',
    send: 'Gönder',
    next: 'Sonraki barkod',
    camError: 'Kamera açılamadı. Tarayıcıda kamera iznini verin (sayfa https:// ile açılmalı).',
    taken: s => `Teslim alındı: ${s}`,
    takenHint: 'İşi bitirince barkodu tekrar okutun.',
    finished: s => `${s} bitti`,
    nextStage: s => `Sıradaki aşama: ${s}`,
    delivered: 'İş teslim edildi',
    stageDone: s => `${s} aşaması bitti.`,
    notFound: n => `Bu numarayla bir iş bulunamadı: ${n}`,
    closed: 'Bu iş kapanmış (teslim edilmiş veya iptal).',
    noStage: 'Bu işin aktif aşaması yok. Yöneticiye haber verin.',
    other: w => `Bu işi ${w || 'başka bir personel'} teslim almış.`,
    tooFast: 'Az önce teslim aldınız. İşi bitirince tekrar okutun.',
    auth: 'Giriş yapmanız gerekiyor.',
    net: 'Bağlantı hatası. İnterneti kontrol edip tekrar deneyin.',
    job: 'İş', tooth: 'Diş', shade: 'Renk', due: 'Teslim tarihi',
  },
  en: {
    title: 'Scan barcode',
    hint: 'First scan: you receive the job. Scan again when done: it moves to the next stage.',
    manual: 'Type the job number (e.g. 1042)',
    send: 'Send',
    next: 'Scan next',
    camError: 'Could not open the camera. Allow camera access in the browser (page must use https://).',
    taken: s => `Received: ${s}`,
    takenHint: 'Scan the barcode again when you finish.',
    finished: s => `${s} finished`,
    nextStage: s => `Next stage: ${s}`,
    delivered: 'Job delivered',
    stageDone: s => `${s} stage finished.`,
    notFound: n => `No job found with this number: ${n}`,
    closed: 'This job is closed (delivered or cancelled).',
    noStage: 'This job has no active stage. Tell the manager.',
    other: w => `This job was received by ${w || 'another staff member'}.`,
    tooFast: 'You just received it. Scan again when you finish.',
    auth: 'You need to sign in.',
    net: 'Connection error. Check the internet and try again.',
    job: 'Job', tooth: 'Teeth', shade: 'Shade', due: 'Due date',
  },
  ar: {
    title: 'مسح الباركود',
    hint: 'المسحة الأولى: تستلم الشغلة. امسح مرة ثانية عند الانتهاء: تنتقل إلى المرحلة التالية.',
    manual: 'اكتب رقم الشغلة يدوياً (مثال 1042)',
    send: 'إرسال',
    next: 'الباركود التالي',
    camError: 'تعذر فتح الكاميرا. اسمح باستخدام الكاميرا في المتصفح (يجب أن تُفتح الصفحة عبر https://).',
    taken: s => `تم الاستلام: ${s}`,
    takenHint: 'امسح الباركود مرة ثانية عند الانتهاء.',
    finished: s => `انتهت مرحلة ${s}`,
    nextStage: s => `المرحلة التالية: ${s}`,
    delivered: 'تم تسليم الشغلة',
    stageDone: s => `انتهت مرحلة ${s}.`,
    notFound: n => `لا توجد شغلة بهذا الرقم: ${n}`,
    closed: 'هذه الشغلة مغلقة (مسلّمة أو ملغاة).',
    noStage: 'لا توجد مرحلة نشطة لهذه الشغلة. أخبر المدير.',
    other: w => `هذه الشغلة استلمها ${w || 'موظف آخر'}.`,
    tooFast: 'لقد استلمتها للتو. امسح مرة ثانية عند الانتهاء.',
    auth: 'يجب تسجيل الدخول.',
    net: 'خطأ في الاتصال. تحقق من الإنترنت وحاول مرة ثانية.',
    job: 'شغلة', tooth: 'الأسنان', shade: 'اللون', due: 'تاريخ التسليم',
  },
}

// Barkod içeriği: adres (?scan=1042), "GD-1042" ya da sadece "1042" olabilir.
function parseCaseNo(text) {
  const s = String(text).trim()
  const u = s.match(/[?&]scan=(\d{1,12})(?:[&#]|$)/) // https://site/?scan=1042
  if (u) return Number(u[1])
  const m = s.match(/^(?:GD-)?(\d{1,12})$/i)
  return m ? Number(m[1]) : null
}

function buildView(res, t, st, no) {  // st: (kod) => görünen aşama adı
  if (!res || typeof res !== 'object') return { tone: 'err', title: t.net, lines: [] }
  if (!res.ok) {
    const m = {
      yetki: t.auth,
      bulunamadi: t.notFound(no),
      kapali: t.closed,
      asama_yok: t.noStage,
      baskasinda: t.other(res.who),
      cok_hizli: t.tooFast,
    }
    return { tone: 'err', title: m[res.code] || res.message || t.net, lines: [] }
  }
  const stage = st(res.stage)
  if (res.action === 'alindi') return { tone: 'ok', title: t.taken(stage), lines: [t.takenHint] }
  if (res.delivered) return { tone: 'done', title: t.delivered, lines: [t.stageDone(stage)] }
  return { tone: 'done', title: t.finished(stage), lines: [t.nextStage(st(res.next_stage))] }
}

const TONE = {
  ok: { bg: '#e7f6ec', fg: '#14532d', bar: '#16a34a' },
  done: { bg: '#e8f0ff', fg: '#1e3a8a', bar: '#2563eb' },
  err: { bg: '#fdecec', fg: '#7f1d1d', bar: '#dc2626' },
}

export default function ScanPage({ lang = 'tr', stageNames = null, onClose }) {
  const t = T[lang] || T.tr
  const st = k => stageLabel(k, lang, stageNames)
  const [view, setView] = useState(null)
  const [camError, setCamError] = useState(false)
  const [manual, setManual] = useState('')
  const busyRef = useRef(false)
  const langRef = useRef(lang)
  langRef.current = lang
  const namesRef = useRef(stageNames)
  namesRef.current = stageNames

  async function handleCode(text) {
    if (busyRef.current) return
    const no = parseCaseNo(text)
    if (no === null) return // başka bir QR/barkod: yok say
    busyRef.current = true

    const { data, error } = await supabase.rpc('scan_case', { p_case_no: no })
    const L = langRef.current
    const res = error ? null : data
    const v = buildView(res, T[L] || T.tr, k => stageLabel(k, L, namesRef.current), no)

    if (navigator.vibrate) navigator.vibrate(v.tone === 'err' ? [80, 60, 80] : 120)
    setView({ ...v, caseInfo: res?.case || null })
  }

  function dismiss() {
    setView(null)
    setManual('')
    busyRef.current = false
  }

  // Başarılı sonuçlar 4 sn sonra kendiliğinden kapanır; hatalar dokununca kapanır.
  useEffect(() => {
    if (!view || view.tone === 'err') return
    const id = setTimeout(dismiss, 4000)
    return () => clearTimeout(id)
  }, [view])

  // Telefonun normal kamerasından açılan link (?scan=1042): sayfa açılınca otomatik tara.
  useEffect(() => {
    const n = sessionStorage.getItem('pendingScan')
    if (!n) return
    sessionStorage.removeItem('pendingScan') // çift tarama olmasın
    handleCode(n)
  }, [])

  // ---- kamera ----
  useEffect(() => {
    let scanner = null
    let started = false
    let cancelled = false

    async function stop() {
      try {
        if (scanner && started) {
          started = false
          await scanner.stop()
          scanner.clear()
        }
      } catch (e) { /* yok say */ }
    }

    async function start() {
      try {
        scanner = new Html5Qrcode('goodent-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        })
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          text => handleCode(text),
          () => {}
        )
        started = true
        if (cancelled) await stop()
      } catch (e) {
        setCamError(true)
      }
    }

    start()
    return () => { cancelled = true; stop() }
  }, [])

  function submitManual(e) {
    e.preventDefault()
    handleCode(manual)
  }

  const c = view ? TONE[view.tone] : null
  const ci = view?.caseInfo

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* üst çubuk: sadece kapat düğmesi ve başlık */}
      <div style={{ position: 'absolute', top: 0, insetInline: 0, zIndex: 2, display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 14px 12px', background: 'linear-gradient(#000000aa, transparent)', color: '#fff' }}>
        {onClose && (
          <button onClick={onClose} aria-label="✕" style={{ border: 0, width: 38, height: 38, borderRadius: 19, background: '#ffffff26', color: '#fff', fontSize: 18, cursor: 'pointer' }}>✕</button>
        )}
        <b style={{ fontSize: 16 }}>{t.title}</b>
      </div>

      {/* kamera tüm ekranı kaplar */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        <div id="goodent-reader" style={{ width: '100%' }} />
        {camError && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 28, color: '#cbd5e1', textAlign: 'center', fontSize: 14, lineHeight: 1.5 }}>
            {t.camError}
          </div>
        )}
      </div>

      {/* altta küçük elle giriş */}
      <form onSubmit={submitManual} style={{ position: 'absolute', bottom: 0, insetInline: 0, zIndex: 2, display: 'flex', gap: 8, padding: '12px 14px calc(env(safe-area-inset-bottom, 0px) + 14px)', background: 'linear-gradient(transparent, #000000bb)' }}>
        <input
          value={manual}
          onChange={e => setManual(e.target.value)}
          inputMode="numeric"
          placeholder={t.manual}
          style={{ flex: 1, background: '#ffffffee' }}
        />
        <button type="submit" className="btn btn-p">{t.send}</button>
      </form>

      {view && (
        <div
          onClick={dismiss}
          style={{ position: 'fixed', inset: 0, background: '#000000aa', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            role="status"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 520, background: c.bg, color: c.fg, borderTop: `6px solid ${c.bar}`, borderRadius: '18px 18px 0 0', padding: '20px 18px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{view.title}</div>
            {view.lines.map((l, i) => <div key={i} style={{ fontSize: 16 }}>{l}</div>)}
            {ci && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #0000001f', fontSize: 15, lineHeight: 1.6 }}>
                <div><b>{t.job} #{ci.case_no}</b> · {ci.work_type}</div>
                <div>{ci.patient}{ci.doctor ? ` · Dr. ${ci.doctor}` : ''}</div>
                {(ci.tooth_numbers || ci.shade) && (
                  <div>
                    {ci.tooth_numbers ? `${t.tooth}: ${ci.tooth_numbers}` : ''}
                    {ci.tooth_numbers && ci.shade ? ' · ' : ''}
                    {ci.shade ? `${t.shade}: ${ci.shade}` : ''}
                  </div>
                )}
                {ci.due_date && <div>{t.due}: {ci.due_date}</div>}
              </div>
            )}
            <button className="btn" style={{ background: c.bar, color: '#fff', marginTop: 14, width: '100%', padding: 13 }} onClick={dismiss}>
              {t.next}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}