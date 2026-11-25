"use client";

import React from "react";
import { Cpu, Globe2, Layers, ShieldCheck, X } from "lucide-react";
import type { DataSourceStatus } from "@/types/telemetry";

interface FeedMetaSummary {
  name: string;
  source: string;
  status: DataSourceStatus;
  ttlSeconds: number;
  rawCount: number;
  returnedCount: number;
  updatedAt: string;
}

interface ArchitectureModalProps {
  open: boolean;
  feeds: FeedMetaSummary[];
  onClose: () => void;
}

export default function ArchitectureModal({ open, feeds, onClose }: ArchitectureModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="실시간 파이프라인 및 대량 접속 아키텍처">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">실시간 데이터 파이프라인 · Vercel CDN 아키텍처</h2>
            <p className="modal-sub">
              대규모 동시 접속 환경에서도 업스트림 API 차단 없이 60fps 3D 관측을 유지하도록 설계되었습니다.
            </p>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="닫기">
            <X size={16} />
          </button>
        </div>

        <div className="arch-pillars">
          <div className="arch-pillar">
            <ShieldCheck size={17} />
            <div>
              <strong>Vercel Edge CDN + Singleflight</strong>
              <p>
                모든 피드는 <code>s-maxage</code> + <code>stale-while-revalidate</code>와 서버 인스턴스 내
                요청 병합(Singleflight)으로 보호되어 동시 접속자 10만 명도 리전당 1회 호출로 흡수합니다.
              </p>
            </div>
          </div>
          <div className="arch-pillar">
            <Layers size={17} />
            <div>
              <strong>서버 사이드 공간 격자 집계</strong>
              <p>
                Sensor.Community 15,000+ 원본 센서(~10MB)를 서버에서 0.85° 공간 격자로 집계해 ~55KB로
                압축 전송하며, 좌표 클릭 조회는 0.25° 격자로 양자화해 CDN 적중률을 극대화합니다.
              </p>
            </div>
          </div>
          <div className="arch-pillar">
            <Cpu size={17} />
            <div>
              <strong>모바일 최적화 WebGL Instancing</strong>
              <p>
                Natural Earth 벡터 지도를 오프라인 프로시저럴 텍스처로 생성하고, Three.js{" "}
                <code>InstancedMesh</code>로 수천 개 마커를 최소 드로우콜로 렌더링합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="feed-status-table">
          <div className="feed-table-head">
            <Globe2 size={14} />
            <span>연동 피드 실시간 상태</span>
          </div>
          {feeds.map((f) => (
            <div key={f.name} className="feed-status-row">
              <div>
                <div className="feed-row-name">{f.name}</div>
                <div className="feed-row-src">{f.source}</div>
              </div>
              <div className="feed-row-right mono">
                <span className={`mini-status status-${f.status}`}>{f.status.toUpperCase()}</span>
                <span>
                  {f.rawCount.toLocaleString()} → {f.returnedCount.toLocaleString()}
                </span>
                <span>CDN {f.ttlSeconds}s</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
