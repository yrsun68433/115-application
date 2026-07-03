import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient'

const STATUS_OPTIONS = ['未確認', '已收件', '格式不符待補件', '已補件收件', '未提交申請書']

const STATUS_STYLE = {
  未確認: { bg: '#f3f2ee', fg: '#5b6570' },
  已收件: { bg: '#eaf4ec', fg: '#2f6b3a' },
  格式不符待補件: { bg: '#fbeeeb', fg: '#a3402f' },
  已補件收件: { bg: '#f0e6f7', fg: '#6b3fa0' },
  未提交申請書: { bg: '#fdf6e3', fg: '#6b5200' },
}

// 「未提交申請書」底下的通知進度子選項
const NOTIFY_OPTIONS = ['', '通知1', '通知2', '成功', '放棄']

const NOTIFY_STYLE = {
  '': { bg: '#ffffff', fg: '#5b6570' },
  通知1: { bg: '#fdf6e3', fg: '#8a6d00' },   // 淡黃
  通知2: { bg: '#fce3cf', fg: '#a3540f' },   // 淡橘（明顯不同於通知1）
  成功: { bg: '#eaf4ec', fg: '#2f6b3a' },     // 淡綠
  放棄: { bg: '#e4e4e2', fg: '#8a8d91' },     // 灰，表示不再追蹤
}

function fmtTime(d) {
  return d.toLocaleTimeString('zh-TW', { hour12: false })
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div style={S.wrap}>
        <div style={{ ...S.inner, maxWidth: 640 }}>
          <h1 style={S.h1}>115學年度 社科院院學士學位學程 一審審查頁面</h1>
          <div style={{ ...S.warnBar, marginTop: 16 }}>
            <b>尚未設定 Supabase 連線資訊，畫面因此無法載入資料。</b>
            <div style={{ marginTop: 8 }}>
              請確認部署平台（Vercel／Netlify）的 <b>環境變數</b> 已設定以下兩項，
              且套用於 Production 環境，並在設定後重新部署（Redeploy）一次：
            </div>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li><code>VITE_SUPABASE_URL</code></li>
              <li><code>VITE_SUPABASE_ANON_KEY</code></li>
            </ul>
            <div style={{ marginTop: 8 }}>
              本機開發則是複製 <code>.env.example</code> 為 <code>.env</code> 並填入同樣兩個值。
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <ApplicantTable />
}

function ApplicantTable() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [savedFlag, setSavedFlag] = useState('')
  const [deptOpen, setDeptOpen] = useState(false)
  const saveTimers = useRef({})

  // 初次載入
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('applicants')
        .select('*')
        .order('id', { ascending: true })
      if (!active) return
      if (error) {
        setLoadError(error.message)
      } else {
        setRows(data || [])
        setLoadError(null)
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  // 多裝置即時同步：其他分頁／裝置更新資料時，本頁畫面也會跟著更新
  useEffect(() => {
    const channel = supabase
      .channel('applicants-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applicants' },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((r) => r.id !== payload.old.id)
            }
            const idx = prev.findIndex((r) => r.id === payload.new.id)
            if (idx === -1) return [...prev, payload.new].sort((a, b) => a.id - b.id)
            const next = [...prev]
            next[idx] = payload.new
            return next
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // 欄位變更：先更新畫面，再以 debounce 寫回 Supabase，避免每個按鍵都送出請求
  function updateField(id, field, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

    const key = `${id}:${field}`
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(async () => {
      const { error } = await supabase.from('applicants').update({ [field]: value }).eq('id', id)
      if (error) {
        setSavedFlag(`第 ${id} 筆儲存失敗：${error.message}`)
      } else {
        setSavedFlag(`已儲存 ✓ ${fmtTime(new Date())}`)
        setTimeout(() => setSavedFlag(''), 2500)
      }
    }, field === 'note' || field === 'phone' || field === 'email' ? 600 : 0)
  }

  const counts = useMemo(() => {
    const c = { total: rows.length, 未確認: 0, 已收件: 0, 格式不符待補件: 0, 已補件收件: 0, 未提交申請書: 0, noContact: 0, 放棄: 0 }
    for (const r of rows) {
      c[r.status] = (c[r.status] || 0) + 1
      if (!r.phone && !r.email) c.noContact += 1
      if (r.notify_stage === '放棄') c.放棄 += 1
    }
    return c
  }, [rows])

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter((r) => {
      const matchQ =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.student_id.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      const matchStatus = !statusFilter || r.status === statusFilter
      return matchQ && matchStatus
    })
    // 排序：格式不符待補件（1）→ 未提交申請書（2）→ 格式補件完成／已補件收件（3）
    // → 未繳件補完／已收件但曾走過通知流程（4）→ 其餘一般已收件、未確認（最後）
    const rank = (r) => {
      if (r.status === '格式不符待補件') return 0
      if (r.status === '未提交申請書') return 1
      if (r.status === '已補件收件') return 2
      if (r.status === '已收件' && r.notify_stage) return 3
      return 4
    }
    return filtered.sort((a, b) => {
      const ra = rank(a)
      const rb = rank(b)
      if (ra !== rb) return ra - rb
      return a.id - b.id
    })
  }, [rows, search, statusFilter])

  // 各系所統計：申請人數、格式不合（含已補件完成）、未繳件（含後補）、放棄人數
  const deptStats = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const dep = r.department || '未標註系所'
      if (!map[dep]) {
        map[dep] = { department: dep, total: 0, formatIssue: 0, missing: 0, abandoned: 0 }
      }
      map[dep].total += 1
      if (r.status === '格式不符待補件' || r.status === '已補件收件') map[dep].formatIssue += 1
      if (r.status === '未提交申請書' || (r.status === '已收件' && r.notify_stage)) map[dep].missing += 1
      if (r.notify_stage === '放棄') map[dep].abandoned += 1
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [rows])

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <h1 style={S.h1}>115學年度 社科院院學士學位學程 加修學系一審審查頁面</h1>
        <p style={S.subtitle}>
          共 {counts.total} 位申請人・資料即時儲存於 Supabase，可多裝置同步編輯
        </p>

        <div style={S.infoBar}>
          資料來源：115初審紀錄.docx、115院學士申請雙主修校對表.pdf、一審規格不符_全_.pdf、第一階段_且符合_全_.pdf（115.07.02 整理）。
          「已收件」之申請書格式已完成初步核對，無需再次檢查；如有補充或更正，請直接於下表備註欄記錄。
        </div>

        {counts.未提交申請書 > 0 && (
          <div style={S.warnBar}>
            提醒：目前有 {counts.未提交申請書} 位在名冊中登記、但未查得申請書電子檔的學生，已標記為「未提交申請書」，請確認是否遺漏收件或需個別聯繫確認。
          </div>
        )}

        <div style={S.stats}>
          <Stat label="申請總人數" value={counts.total} />
          <Stat label="放棄" value={counts.放棄} tone="issue" />
          <Stat label="已收件" value={counts.已收件 + counts.已補件收件} tone="ok" />
          <Stat label="格式不符待補件" value={counts.格式不符待補件} tone="issue" />
          <Stat label="未提交申請書" value={counts.未提交申請書} tone="warn" />
        </div>

        <div style={S.controls}>
          <input
            type="text"
            placeholder="搜尋姓名 / 學號 / 系所..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={S.search}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={S.filterSelect}>
            <option value="">全部狀態</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span style={S.savedFlag}>{savedFlag || (loading ? '載入中...' : '已連線 Supabase')}</span>
        </div>

        {loadError && (
          <div style={S.warnBar}>
            無法從 Supabase 讀取資料：{loadError}。請確認 .env 中的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
            是否正確，以及資料表 applicants 是否已建立並匯入種子資料。
          </div>
        )}

        <div style={S.deptSection}>
          <button onClick={() => setDeptOpen((o) => !o)} style={S.deptToggleBtn}>
            {deptOpen ? '收合' : '展開'}各系所統計數據 {deptOpen ? '▲' : '▼'}
          </button>
          {deptOpen && (
            <table style={S.deptTable}>
              <thead>
                <tr>
                  <th style={S.deptTh}>系所</th>
                  <th style={S.deptTh}>申請人數</th>
                  <th style={S.deptTh}>格式不合人數（含已補件完成）</th>
                  <th style={S.deptTh}>未繳件人數（含後補）</th>
                  <th style={S.deptTh}>放棄人數</th>
                </tr>
              </thead>
              <tbody>
                {deptStats.map((d) => (
                  <tr key={d.department}>
                    <td style={S.deptTd}>{d.department}</td>
                    <td style={S.deptTd}>{d.total}</td>
                    <td style={S.deptTd}>{d.formatIssue}</td>
                    <td style={S.deptTd}>{d.missing}</td>
                    <td style={S.deptTd}>{d.abandoned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 34 }}>序號</th>
                <th style={{ ...S.th, width: 90 }}>學號</th>
                <th style={{ ...S.th, width: 80 }}>姓名</th>
                <th style={{ ...S.th, width: 120 }}>現讀系級</th>
                <th style={{ ...S.th, width: 130 }}>電話</th>
                <th style={{ ...S.th, width: 160 }}>Email</th>
                <th style={{ ...S.th, width: 170 }}>申請志願</th>
                <th style={{ ...S.th, width: 150 }}>收件 / 審查狀態</th>
                <th style={{ ...S.th, width: 240 }}>備註</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <Row key={r.id} r={r} onChange={updateField} />
              ))}
              {!loading && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...S.td, textAlign: 'center', color: '#5b6570' }}>
                    沒有符合條件的申請人
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer style={S.footer}>
          資料儲存於 Supabase（table: applicants）・部署於 Netlify / GitHub Pages
        </footer>
      </div>
    </div>
  )
}

function Row({ r, onChange }) {
  const isLateSubmit = r.status === '已收件' && !!r.notify_stage
  const rc =
    r.status === '未提交申請書' && r.notify_stage === '放棄' ? S.rowAbandoned
    : r.status === '格式不符待補件' ? S.rowIssue
    : r.status === '未提交申請書' ? S.rowMissing
    : r.status === '已補件收件' ? S.rowResupplied
    : isLateSubmit ? S.rowLateSubmit
    : r.status === '已收件' ? S.rowDone
    : S.row

  return (
    <tr style={rc}>
      <td style={S.td}>{r.id}</td>
      <td style={S.td}>{r.student_id}</td>
      <td style={{ ...S.td, fontWeight: 600 }}>
        {r.name}
        {r.name_note && <div style={S.nameNote}>⚠ {r.name_note}</div>}
      </td>
      <td style={S.td}>
        <div>{r.department}</div>
        <div style={S.dept}>{r.grade_year} 年級</div>
      </td>
      <td style={S.td}>
        <input
          type="text"
          value={r.phone || ''}
          placeholder="待補"
          onChange={(e) => onChange(r.id, 'phone', e.target.value)}
          style={{ ...S.inputSm, ...(r.phone ? {} : S.inputMissing) }}
        />
      </td>
      <td style={S.td}>
        <input
          type="text"
          value={r.email || ''}
          placeholder="待補"
          onChange={(e) => onChange(r.id, 'email', e.target.value)}
          style={{ ...S.inputSm, width: 150, ...(r.email ? {} : S.inputMissing) }}
        />
      </td>
      <td style={{ ...S.td, ...S.wish }}>
        {(r.wishes || []).map((w, i) => (
          <div key={i}>
            <b>{['第一', '第二', '第三', '第四'][i] || `第${i + 1}`}</b>：{w}
          </div>
        ))}
      </td>
      <td style={S.td}>
        <select
          value={r.status}
          onChange={(e) => onChange(r.id, 'status', e.target.value)}
          style={{
            ...S.select,
            background: STATUS_STYLE[r.status]?.bg,
            color: STATUS_STYLE[r.status]?.fg,
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {r.status === '已補件收件' && (
          <div style={S.resuppliedTag}>原格式不符，已補件</div>
        )}
        {isLateSubmit && (
          <div style={S.lateSubmitTag}>原未提交，已補交</div>
        )}
        {r.status === '未提交申請書' && (
          <select
            value={r.notify_stage || ''}
            onChange={(e) => onChange(r.id, 'notify_stage', e.target.value)}
            style={{
              ...S.selectNotify,
              background: NOTIFY_STYLE[r.notify_stage || '']?.bg,
              color: NOTIFY_STYLE[r.notify_stage || '']?.fg,
            }}
          >
            {NOTIFY_OPTIONS.map((n) => (
              <option key={n || '未通知'} value={n}>
                {n || '未通知'}
              </option>
            ))}
          </select>
        )}
      </td>
      <td style={S.td}>
        <textarea
          value={r.note || ''}
          placeholder="通知紀錄／備註"
          onChange={(e) => onChange(r.id, 'note', e.target.value)}
          style={S.textarea}
        />
      </td>
    </tr>
  )
}

function Stat({ label, value, tone }) {
  const toneColor = tone === 'ok' ? '#2f6b3a' : tone === 'issue' ? '#a3402f' : tone === 'warn' ? '#b8860b' : '#1f2328'
  return (
    <div style={S.stat}>
      <div style={{ ...S.statNum, color: toneColor }}>{value}</div>
      <div style={S.statLbl}>{label}</div>
    </div>
  )
}

const S = {
  wrap: {
    minHeight: '100vh',
    background: '#faf9f7',
    color: '#1f2328',
    fontFamily:
      '"PingFang TC","Noto Sans TC","Microsoft JhengHei",-apple-system,BlinkMacSystemFont,sans-serif',
    padding: '28px 20px 60px',
  },
  inner: { maxWidth: 1320, margin: '0 auto' },
  h1: { fontSize: 20, fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.02em' },
  subtitle: { color: '#5b6570', fontSize: 13, marginBottom: 16 },
  infoBar: {
    background: '#eef4f2',
    border: '1px solid #cfe0da',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 12.5,
    lineHeight: 1.7,
    color: '#2f5d50',
    marginBottom: 12,
  },
  warnBar: {
    background: '#fdf6e3',
    border: '1px solid #f0dfa6',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 12.5,
    lineHeight: 1.7,
    color: '#6b5200',
    marginBottom: 16,
  },
  stats: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 },
  stat: { background: '#fff', border: '1px solid #e3e6ea', borderRadius: 10, padding: '12px 18px', minWidth: 110 },
  statNum: { fontSize: 22, fontWeight: 700, lineHeight: 1.1 },
  statLbl: { fontSize: 12, color: '#5b6570', marginTop: 2 },
  controls: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 200, padding: '9px 12px', border: '1px solid #e3e6ea', borderRadius: 8, fontSize: 13, background: '#fff' },
  filterSelect: { padding: '9px 10px', border: '1px solid #e3e6ea', borderRadius: 8, fontSize: 13, background: '#fff' },
  savedFlag: { fontSize: 12, color: '#5b6570' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e3e6ea', borderRadius: 10, fontSize: 13 },
  th: { background: '#f3f2ee', textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#5b6570', fontSize: 12, borderBottom: '1px solid #e3e6ea', whiteSpace: 'nowrap' },
  td: { padding: 8, borderBottom: '1px solid #e3e6ea', verticalAlign: 'top' },
  row: {},
  rowIssue: { background: '#fbeeeb' },       // 格式不符待補件 → 淡紅
  rowMissing: { background: '#fdf6e3' },     // 未提交申請書 → 淡黃
  rowResupplied: { background: '#f0e6f7' },  // 已補件收件（原格式不符）→ 淡紫
  rowLateSubmit: { background: '#e3f1f4' },  // 已收件但曾走通知流程（原未提交，已補交）→ 淡藍綠
  rowDone: { background: '#eaf4ec' },        // 已收件 → 淡綠
  rowAbandoned: { background: '#ececea', opacity: 0.55 }, // 未提交申請書＋已放棄 → 淡灰、整列變淺
  resuppliedTag: { fontSize: 10.5, color: '#6b3fa0', marginTop: 4 },
  lateSubmitTag: { fontSize: 10.5, color: '#2f7080', marginTop: 4 },
  dept: { color: '#5b6570', fontSize: 12 },
  wish: { fontSize: 12, color: '#5b6570', lineHeight: 1.5 },
  nameNote: { fontWeight: 400, fontSize: 11, color: '#a3402f', marginTop: 2, maxWidth: 160, whiteSpace: 'normal' },
  inputSm: { width: 120, padding: '5px 6px', border: '1px solid #e3e6ea', borderRadius: 6, fontSize: 12.5 },
  inputMissing: { borderColor: '#e2b6ac', background: '#fff8f6' },
  select: { width: 150, padding: '5px 6px', borderRadius: 6, fontSize: 12.5, border: '1px solid #e3e6ea' },
  selectNotify: { width: 150, marginTop: 6, padding: '4px 6px', borderRadius: 6, fontSize: 11.5, border: '1px solid #e3e6ea' },
  textarea: { width: 220, minHeight: 44, padding: '5px 6px', border: '1px solid #e3e6ea', borderRadius: 6, fontSize: 12.5, resize: 'vertical', fontFamily: 'inherit' },
  footer: { marginTop: 24, fontSize: 12, color: '#5b6570', textAlign: 'center' },
  deptSection: { marginBottom: 16 },
  deptToggleBtn: {
    padding: '8px 14px', border: '1px solid #e3e6ea', borderRadius: 8, background: '#fff',
    fontSize: 13, cursor: 'pointer', color: '#1f2328',
  },
  deptTable: {
    width: '100%', borderCollapse: 'collapse', background: '#fff', border: '1px solid #e3e6ea',
    borderRadius: 10, fontSize: 13, marginTop: 10,
  },
  deptTh: {
    background: '#f3f2ee', textAlign: 'left', padding: '8px 10px', fontWeight: 600,
    color: '#5b6570', fontSize: 12, borderBottom: '1px solid #e3e6ea',
  },
  deptTd: { padding: '7px 10px', borderBottom: '1px solid #f0efec' },
}
