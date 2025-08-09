# React Native Visible Assistant Component (VAC)

Visualise and control your React Native navigation stack in real-time.
This folder hosts the **mobile-side SDK** and the **web UI** that together
connect to the VAC Host running on your machine or network.

## Packages

| Path | Description |
| --- | --- |
| `src/` | `createVacClient()` – tiny, dependency-free RN SDK. Opens a token-secured WebSocket to the Host and publishes `nav:snapshot` messages. |
| `ui/public/` | Stand-alone browser UI built with React 18, React Flow 11 (xyflow) and ELK for automatic layout. Can also be embedded in VS Code via the bundled extension. |

## Quick Start

```sh
# 1) Install the RN client SDK inside your app
npm i @fcg-labs/rn-vac

# 2) Provide connection info
cat > .vacrc.json <<'EOF'
{ "host": "127.0.0.1", "port": 8090, "token": "dev-token" }
EOF

# 3) Run the Host (from repo root)
node packages/host/examples/dev-host.js

# 4) Serve the UI for testing
npx http-server ReactNative-VisibleAssistantComponent/ui/public --port 5500
# open  http://localhost:5500/index.html?ws=ws://127.0.0.1:8090/?token=dev-token
```

### RN integration example

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createVacClient, buildSnapshotFromReactNavigation } from '@fcg-labs/rn-vac';

const vac = createVacClient({ host: '127.0.0.1', port: 8090, token: 'dev-token' });

export default function App() {
  const ref = React.useRef(null);
  return (
    <NavigationContainer
      ref={ref}
      onReady={() => vac.publishNavigatorSnapshot(buildSnapshotFromReactNavigation(ref.current.getRootState()))}
      onStateChange={() => vac.publishNavigatorSnapshot(buildSnapshotFromReactNavigation(ref.current.getRootState()))}
    >
      {/* screens */}
    </NavigationContainer>
  );
}
```

## TypeScript support

The package ships with bundled typings (`src/index.d.ts`). No additional `@types` install is required. Works out of the box in Expo & bare RN projects.

## Message Protocol (v1)

Command | Direction | Payload
--- | --- | ---
`hello` | any → any | `{ app, version, protocol: 1 }`
`graph:get` | UI → Host | –
`graph:update` | Host → UI | `{ nodes, edges }`
`nav:snapshot` | RN → Host | `{ screens: string[], edges? }`
`graph:focus` | UI → Host | `{ screen }`

## Development scripts

```sh
# Lint & format
npm run lint

# Test SDK (jest)
npm t
```

## License

MIT © VAC
