import { useId, useState } from 'react';
import { projectCar } from './map-model';
import type { TrackMapData, MapCar } from './map-model';

interface TrackMapProps {
  track: TrackMapData;
  selectedVertex?: number;
  onSelectVertex?: (id: number) => void;
  showLabels?: boolean;
  highlightedRoads?: readonly string[];
  visitedVertices?: readonly number[];
  frontierVertices?: readonly number[];
  activeEdge?: string;
  cars?: readonly MapCar[];
  accessibleName?: string;
  showControls?: boolean;
  statusLabel?: string;
}

export function TrackMap({ track, selectedVertex, onSelectVertex, showLabels = true, highlightedRoads = [], visitedVertices = [], frontierVertices = [], activeEdge, cars = [], accessibleName, showControls = true, statusLabel = 'Preview layout' }: TrackMapProps) {
  const [zoom, setZoom] = useState(1);
  const titleId = useId();
  const gridId = useId();
  const vertices = new Map(track.vertices.map((vertex) => [vertex.id, vertex]));
  const width = 920 / zoom;
  const height = 540 / zoom;
  return (
    <div className="track-map">
      <div className="map-topline"><span className="map-coordinate">SECTOR 01 / CIRCUIT OVERVIEW</span><span className="status-dot">{statusLabel}</span></div>
      <svg viewBox={`${460 - width / 2} ${270 - height / 2} ${width} ${height}`} role="group" aria-labelledby={titleId}>
        <title id={titleId}>{accessibleName ?? `${track.name} interactive circuit map`}</title>
        <defs><pattern id={gridId} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.6" /></pattern></defs>
        <rect x="-1000" y="-1000" width="3000" height="3000" fill={`url(#${gridId})`} className="map-grid" />
        <text x="420" y="240" className="map-watermark">{track.name.split(' ')[0].toUpperCase()}</text>
        {track.roads.map((road) => {
          const from = vertices.get(road.from);
          const to = vertices.get(road.to);
          if (!from || !to) return null;
          return <g key={road.id} className={`map-road ${road.status} ${road.shortcut ? 'shortcut' : ''} ${highlightedRoads.includes(road.id) ? 'highlighted' : ''} ${activeEdge === road.id ? 'active-edge' : ''}`}>
            <title>{road.id}: {road.status}{road.shortcut ? ', shortcut' : ''}</title>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="road-border" />
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="road-kerb" />
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="road-surface" />
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="road-center" />
            {road.status === 'blocked' && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2} className="road-block">×</text>}
          </g>;
        })}
        {track.vertices.map((vertex) => <g key={vertex.id} className={`map-node ${vertex.kind} ${selectedVertex === vertex.id ? 'selected' : ''} ${visitedVertices.includes(vertex.id) ? 'visited' : ''} ${frontierVertices.includes(vertex.id) ? 'frontier' : ''} ${vertex.active === false ? 'inactive' : ''}`}
          role={onSelectVertex ? 'button' : undefined} tabIndex={onSelectVertex ? 0 : undefined}
          aria-label={vertex.label} aria-pressed={onSelectVertex ? selectedVertex === vertex.id : undefined}
          onClick={() => onSelectVertex?.(vertex.id)}
          onKeyDown={(event) => { if (onSelectVertex && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSelectVertex(vertex.id); } }}>
          <title>{vertex.label}</title><circle cx={vertex.x} cy={vertex.y} r="24" className="node-target" /><circle cx={vertex.x} cy={vertex.y} r="19" className="node-ring" /><circle cx={vertex.x} cy={vertex.y} r="13" className="node-body" />
          <text x={vertex.x} y={vertex.y + 4} className="node-symbol">{vertex.kind === 'start' ? 'S' : vertex.kind === 'fuel' ? 'F' : vertex.kind === 'nitro' ? 'N' : vertex.kind === 'dead-end' ? '×' : vertex.checkpointOrder ?? '+'}</text>
          {showLabels && vertex.kind !== 'checkpoint' && <text x={vertex.x} y={vertex.y + 36} className="node-label">{vertex.label}</text>}
        </g>)}
        {cars.map((car) => {
          const point = projectCar(track, car);
          if (!point) return null;
          return <g key={car.id} className="map-car" role="img" aria-label={`${car.label} car`}>
            <g transform={`translate(${point.x} ${point.y}) rotate(${point.angle})`}>
              <rect x="-15" y="-8" width="30" height="16" rx="5" fill={car.color} />
              <rect x="1" y="-6" width="6" height="12" rx="2" fill="#102024" />
              <line x1="-11" y1="-8" x2="-11" y2="8" stroke="#102024" strokeWidth="3" />
            </g>
            <text x={point.x} y={point.y - 18} className="car-label">{car.label}</text>
          </g>;
        })}
      </svg>
      <div className="map-footer"><div className="map-legend"><span><i className="legend-checkpoint" />Checkpoint</span><span><i className="legend-service" />Service</span><span><i className="legend-shortcut" />Shortcut</span><span><i className="legend-blocked" />Blocked</span></div>{showControls && <div className="map-controls"><button aria-label="Zoom out" disabled={zoom <= 0.8} onClick={() => setZoom((value) => Math.max(0.8, value - 0.2))}>−</button><button onClick={() => setZoom(1)}>Fit</button><button aria-label="Zoom in" disabled={zoom >= 1.8} onClick={() => setZoom((value) => Math.min(1.8, value + 0.2))}>+</button></div>}</div>
    </div>
  );
}
