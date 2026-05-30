import React from 'react';
import { ImagePlus } from 'lucide-react';

export function EmptyDropCard({ onAdd }) {
  return (
    <div className="empty-tray">
      <ImagePlus size={28} />
      <strong>이미지 또는 폴더 추가</strong>
      <span>여기로 드래그 앤 드롭하거나 버튼으로 이미지를 선택하세요.</span>
      <button className="small-button" onClick={onAdd}>
        <ImagePlus size={16} /> 이미지 추가
      </button>
    </div>
  );
}
