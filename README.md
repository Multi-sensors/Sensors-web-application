# Sensor Field

Browser dashboard for connecting to Bluetooth Low Energy (BLE) sensors, viewing live measurements, comparing readings, and storing history. This repository is currently a **starter blueprint**: the intended architecture, contracts, UX, and developer workflow are documented here; application code is not yet scaffolded.

## Problem

Sensor data is often trapped in device-specific mobile applications. Sensor Field provides a browser-based workspace for desktop and mobile users to connect a supported BLE device deliberately, understand its live state, compare measurements, and retain normalized readings for later analysis.

## Goals

- Mobile-first, responsive web experience.
- Explicit, permission-aware BLE connections from the browser.
- Clear connection status and honest browser compatibility messaging.
- Live measurement views, comparisons, and historical queries.
- Backend persistence with portable PostgreSQL SQL.
- Mock sensor mode for development without hardware.
- Small, testable boundaries between BLE, parsing, UI, and persistence.

## Non-goals

- Inventing a proprietary BLE protocol or claiming support for unknown devices.
- Background BLE access, silent device scans, or bypassing browser permissions.
- Authentication, alerts, device provisioning, or fleet management in the first MVP.
- Native mobile parity where the browser platform does not permit it.

## MVP features

1. Responsive dashboard with known and available sensors.
2. User-initiated browser device picker and BLE connection flow.
3. States: unsupported, ready, connecting, connected, reconnecting, disconnected, error.
4. Adapter-based measurement parsing plus simulated temperature/humidity sensor.
5. Latest-value display, real-time chart, multi-sensor/metric comparison, and history.
6. FastAPI ingestion and query endpoints backed by PostgreSQL.
7. Safe disconnect and forget actions.

## Product reference and research

Dataniz informs the focus on live data flows and simple visualization, not branding, copy, or source code. Its public site highlights MQTT, WebSocket, and HTTP streaming: [dataniz.com](https://dataniz.com/).

Comparable product patterns reviewed:

- [HAZER](https://www.hazer.io/hazer): device management, live dashboards, analytics, and responsive sync.
- [Telemetry2U](https://telemetry2u.com/): time-windowed history, interactive charts, API/webhook integration.
- [Palamoa](https://www.palamoa.de/): manufacturer-independent sensor views and configurable line charts.

Design takeaway: put operational state first, give trend charts enough room, use filters for comparison/history, and avoid hiding connection or data freshness.

## Screens and user flows

### Dashboard

```mermaid
flowchart TD
  A[Open dashboard] --> B{Web Bluetooth available?}
  B -- No --> C[Unsupported browser state + mock mode]
  B -- Yes --> D[Sensor list and Ready state]
  D --> E[Connect device]
  E --> F[Live sensor view]
  F --> G[Compare selected metrics]
  F --> H[View historical data]
```

### Connect-device flow

```mermaid
sequenceDiagram
  actor User
  participant UI as Web dashboard
  participant Browser as Browser picker
  participant Device as BLE sensor
  User->>UI: Press "Connect sensor"
  UI->>Browser: navigator.bluetooth.requestDevice(...)
  Browser-->>User: Permission/device picker
  User-->>Browser: Select device
  Browser-->>UI: BluetoothDevice
  UI->>Device: Connect GATT + subscribe
  Device-->>UI: Notifications
  UI-->>User: Connected status and live readings
```

### Low-fidelity layouts

```text
Dashboard
┌──────────────────────────────────────────────────────────────┐
│ Sensor Field      [Connection: Ready]       [Connect sensor] │
├──────────────┬───────────────────────────────────────────────┤
│ Sensors      │ Live overview                                 │
│ • Demo lab   │ 22.4 °C        48.1 % RH                      │
│ • Field-01   │ ─────────── live trend chart ─────────────── │
│              │ [Compare] [History] [Disconnect]              │
└──────────────┴───────────────────────────────────────────────┘

Connect device
┌──────────────────────────────────┐
│ Connect a BLE sensor          ×  │
│ Browser opens its device picker. │
│ Only choose a device you trust.  │
│                                  │
│ [Choose Bluetooth device]        │
│ [Use demo sensor instead]        │
└──────────────────────────────────┘

Comparison
┌──────────────────────────────────────────────────────────────┐
│ Compare readings  [Sensor A ×] [Sensor B ×] [Metric: Temp v] │
│ ─────────────── multiple-series time chart ───────────────── │
│ Sensor A  22.4 °C  ▲ 0.3     Sensor B  21.9 °C  ▼ 0.1       │
└──────────────────────────────────────────────────────────────┘

History
┌──────────────────────────────────────────────────────────────┐
│ Historical readings   [Last 24 hours] [Metric] [Export later]│
│ ───────────────── time chart ─────────────────────────────── │
│ Timestamp                 Sensor       Metric       Value    │
│ 2026-08-22 10:20:00 UTC   Demo lab     temp         22.4     │
└──────────────────────────────────────────────────────────────┘
```

### Required UI states

| State | UI behavior |
| --- | --- |
| Empty | Explain no sensors are registered; offer demo mode and connect action. |
| Loading | Reserve chart/table space; announce loading accessibly. |
| Disconnected | Preserve last reading with timestamp; offer reconnect. |
| Unsupported | Do not show connect action; explain browser limitation and offer demo/history. |
| Error | Plain-language failure message, retry action, diagnostic detail only when safe. |

## Architecture overview

```mermaid
flowchart LR
  Browser[Next.js browser client]
  BLE[Web Bluetooth service]
  Adapter[Sensor adapter interface]
  Buffer[Live measurement buffer]
  API[FastAPI]
  DB[(PostgreSQL: Neon / Supabase / local)]
  Browser --> BLE --> Adapter --> Buffer
  Buffer --> API --> DB
  Browser --> API
```

### Sensor-data flow

```mermaid
sequenceDiagram
  participant S as BLE sensor or demo adapter
  participant A as adapter/parser
  participant B as live buffer
  participant W as web UI
  participant F as FastAPI
  participant P as PostgreSQL
  S->>A: raw notification
  A->>A: validate and normalize payload
  A->>B: Measurement
  B->>W: latest value + chart point
  B->>F: POST /api/v1/readings
  F->>P: persist normalized reading
  W->>F: GET historical/comparison data
  F->>P: query
  P-->>W: paginated results
```

### Frontend boundaries

| Area | Responsibility |
| --- | --- |
| `lib/bluetooth/capability.ts` | Secure-context and Web Bluetooth feature detection. |
| `lib/bluetooth/client.ts` | Browser-only discovery, GATT lifecycle, disconnect events. |
| `lib/sensors/adapter.ts` | Protocol-neutral adapter contract. |
| `lib/sensors/demo-adapter.ts` | Deterministic simulated readings for local work and tests. |
| `lib/connection/store.ts` | Explicit connection-state transitions. |
| `lib/measurements/buffer.ts` | Bounded live series and freshness tracking. |
| `lib/api/client.ts` | Typed FastAPI client and consistent error conversion. |
| `components/charts/*` | Recharts visualizations and comparison controls. |

Bluetooth modules must be imported only by Client Components or runtime browser guards; they must never execute during server rendering.

### Adapter contract

```ts
export interface SensorAdapter {
  readonly id: string;
  readonly displayName: string;
  requestOptions(): RequestDeviceOptions;
  connect(device: BluetoothDevice): Promise<void>;
  subscribe(onMeasurement: (reading: NormalizedReading) => void): Promise<() => void>;
  disconnect(): Promise<void>;
}
```

Actual sensor support belongs in adapters. Add the vendor's documented GATT service UUIDs, characteristic UUIDs, byte order, scaling, units, and payload validation there. Do not add guessed UUIDs or parsers.

## Planned technology stack and rationale

| Layer | Choice | Why |
| --- | --- | --- |
| Web | Next.js App Router, TypeScript, Tailwind CSS | Typed, deployable React app with responsive UI primitives. |
| Charts | Recharts | Lightweight React charting suitable for live line series. |
| BLE | Web Bluetooth API | Direct browser BLE access where supported. |
| API | Python, FastAPI, Pydantic | Typed validation, fast OpenAPI contract, simple service boundary. |
| Data | SQLAlchemy + Alembic + PostgreSQL | Portable relational model and controlled migrations. |
| Hosting | Neon or Supabase PostgreSQL | Managed PostgreSQL without provider-specific SQL. |
| Tests | Vitest/Testing Library and pytest | Fast unit/API coverage; BLE API fully mocked. |

## Intended repository structure

```text
.
├── apps/
│   ├── api/
│   │   ├── alembic/
│   │   ├── app/
│   │   └── tests/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── tests/
├── docs/
│   ├── architecture.md
│   ├── research.md
│   └── wireframes.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Makefile
└── README.md
```

## Prerequisites

- Node.js 22+ and npm 11+.
- Python 3.12+ and [uv](https://docs.astral.sh/uv/).
- Docker Desktop for local PostgreSQL, or a Neon/Supabase PostgreSQL database.
- Chrome, Edge, or another browser with Web Bluetooth support for physical BLE testing.

## Local setup

> These commands describe the planned scaffold. They will work after the applications and configuration files listed above are added.

```bash
git clone <repository-url>
cd Sensors-web-application
cp .env.example .env
docker compose up -d db
make install
make migrate
make dev
```

Web: `http://localhost:3000`  
API docs: `http://localhost:8000/docs`  
API health: `http://localhost:8000/health`

## Environment variables

```dotenv
# Shared
DATABASE_URL=postgresql+psycopg://sensor_field:sensor_field@localhost:5432/sensor_field
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO

# Web (public values only)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEMO_SENSOR_ENABLED=true
```

Never commit `.env`, database passwords, API credentials, or BLE device identifiers. `NEXT_PUBLIC_*` values are visible to every browser user; secrets never belong there.

## Commands

### Frontend

```bash
npm --prefix apps/web install
npm --prefix apps/web run dev
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web run test
npm --prefix apps/web run build
```

### Backend

```bash
uv sync --project apps/api --all-groups
uv run --project apps/api uvicorn app.main:app --reload --port 8000
uv run --project apps/api ruff check .
uv run --project apps/api pytest
```

### Database and migrations

```bash
docker compose up -d db
uv run --project apps/api alembic upgrade head
uv run --project apps/api alembic revision --autogenerate -m "describe_change"
```

Migrations are the source of truth for schema evolution. Use standard PostgreSQL types and indexes; do not rely on Neon- or Supabase-only SQL.

## Mock sensor usage

Enable `NEXT_PUBLIC_DEMO_SENSOR_ENABLED=true`, then select **Use demo sensor**. The demo adapter emits validated temperature and relative-humidity readings on a fixed interval. It exercises the same buffer, chart, API ingestion, comparison, and history paths as a real adapter without using Bluetooth hardware.

## Connecting a real BLE sensor

1. Serve the web app from HTTPS (or `localhost` for development).
2. Confirm the browser supports Web Bluetooth.
3. Implement the device's documented adapter: filters, service UUIDs, characteristic UUIDs, notification setup, parser, units, and validation.
4. Press **Connect sensor**. The app calls `navigator.bluetooth.requestDevice()` only from this user gesture.
5. Choose the intended device in the browser picker; verify the connected label and freshness timestamp.
6. Disconnect when finished, or use **Forget** to remove the app's registered sensor metadata.

## API overview

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness/readiness health check. |
| `GET` | `/api/v1/sensors` | Paginated registered sensors. |
| `POST` | `/api/v1/sensors` | Create registered sensor metadata. |
| `GET` | `/api/v1/sensors/{sensor_id}` | One sensor and capabilities. |
| `POST` | `/api/v1/readings` | Ingest normalized reading(s). |
| `GET` | `/api/v1/readings` | Paginated historical readings with filters. |
| `GET` | `/api/v1/comparisons` | Time-series data grouped for selected sensors/metrics. |

Example registration:

```bash
curl -X POST http://localhost:8000/api/v1/sensors \
  -H 'content-type: application/json' \
  -d '{"external_id":"demo-lab-01","name":"Demo lab","source":"demo"}'
```

Example normalized reading:

```bash
curl -X POST http://localhost:8000/api/v1/readings \
  -H 'content-type: application/json' \
  -d '{"sensor_id":"<uuid>","metric":"temperature","value":22.4,"unit":"celsius","observed_at":"2026-08-22T10:20:00Z"}'
```

Validation rules: UUID sensor ID, finite numeric value, recognized metric/unit pair, timezone-aware timestamp, and bounded batch size. Invalid requests return a structured `422`; unknown sensors return `404`; unexpected failures return a correlation ID without leaking internals.

## Data model

- **Sensor**: UUID, user-visible name, minimized external identifier, source, lifecycle timestamps.
- **SensorMetric**: sensor capability, metric key, unit, display metadata.
- **SensorReading**: UUID, sensor ID, metric, numeric value, unit, observation timestamp, receipt timestamp.

Future: add workspace/user foreign keys and row-level access rules with an authentication design. Do not treat a browser BLE permission as application identity.

## Testing

Planned representative coverage:

- Frontend: unsupported state, connection transitions, parser validation, demo emissions, live-buffer bounds, chart/comparison controls.
- Backend: health, sensor creation, reading validation/ingestion, pagination/filtering of historical readings, comparison queries.
- Integration: mocked API client and mocked `navigator.bluetooth`; no automated test requires BLE hardware.

Run all checks after scaffold:

```bash
make lint
make test
make build
make migrate-check
```

## Browser compatibility and Web Bluetooth limits

Web Bluetooth is experimental and not Baseline. It requires a secure context, explicit user permission, and a transient user activation to request a new device. The API is also controlled by the `Permissions-Policy: bluetooth` directive. It is not available in Web Workers. See [MDN Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).

Product behavior:

- Chrome and Edge on supported platforms: offer the explicit connect flow.
- Unsupported browsers: show an honest unsupported state; allow mock and historical views.
- iOS Safari and Firefox: do not promise BLE connection capability; verify target versions/device policy during acceptance testing.
- All production BLE use: HTTPS only. `localhost` is appropriate for local development.

## Deployment guidance

- Deploy the Next.js app to a platform that serves HTTPS.
- Deploy FastAPI behind HTTPS with health checks and structured JSON logs.
- Use managed PostgreSQL through Neon or Supabase using `DATABASE_URL` only.
- Restrict `CORS_ORIGINS` to deployed frontend origins; never use wildcard CORS with credentials.
- Apply Alembic migrations in a controlled release step before API rollout.
- Configure backups, monitoring, read/write retention, and a rollback policy with the chosen database provider.

## Security and privacy

- BLE access begins only after a visible user action.
- Request the narrowest practical device filters/services for the real adapter.
- Persist only the identifier needed to associate app records; avoid raw advertising data and unnecessary stable IDs.
- Keep secrets server-side and manage them through deployment environment variables.
- Validate API inputs with Pydantic; parameterize database access through SQLAlchemy.
- Configure narrow CORS and a `Permissions-Policy` appropriate to the deployment.
- Define sensor-reading retention, deletion, and export requirements before production; high-frequency telemetry can grow quickly.
- Authentication/authorization is a required follow-up before multi-user or sensitive deployments.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Connect button absent | Browser unsupported or page not secure; use Chrome/Edge and HTTPS/localhost. |
| Picker does not open | Verify action came directly from a click/key activation; do not call from page load/timer. |
| Device connects but no data | Confirm actual service/characteristic UUIDs, notification support, permissions, and parser byte order. |
| API CORS error | Match web origin exactly in `CORS_ORIGINS`; restart API after env changes. |
| Migration failure | Verify `DATABASE_URL`, PostgreSQL availability, then inspect Alembic revision state. |
| Chart stays empty | Confirm adapter emits normalized readings and API returns successful ingestion responses. |

## Development roadmap

1. Scaffold monorepo, local database, CI, linting, and tests.
2. Implement demo adapter, dashboard, charting, and persistence API.
3. Integrate first documented BLE protocol with fixture-based parsing tests.
4. Add authentication/workspaces, role-aware access, retention jobs, and export.
5. Add alerts, offline sync strategy, observability, and production hardening.

## Team ownership

| Area | Owner |
| --- | --- |
| Frontend | Mometa |
| Backend | Daksha and Stephanie Noe |

No contact information is assumed or stored in this repository.

## Contribution workflow

1. Open a focused branch from the current default branch.
2. Add or update tests with behavioral changes.
3. Run relevant lint, type, test, migration, and build commands.
4. Document adapter protocol assumptions and add raw payload fixtures for BLE work.
5. Submit a review with UI screenshots for visible changes and migration notes for schema changes.
6. Never add credentials, captured device identifiers, or proprietary protocol details without authorization.

## Definition of done

- Required flow works in mock mode on desktop and mobile layouts.
- A real BLE connection can be added through the adapter interface without cross-cutting changes.
- All stated UI states are keyboard accessible and clearly communicated.
- API validates, stores, paginates, and compares normalized readings.
- Migration, lint, type checks, tests, and practical production builds pass in CI.
- README commands match repository automation and no secrets are committed.

## License

License placeholder. Choose and add a license before public distribution.
