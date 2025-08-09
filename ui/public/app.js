'use strict';

(function () {
  const { createElement: h, useEffect, useMemo, useState, useCallback } = React;
  const { createRoot } = ReactDOM;
  const RF = window.ReactFlow || window.ReactFlowRenderer; // compat
  const { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState } = RF;
  const elk = new ELK();

  // Adapters
  function createAdapter() {
    // VS Code Webview bridge
    const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
    if (vscode) {
      const api = {
        mode: 'webview',
        send: (msg) => vscode.postMessage(msg),
        on: (handler) => {
          const fn = (event) => handler(event.data);
          window.addEventListener('message', fn);
          return () => window.removeEventListener('message', fn);
        },
      };
      // initial handshake for webview mode (extension will bridge)
      setTimeout(() => {
        api.send({ command: 'hello', app: 'vac-ui', version: '0.0.1', protocol: '1' });
        api.send({ command: 'graph:get' });
      }, 0);
      return api;
    }
    // WebSocket direct (for browser usage): ?ws=ws://host:port
    const params = new URLSearchParams(location.search);
    const wsUrl = params.get('ws');
    if (wsUrl) {
      const ws = new WebSocket(wsUrl);
      ws.addEventListener('open', () => {
        try { ws.send(JSON.stringify({ command: 'hello', app: 'vac-ui', version: '0.0.1', protocol: '1' })); } catch {}
        try { ws.send(JSON.stringify({ command: 'graph:get' })); } catch {}
      });
      return {
        mode: 'ws',
        send: (msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg)),
        on: (handler) => {
          const fn = (e) => {
            try { handler(JSON.parse(e.data)); } catch { handler(e.data); }
          };
          ws.addEventListener('message', fn);
          return () => ws.removeEventListener('message', fn);
        },
      };
    }
    // Fallback: local demo
    return {
      mode: 'demo',
      send: () => {},
      on: (handler) => {
        const demo = { type: 'graph:update', nodes: [{ id: 'Home', data: { label: 'Home' } }, { id: 'Detail', data: { label: 'Detail' } }], edges: [{ id: 'Home->Detail', source: 'Home', target: 'Detail' }] };
        setTimeout(() => handler(demo), 50);
        return () => {};
      },
    };
  }

  async function layoutWithELK(nodes, edges) {
    const g = {
      id: 'root',
      layoutOptions: { 'elk.direction': 'RIGHT', 'elk.layered.spacing.nodeNodeBetweenLayers': '50' },
      children: nodes.map(n => ({ id: n.id, width: 160, height: 48 })),
      edges: edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    };
    const res = await elk.layout(g);
    const posMap = new Map();
    res.children?.forEach(c => posMap.set(c.id, { x: c.x || 0, y: c.y || 0 }));
    return nodes.map(n => ({ ...n, position: posMap.get(n.id) || { x: 0, y: 0 } }));
  }

  function App() {
    const adapter = useMemo(createAdapter, []);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
      return adapter.on(async (msg) => {
        if (!msg) return;
        // minimal config/error logging
        if (msg.command === 'config' && msg.error) {
          console.warn('[vac-ui] config error:', msg.error, msg);
          return;
        }
        if (msg.type === 'graph:update' || msg.command === 'graph:update') {
          const n = (msg.nodes || []).map(nd => ({ id: nd.id || nd.data?.id || nd.name, data: { label: nd.data?.label || nd.label || nd.id }, position: { x: 0, y: 0 } }));
          const e = (msg.edges || []).map(ed => ({ id: ed.id || `${ed.source}->${ed.target}` , source: ed.source, target: ed.target }));
          const laid = await layoutWithELK(n, e);
          setNodes(laid);
          setEdges(e);
        }
      });
    }, [adapter]);

    const onNodeClick = useCallback((_, node) => {
      const screen = node?.id;
      if (screen) adapter.send({ command: 'graph:focus', screen });
    }, [adapter]);

    return h('div', { style: { height: '100%', width: '100%' } }, [
      h('div', { className: 'toolbar' }, `${nodes.length} nodes / ${edges.length} edges · mode: ${adapter.mode}`),
      h('div', { className: 'canvas' }, h(ReactFlow, {
        nodes, edges,
        onNodesChange, onEdgesChange,
        onNodeClick,
        fitView: true,
        children: [
          h(MiniMap, { key: 'mm' }),
          h(Controls, { key: 'ct' }),
          h(Background, { key: 'bg', variant: 'dots' }),
        ],
      })),
    ]);
  }

  const root = createRoot(document.getElementById('root'));
  root.render(h(App));
})();
