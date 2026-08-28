/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import './index.css';

declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void };

interface Node {
  id: string;
  name: string;
  path?: string;
  type: string;
  language?: string;
  size?: number;
  val?: number;
  color?: string;
  communityId?: number;
  x?: number;
  y?: number;
  z?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

const dummyData: GraphData = {
  nodes: [
    {
      id: 'src',
      name: 'src',
      path: 'src',
      type: 'dir',
      language: 'directory',
      size: 0,
      val: 6,
      color: '#c084fc',
      communityId: 0,
    },
    {
      id: 'src/index.ts',
      name: 'index.ts',
      path: 'src/index.ts',
      type: 'file',
      language: 'typescript',
      size: 1200,
      val: 4,
      color: '#38bdf8',
      communityId: 0,
    },
    {
      id: 'src/utils.ts',
      name: 'utils.ts',
      path: 'src/utils.ts',
      type: 'file',
      language: 'typescript',
      size: 850,
      val: 3,
      color: '#38bdf8',
      communityId: 0,
    },
    {
      id: 'src/components',
      name: 'components',
      path: 'src/components',
      type: 'dir',
      language: 'directory',
      size: 0,
      val: 5,
      color: '#c084fc',
      communityId: 1,
    },
    {
      id: 'src/components/Graph.tsx',
      name: 'Graph.tsx',
      path: 'src/components/Graph.tsx',
      type: 'file',
      language: 'typescript',
      size: 3400,
      val: 5,
      color: '#38bdf8',
      communityId: 1,
    },
    {
      id: 'src/components/Sidebar.tsx',
      name: 'Sidebar.tsx',
      path: 'src/components/Sidebar.tsx',
      type: 'file',
      language: 'typescript',
      size: 2100,
      val: 4,
      color: '#38bdf8',
      communityId: 1,
    },
    {
      id: 'package.json',
      name: 'package.json',
      path: 'package.json',
      type: 'file',
      language: 'json',
      size: 650,
      val: 3,
      color: '#e2e8f0',
      communityId: 2,
    },
  ],
  links: [
    { source: 'src', target: 'src/index.ts', type: 'contains' },
    { source: 'src', target: 'src/utils.ts', type: 'contains' },
    { source: 'src', target: 'src/components', type: 'contains' },
    { source: 'src/components', target: 'src/components/Graph.tsx', type: 'contains' },
    { source: 'src/components', target: 'src/components/Sidebar.tsx', type: 'contains' },
    { source: 'src/index.ts', target: 'src/utils.ts', type: 'import' },
    { source: 'src/index.ts', target: 'src/components/Graph.tsx', type: 'import' },
  ],
};

const CLUSTER_PALETTE = [
  '#38bdf8',
  '#a78bfa',
  '#f43f5e',
  '#34d399',
  '#facc15',
  '#fb923c',
  '#e879f9',
  '#2dd4bf',
];

const getLanguageColor = (node: Node, colorMode: 'language' | 'cluster' = 'language'): string => {
  if (colorMode === 'cluster' && node.type !== 'dir') {
    return CLUSTER_PALETTE[(node.communityId ?? 0) % CLUSTER_PALETTE.length]!;
  }
  if (node.color) return node.color;
  const ext = (node.name || '').split('.').pop()?.toLowerCase() || '';
  const lang = (node.language || '').toLowerCase();

  if (node.type === 'dir' || lang === 'directory') return '#c084fc';
  if (lang === 'typescript' || ext === 'ts' || ext === 'tsx') return '#38bdf8';
  if (lang === 'javascript' || ext === 'js' || ext === 'jsx') return '#facc15';
  if (lang === 'csharp' || ext === 'cs') return '#9333ea';
  if (lang === 'cpp' || lang === 'c' || ext === 'cpp' || ext === 'c' || ext === 'h')
    return '#2563eb';
  if (lang === 'java' || ext === 'java') return '#ea580c';
  if (lang === 'ruby' || ext === 'rb') return '#e11d48';
  if (lang === 'kotlin' || ext === 'kt') return '#7c3aed';
  if (lang === 'swift' || ext === 'swift') return '#f97316';
  if (lang === 'php' || ext === 'php') return '#a78bfa';
  if (lang === 'python' || ext === 'py') return '#34d399';
  if (ext === 'css' || ext === 'scss' || ext === 'less') return '#f43f5e';
  if (ext === 'html' || ext === 'htm') return '#fb923c';
  return '#e2e8f0';
};

function App() {
  const [data, setData] = useState<GraphData>(dummyData);
  const [is3D, setIs3D] = useState(true);
  const [colorMode, setColorMode] = useState<'language' | 'cluster'>('language');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'file' | 'dir'>('all');
  const [spotlightMode, setSpotlightMode] = useState(true);

  const fg2DRef = useRef<any>(null);
  const fg3DRef = useRef<any>(null);
  const starfieldRef = useRef<THREE.Points | null>(null);

  const filteredData = useMemo(() => {
    let nodes = data.nodes;
    if (filterType !== 'all') {
      nodes = nodes.filter((n) => n.type === filterType);
    }
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = data.links.filter((l) => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    if (filterType === 'file' && links.length === 0) {
      const dirGroups = new Map<string, string[]>();
      for (const n of nodes) {
        const parts = (n.path || n.id).split('/');
        const parentDir = parts.slice(0, -1).join('/') || 'root';
        if (!dirGroups.has(parentDir)) dirGroups.set(parentDir, []);
        dirGroups.get(parentDir)!.push(n.id);
      }

      for (const [, fileIds] of dirGroups.entries()) {
        for (let i = 1; i < fileIds.length; i++) {
          links.push({
            source: fileIds[0],
            target: fileIds[i],
            type: 'sibling',
          });
        }
      }
    }

    return { nodes, links };
  }, [data, filterType]);

  const spotlightActive = spotlightMode && (selectedNode || hoveredNode);
  const activeFocusNode = hoveredNode || selectedNode;

  const { highlightNodes, highlightLinks } = useMemo(() => {
    const nodes = new Set<string>();
    const links = new Set<unknown>();

    if (activeFocusNode) {
      nodes.add(activeFocusNode.id);
      filteredData.links.forEach((link) => {
        const sId = typeof link.source === 'object' ? link.source.id : link.source;
        const tId = typeof link.target === 'object' ? link.target.id : link.target;
        if (sId === activeFocusNode.id || tId === activeFocusNode.id) {
          links.add(link);
          nodes.add(sId);
          nodes.add(tId);
        }
      });
    }

    return { highlightNodes: nodes, highlightLinks: links };
  }, [activeFocusNode, filteredData.links]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'setGraphData') {
        setData(message.data);
      }
    };

    window.addEventListener('message', handleMessage);

    if (typeof acquireVsCodeApi !== 'undefined') {
      const vscode = acquireVsCodeApi();
      vscode.postMessage({ command: 'ready' });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (is3D && fg3DRef.current) {
      fg3DRef.current.d3Force('charge')?.strength(-220)?.distanceMax(1200);
      fg3DRef.current.d3Force('link')?.distance(65);
    } else if (!is3D && fg2DRef.current) {
      fg2DRef.current.d3Force('charge')?.strength(-220)?.distanceMax(1200);
      fg2DRef.current.d3Force('link')?.distance(65);
    }
  }, [is3D, filteredData]);

  useEffect(() => {
    if (!is3D || !fg3DRef.current) return;
    const scene = fg3DRef.current.scene?.();
    if (!scene || starfieldRef.current) return;

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 600 + Math.random() * 800;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = radius * Math.cos(phi);

      const hueChoice = Math.random();
      if (hueChoice > 0.7) {
        starColors[i] = 0.6;
        starColors[i + 1] = 0.8;
        starColors[i + 2] = 1.0;
      } else if (hueChoice > 0.4) {
        starColors[i] = 1.0;
        starColors[i + 1] = 0.9;
        starColors[i + 2] = 0.7;
      } else {
        starColors[i] = 0.9;
        starColors[i + 1] = 0.9;
        starColors[i + 2] = 0.95;
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
    });

    const starfield = new THREE.Points(starGeometry, starMaterial);
    scene.add(starfield);
    starfieldRef.current = starfield;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, 1200);
    pointLight.position.set(200, 300, 400);
    scene.add(pointLight);
  }, [is3D]);

  useEffect(() => {
    if (!is3D || !fg3DRef.current) return;
    const controls = fg3DRef.current.controls?.();
    if (controls) {
      controls.autoRotate = autoRotate && !selectedNode;
      controls.autoRotateSpeed = 0.6;
    }
  }, [is3D, autoRotate, selectedNode]);

  const nodeThreeObject = useCallback(
    (node: Node) => {
      const isDir = node.type === 'dir';
      const baseColor = getLanguageColor(node, colorMode);
      const isHighlighted = !spotlightActive || highlightNodes.has(node.id);
      const isFocus = activeFocusNode?.id === node.id;

      const group = new THREE.Group();

      const radius = Math.max(2.2, (node.val || 4) * 0.75);
      const sphereGeometry = new THREE.SphereGeometry(radius, 16, 16);
      const sphereMaterial = new THREE.MeshStandardMaterial({
        color: isFocus ? 0xffffff : new THREE.Color(baseColor),
        emissive: new THREE.Color(baseColor),
        emissiveIntensity: isFocus ? 0.9 : isHighlighted ? 0.45 : 0.05,
        roughness: 0.2,
        metalness: 0.5,
        transparent: true,
        opacity: isHighlighted ? 0.95 : 0.15,
      });

      const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
      group.add(sphereMesh);

      if (isDir && isHighlighted) {
        const ringGeometry = new THREE.RingGeometry(radius * 1.6, radius * 2.2, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#c084fc'),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isFocus ? 0.9 : 0.45,
        });
        const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
        ringMesh.rotation.x = Math.PI / 3;
        group.add(ringMesh);
      }

      return group;
    },
    [spotlightActive, highlightNodes, activeFocusNode, colorMode],
  );

  const onNodeClick = useCallback(
    (node: Node) => {
      setSelectedNode(node);
      setAutoRotate(false);

      if (is3D && fg3DRef.current) {
        const distance = 80;
        const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
        fg3DRef.current.cameraPosition(
          {
            x: (node.x || 0) * distRatio,
            y: (node.y || 0) * distRatio,
            z: (node.z || 0) * distRatio,
          },
          node,
          1800,
        );
      } else if (!is3D && fg2DRef.current) {
        fg2DRef.current.centerAt(node.x, node.y, 800);
        fg2DRef.current.zoom(2.5, 800);
      }
    },
    [is3D],
  );

  const handleOpenFile = (path?: string) => {
    if (!path) return;
    if (typeof acquireVsCodeApi !== 'undefined') {
      const vscode = acquireVsCodeApi();
      vscode.postMessage({ command: 'openFile', path });
    }
  };

  const handleResetView = () => {
    setSelectedNode(null);
    setAutoRotate(true);
    if (is3D && fg3DRef.current) {
      fg3DRef.current.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 1500);
    } else if (!is3D && fg2DRef.current) {
      fg2DRef.current.zoomToFit(1000, 40);
    }
  };

  const isMatch = (node: Node) => {
    if (!searchQuery.trim()) return false;
    return (
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (node.path && node.path.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const draw2DNode = useCallback(
    (node: Node, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isSearchMatch = isMatch(node);
      const isHighlighted = !spotlightActive || highlightNodes.has(node.id) || isSearchMatch;

      const baseColor = getLanguageColor(node, colorMode);
      const r = Math.max(2.5, (node.val || 4) * 0.9);
      const alpha = isHighlighted ? 1 : 0.15;

      if (isHighlighted) {
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, r + (isSelected ? 6 : 3.5), 0, 2 * Math.PI, false);
        ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.6)' : `${baseColor}44`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI, false);
      ctx.fillStyle = isSelected ? '#ffffff' : baseColor;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isSelected
        ? '#ffffff'
        : `rgba(255, 255, 255, ${isHighlighted ? 0.5 : 0.1})`;
      ctx.lineWidth = isSelected ? 2 : 0.8 / globalScale;
      ctx.stroke();

      const showLabel =
        (globalScale > 1.3 && isHighlighted) || isSelected || isHovered || isSearchMatch;
      if (showLabel) {
        const label = node.name;
        const fontSize = Math.max(9 / globalScale, 3);
        ctx.font = `${isSelected ? '600' : '400'} ${fontSize}px Inter, sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const bckgDimensions = [textWidth + 6 / globalScale, fontSize + 4 / globalScale];

        ctx.fillStyle = `rgba(10, 12, 16, ${isHighlighted ? 0.9 : 0.3})`;
        ctx.beginPath();
        ctx.roundRect(
          node.x! - bckgDimensions[0] / 2,
          node.y! + r + 2 / globalScale,
          bckgDimensions[0],
          bckgDimensions[1],
          3 / globalScale,
        );
        ctx.fill();
        ctx.strokeStyle = isSelected
          ? '#ffffff'
          : `rgba(255, 255, 255, ${isHighlighted ? 0.25 : 0.05})`;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isSelected ? '#ffffff' : `${baseColor}`;
        ctx.globalAlpha = alpha;
        ctx.fillText(label, node.x!, node.y! + r + 2 / globalScale + bckgDimensions[1] / 2);
        ctx.globalAlpha = 1;
      }
    },
    [selectedNode, hoveredNode, searchQuery, spotlightActive, highlightNodes, colorMode],
  );

  return (
    <div className="graph-container">
      <div className="overlay-panel">
        <div className="panel-header">
          <div className="pulse-indicator"></div>
          <div>
            <h2>CodeAtlas Map</h2>
            <p className="subtitle">Interactive Dependency Graph</p>
          </div>
        </div>

        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
          </svg>
          <input
            type="text"
            placeholder="Search files & directories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="filter-chips">
          <button
            className={`chip ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
          <button
            className={`chip ${filterType === 'file' ? 'active' : ''}`}
            onClick={() => setFilterType('file')}
          >
            Files
          </button>
          <button
            className={`chip ${filterType === 'dir' ? 'active' : ''}`}
            onClick={() => setFilterType('dir')}
          >
            Folders
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{filteredData.nodes.length}</div>
            <div className="stat-label">Nodes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{filteredData.links.length}</div>
            <div className="stat-label">Edges</div>
          </div>
        </div>

        <div className="toggle-container">
          <button
            className={`toggle-btn ${!is3D ? 'active' : ''}`}
            onClick={() => {
              setIs3D(false);
              setAutoRotate(false);
            }}
          >
            2D View
          </button>
          <button className={`toggle-btn ${is3D ? 'active' : ''}`} onClick={() => setIs3D(true)}>
            3D View
          </button>
        </div>

        <div className="toggle-container" style={{ marginTop: '6px' }}>
          <button
            className={`toggle-btn ${colorMode === 'language' ? 'active' : ''}`}
            onClick={() => setColorMode('language')}
          >
            Languages
          </button>
          <button
            className={`toggle-btn ${colorMode === 'cluster' ? 'active' : ''}`}
            onClick={() => setColorMode('cluster')}
          >
            Clusters
          </button>
        </div>

        <div className="action-row">
          <button
            className={`action-btn ${spotlightMode ? 'active' : ''}`}
            onClick={() => setSpotlightMode(!spotlightMode)}
            title="Highlight connected path & dim unrelated nodes on hover/click"
          >
            {spotlightMode ? 'Spotlight: ON' : 'Spotlight: OFF'}
          </button>
          {is3D && (
            <button
              className={`action-btn ${autoRotate ? 'active' : ''}`}
              onClick={() => setAutoRotate(!autoRotate)}
            >
              {autoRotate ? 'Pause' : 'Rotate'}
            </button>
          )}
        </div>

        <div className="action-row" style={{ marginTop: '8px' }}>
          <button className="action-btn" onClick={handleResetView} style={{ width: '100%' }}>
            Reset Camera
          </button>
        </div>

        <div className="legend-box">
          <div className="legend-title">
            {colorMode === 'cluster' ? 'Community Clusters' : 'Languages & Types'}
          </div>
          <div className="legend-items">
            {colorMode === 'cluster' ? (
              CLUSTER_PALETTE.slice(0, 6).map((color, idx) => (
                <div className="legend-item" key={color}>
                  <span className="dot" style={{ backgroundColor: color }}></span>Cluster {idx + 1}
                </div>
              ))
            ) : (
              <>
                <div className="legend-item">
                  <span className="dot" style={{ backgroundColor: '#c084fc' }}></span>Folder
                </div>
                <div className="legend-item">
                  <span className="dot" style={{ backgroundColor: '#38bdf8' }}></span>TS/JS
                </div>
                <div className="legend-item">
                  <span className="dot" style={{ backgroundColor: '#34d399' }}></span>Python
                </div>
                <div className="legend-item">
                  <span className="dot" style={{ backgroundColor: '#9333ea' }}></span>C#
                </div>
                <div className="legend-item">
                  <span className="dot" style={{ backgroundColor: '#2563eb' }}></span>C++
                </div>
                <div className="legend-item">
                  <span className="dot" style={{ backgroundColor: '#ea580c' }}></span>Java
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {selectedNode && (
        <div className="node-inspector">
          <div className="inspector-header">
            <div
              className="inspector-badge"
              style={{
                backgroundColor: `${getLanguageColor(selectedNode)}33`,
                color: getLanguageColor(selectedNode),
              }}
            >
              {selectedNode.type.toUpperCase()} • {selectedNode.language || 'FILE'}
            </div>
            <button className="close-inspector" onClick={() => setSelectedNode(null)}>
              ×
            </button>
          </div>
          <h3 className="inspector-title" style={{ color: getLanguageColor(selectedNode) }}>
            {selectedNode.name}
          </h3>
          <div className="inspector-path">{selectedNode.path || selectedNode.id}</div>

          <div className="inspector-details">
            <div className="detail-row">
              <span>Language:</span>
              <strong>{selectedNode.language || 'Plain'}</strong>
            </div>
            {selectedNode.size !== undefined && selectedNode.size > 0 && (
              <div className="detail-row">
                <span>Size:</span>
                <strong>{(selectedNode.size / 1024).toFixed(1)} KB</strong>
              </div>
            )}
            <div className="detail-row">
              <span>Connected Nodes:</span>
              <strong>{highlightNodes.size > 0 ? highlightNodes.size - 1 : 0}</strong>
            </div>
          </div>

          <div className="inspector-actions">
            {selectedNode.type === 'file' && (
              <button
                className="btn-primary"
                onClick={() => handleOpenFile(selectedNode.path || selectedNode.id)}
              >
                Open in Editor
              </button>
            )}
            <button className="btn-secondary" onClick={() => onNodeClick(selectedNode)}>
              Focus Camera
            </button>
          </div>
        </div>
      )}

      {is3D ? (
        <ForceGraph3D
          ref={fg3DRef}
          graphData={filteredData}
          nodeThreeObject={nodeThreeObject}
          nodeLabel={(n: any) => `
            <div class="node-tooltip">
              <div class="tt-title" style="color:${getLanguageColor(n)}">${n.name}</div>
              <div class="tt-sub">${n.path || n.id}</div>
              <div class="tt-meta">${n.type} • ${n.language || ''}</div>
            </div>
          `}
          linkColor={(l: any) => {
            const isHighlighted = !spotlightActive || highlightLinks.has(l);
            if (!isHighlighted) return 'rgba(255, 255, 255, 0.04)';
            if (l.type === 'contains' || l.type === 'sibling') return 'rgba(192, 132, 252, 0.6)';
            return 'rgba(56, 189, 248, 0.75)';
          }}
          linkWidth={(l: any) => (!spotlightActive || highlightLinks.has(l) ? 1.6 : 0.5)}
          linkDirectionalParticles={(l: any) => (!spotlightActive || highlightLinks.has(l) ? 3 : 0)}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleWidth={2.2}
          linkDirectionalParticleColor={(l: any) =>
            l.type === 'contains' || l.type === 'sibling' ? '#c084fc' : '#38bdf8'
          }
          onNodeClick={onNodeClick}
          onNodeHover={(n: any) => setHoveredNode(n)}
          backgroundColor="#040508"
        />
      ) : (
        <ForceGraph2D
          ref={fg2DRef}
          graphData={filteredData}
          nodeCanvasObject={draw2DNode}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            const r = Math.max(2.5, (node.val || 4) * 0.9);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false);
            ctx.fill();
          }}
          linkColor={(l: any) => {
            const isHighlighted = !spotlightActive || highlightLinks.has(l);
            if (!isHighlighted) return 'rgba(255, 255, 255, 0.04)';
            if (l.type === 'contains' || l.type === 'sibling') return 'rgba(192, 132, 252, 0.5)';
            return 'rgba(56, 189, 248, 0.7)';
          }}
          linkWidth={(l: any) => (!spotlightActive || highlightLinks.has(l) ? 1.5 : 0.5)}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={(l: any) => (!spotlightActive || highlightLinks.has(l) ? 2 : 0)}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleWidth={2.2}
          linkDirectionalParticleColor={(l: any) =>
            l.type === 'contains' || l.type === 'sibling' ? '#c084fc' : '#38bdf8'
          }
          onNodeClick={onNodeClick}
          onNodeHover={(n: any) => setHoveredNode(n)}
          backgroundColor="#040508"
        />
      )}
    </div>
  );
}

export default App;
