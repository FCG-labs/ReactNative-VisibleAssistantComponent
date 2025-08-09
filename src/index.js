// @vac/rn-client
// React Native용 VAC 클라이언트 SDK (경량)
// - 토큰 기본 필수, 핸드셰이크(hello)
// - 지수 백오프 재접속, pong 처리(WebSocket 기본 지원)
// - 호스트 결정 우선순위: options.host/port > options.config > options.env > options.resolver()
//   (mDNS 등은 resolver로 주입해 RN 환경/프로젝트에 맞게 사용)

const DEFAULTS = {
  reconnect: { baseMs: 1000, maxMs: 30000 },
  discover: true,
};

function createVacClient(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  let ws;
  let attempts = 0;
  let timer;

  function pickHostPortToken() {
    if (cfg.host && cfg.port) return { host: cfg.host, port: cfg.port, token: cfg.token };
    if (cfg.config && cfg.config.host && cfg.config.port) return { host: cfg.config.host, port: cfg.config.port, token: cfg.config.token ?? cfg.token };
    // env는 RN에서 보장되지 않으므로, 옵션으로 주입된 env 객체만 사용
    if (cfg.env) {
      const { VAC_HOST, VAC_PORT, VAC_TOKEN } = cfg.env;
      if (VAC_HOST && VAC_PORT) return { host: VAC_HOST, port: Number(VAC_PORT), token: VAC_TOKEN ?? cfg.token };
    }
    // resolver가 있으면 사용(mDNS/Bonjour 등)
    if (cfg.discover && typeof cfg.resolver === 'function') {
      const r = cfg.resolver(); // 동기 또는 Promise<string|{host,port,token}>
      if (typeof r === 'object' && r && r.host && r.port) return { host: r.host, port: r.port, token: r.token ?? cfg.token };
      if (typeof r === 'string') {
        try {
          const u = new URL(r);
          return { host: u.hostname, port: Number(u.port || 80), token: cfg.token };
        } catch {}
      }
    }
    return null;
  }

  const listeners = { open: new Set(), close: new Set(), error: new Set(), message: new Set() };
  const on = (ev, fn) => { listeners[ev]?.add(fn); return () => listeners[ev]?.delete(fn); };
  const emit = (ev, ...args) => { listeners[ev]?.forEach(fn => { try { fn(...args); } catch (e) {} }); };

  function connect() {
    const target = pickHostPortToken();
    if (!target) {
      emit('error', new Error('VAC host not resolved'));
      scheduleReconnect();
      return;
    }
    const { host, port, token } = target;
    if (!token) {
      emit('error', new Error('VAC token required'));
      scheduleReconnect();
      return;
    }
    const url = `ws://${host}:${port}?token=${encodeURIComponent(token)}&v=1`;
    try { ws?.close(); } catch {}
    ws = new WebSocket(url);

    ws.onopen = () => {
      attempts = 0;
      emit('open');
      // hello 핸드셰이크
      safeSend({ command: 'hello', app: cfg.app || 'rn-app', version: cfg.appVersion || '0', protocol: 1 });
      // 선택: 초기 스냅샷 푸시 (사용자가 요청 시 호출하도록 노출)
    };

    ws.onmessage = (e) => {
      let msg = e.data;
      try { msg = JSON.parse(e.data); } catch {}
      emit('message', msg);
    };

    ws.onerror = (e) => {
      emit('error', e?.message || e);
    };

    ws.onclose = () => {
      emit('close');
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    clearTimeout(timer);
    const delay = Math.min(cfg.reconnect.maxMs || 30000, (cfg.reconnect.baseMs || 1000) * Math.pow(2, attempts++));
    timer = setTimeout(connect, delay);
  }

  function safeSend(obj) {
    try {
      if (ws && ws.readyState === 1) {
        ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
        return true;
      }
    } catch {}
    return false;
  }

  // 즉시 연결 시도
  connect();

  // 공개 API
  return {
    send: safeSend,
    close: () => { clearTimeout(timer); try { ws?.close(); } catch {} },
    on,
    // RN 네비게이터 스냅샷을 Host로 전송
    publishNavigatorSnapshot(snapshot) {
      // snapshot: { screens: string[], edges?: {source:string,target:string}[] }
      if (!snapshot || !Array.isArray(snapshot.screens)) return false;
      return safeSend({ command: 'nav:snapshot', ...snapshot });
    },
  };
}

// React Navigation 상태에서 스크린 목록을 추출해 간단 스냅샷 생성
function buildSnapshotFromReactNavigation(state) {
  // state: navigation.getState() 결과 (중첩 가능)
  const screens = new Set();
  function walk(s) {
    if (!s) return;
    try {
      const routes = s.routes || [];
      routes.forEach(r => {
        if (r?.name) screens.add(r.name);
        if (r?.state) walk(r.state);
      });
    } catch {}
  }
  walk(state);
  return { screens: Array.from(screens) };
}

module.exports = { createVacClient, buildSnapshotFromReactNavigation };
