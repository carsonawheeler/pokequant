'use client'

import { fmt } from '@/lib/utils'

export interface EbayRoi {
  ebay_raw_avg_price: number | null
  ebay_psa9_smart_price: number | null
  ebay_psa10_smart_price: number | null
  ebay_psa10_7day_market: number | null
  grading_roi_psa9: number | null
  grading_roi_psa10: number | null
  ebay_psa10_confidence: string | null
  ebay_psa10_sales_count: number | null
}

function roiColor(roi: number | null): string {
  if (roi == null) return 'var(--cborder)'
  if (roi >= 2.0)  return 'var(--green)'
  if (roi >= 1.0)  return '#D97706'
  return 'var(--red)'
}

export default function GradingRoi({ data }: { data: EbayRoi | null | undefined }) {
  if (data === undefined) {
    return <div className="shimmer" style={{ height: 78, borderRadius: 9 }} />
  }

  if (data === null) {
    return (
      <div style={{
        height: 78, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'var(--ink-light)', fontSize: 12,
        background: 'var(--c2)', borderRadius: 9,
      }}>
        Data available after tonight&apos;s update
      </div>
    )
  }

  const roi = data.grading_roi_psa10

  const cells = [
    {
      label: 'Raw eBay',
      value: data.ebay_raw_avg_price != null ? fmt(data.ebay_raw_avg_price) : null,
      color: 'var(--ink)',
    },
    {
      label: 'PSA 9 Value',
      value: data.ebay_psa9_smart_price != null ? fmt(data.ebay_psa9_smart_price) : null,
      color: 'var(--ink)',
    },
    {
      label: 'PSA 10 Value',
      value: data.ebay_psa10_7day_market != null ? fmt(data.ebay_psa10_7day_market) : null,
      color: 'var(--ink)',
    },
    {
      label: 'Grading ROI',
      value: roi != null ? `${roi.toFixed(1)}×` : null,
      color: roiColor(roi),
    },
  ] as const

  const count      = data.ebay_psa10_sales_count
  const confidence = data.ebay_psa10_confidence

  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        borderRadius: 9, overflow: 'hidden', border: '1px solid var(--cborder)',
      }}>
        {cells.map((cell, i) => (
          <div key={i} className="modal-market-cell" style={{
            padding: '10px 13px', background: 'var(--c1)',
            borderRight: i < 3 ? '1px solid var(--cborder)' : 'none',
          }}>
            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-light)', marginBottom: 4 }}>
              {cell.label}
            </div>
            <div style={{
              fontFamily: 'var(--fm)', fontSize: 15, fontWeight: 600,
              color: cell.value ? cell.color : 'var(--cborder)',
            }}>
              {cell.value ?? '—'}
            </div>
          </div>
        ))}
      </div>
      {(count != null || confidence) && (
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink-light)' }}>
          {count != null && `Based on ${count} eBay PSA 10 sales`}
          {count != null && confidence && ' · '}
          {confidence && `Confidence: ${confidence}`}
        </div>
      )}
    </div>
  )
}
