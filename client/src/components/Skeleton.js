import React from "react";

/**
 * Base Shell for Skeletons to maintain layout consistent with real cards
 */
const SkeletonCard = ({ children, style = {} }) => (
  <div className="card" style={{ ...style, border: "1px solid var(--border2)", cursor: "default" }}>
    {children}
  </div>
);

export const SkeletonBox = ({ width = "100%", height = "20px", marginBottom = "0px", borderRadius = "var(--radius-sm)" }) => (
  <div className="skeleton-box" style={{ width, height, marginBottom, borderRadius }} />
);

export const SkeletonStatGrid = () => (
  <div className="stat-grid">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="stat-card" style={{ border: "1px solid var(--border2)", cursor: "default" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <SkeletonBox width="60px" height="14px" />
          <SkeletonBox width="32px" height="32px" borderRadius="8px" />
        </div>
        <SkeletonBox width="100px" height="32px" marginBottom="12px" />
        <SkeletonBox width="80px" height="12px" />
      </div>
    ))}
  </div>
);

export const SkeletonChart = () => (
  <SkeletonCard style={{ height: "300px", padding: "24px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
      <div>
        <SkeletonBox width="120px" height="12px" marginBottom="8px" />
        <SkeletonBox width="160px" height="32px" />
      </div>
      <SkeletonBox width="80px" height="28px" borderRadius="20px" />
    </div>
    <SkeletonBox width="100%" height="160px" borderRadius="12px" />
  </SkeletonCard>
);

export const SkeletonRecentPayments = () => (
  <SkeletonCard style={{ minHeight: "300px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
      <SkeletonBox width="140px" height="18px" />
      <SkeletonBox width="60px" height="24px" />
    </div>
    {[1, 2, 3, 4].map(i => (
      <div key={i} style={{ padding: "14px 16px", background: "var(--bg4)", borderRadius: "14px", marginBottom: "10px", opacity: 0.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <SkeletonBox width="100px" height="14px" />
          <SkeletonBox width="60px" height="10px" />
        </div>
        <SkeletonBox width="120px" height="24px" marginBottom="8px" />
        <div style={{ display: "flex", gap: "8px" }}>
          <SkeletonBox width="50px" height="16px" borderRadius="100px" />
          <SkeletonBox width="70px" height="12px" />
        </div>
      </div>
    ))}
  </SkeletonCard>
);

export const SkeletonTable = ({ rows = 5 }) => (
  <div className="table-wrap">
    <table>
      <thead>
        <tr>
          {[1, 2, 3, 4].map(i => (
            <th key={i}><SkeletonBox width="60px" height="10px" /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            {[1, 2, 3, 4].map(j => (
              <td key={j}><SkeletonBox width="100%" height="20px" /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
