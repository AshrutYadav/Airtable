## Airtable-Connected Dynamic Form Builder (Backend)

This is the **Node.js/Express + MongoDB** backend for the Airtable-connected dynamic form builder interview task.
The repository is structured as:

- `backend` – Express API, MongoDB models, Airtable OAuth + Webhooks
- `frontend` – React (Vite) single-page app (see `frontend/README.md`)

### Tech Stack

- **Node.js + Express**
- **MongoDB + Mongoose**
- **Airtable OAuth + REST API + Webhooks**

---

## Local Development (Full Stack)

1. **Backend**
   - `cp backend/env.example backend/.env` (fill in the placeholders).
   - `cd backend && npm install && npm run dev` (listens on `http://localhost:4000`).
2. **Frontend**
   - `cp frontend/env.example frontend/.env` (point `VITE_API_BASE_URL` at the backend URL).
   - `cd frontend && npm install && npm run dev` (Vite serves `http://localhost:5173`).

With those two processes running you can exercise the Airtable login, build forms, submit responses, and hit the webhook endpoint locally (via airtable tunnel/NGROK if needed).

---

## Deployment Playbook

### Backend → Render

1. Render reads the [`render.yaml`](./render.yaml) blueprint. Click **“New +” → Blueprint** in Render, point it at this repo, and it will create a Node 20 web service that runs from `backend/` with `npm install` + `npm start`.
2. During the blueprint creation you will be prompted for the secrets defined in `backend/env.example`:
   - `MONGODB_URI` (Atlas URI or Render’s Mongo add-on).
   - `JWT_SECRET`.
   - Airtable OAuth credentials + webhook verification token.
   - Set `CLIENT_BASE_URL` to your eventual Vercel URL (e.g. `https://airtable-form-builder.vercel.app`).
   - Update `AIRTABLE_REDIRECT_URI` to `https://<render-service>.onrender.com/auth/airtable/callback`.
3. After deploy, hit `https://<render-service>.onrender.com/health` to verify the service is alive.
4. Keep the Render dashboard open while connecting Airtable webhooks so you can watch the logs.

### Frontend → Vercel

1. The [`frontend/vercel.json`](frontend/vercel.json) file configures Vercel to treat `frontend/` as the project root, run the Vite build, and serve the generated SPA with a fallback route.
2. When creating the Vercel project choose “Monorepo → frontend” and supply:
   - `Install Command`: automatically inferred from the json (`npm install` inside `frontend`).
   - `Build Command`: `npm run build`.
   - `Output Directory`: `dist`.
3. Add the environment variable `VITE_API_BASE_URL=https://<render-service>.onrender.com` in the Vercel dashboard (Production + Preview + Dev).
4. After the first deploy, visit the site and confirm OAuth redirects to the Render backend, then back to Vercel.

### Cross-Service Checklist

| Need | Render (Backend) | Vercel (Frontend) |
| --- | --- | --- |
| Origin URLs | `CLIENT_BASE_URL=https://<vercel-app>.vercel.app` | `VITE_API_BASE_URL=https://<render-service>.onrender.com` |
| OAuth Redirect | `AIRTABLE_REDIRECT_URI=https://<render-service>.onrender.com/auth/airtable/callback` | n/a |
| Secrets | MONGO, JWT, Airtable tokens, webhook token | none besides API base URL |
| Health checks | `/health` endpoint already implemented | SPA fallback handled via `vercel.json` routes |

Deployments can be repeated anytime—Render auto-builds when `main` changes, and Vercel rebuilds on push or when a new environment variable is saved.

---

### 1. Setup & Run (Backend)

```bash
cd backend
cp .env.example .env   # fill in your values
npm install
npm run dev            # runs on http://localhost:4000
```

Key env vars (see `.env.example`):

- **MONGODB_URI** – local or cloud MongoDB connection string
- **PORT** – backend port (default 4000)
- **JWT_SECRET** – random secret for signing JWT cookies
- **CLIENT_BASE_URL** – frontend origin (e.g. `http://localhost:5173`)
- **AIRTABLE_CLIENT_ID / AIRTABLE_CLIENT_SECRET** – from Airtable OAuth app
- **AIRTABLE_REDIRECT_URI** – must match value in Airtable OAuth app (`/auth/airtable/callback`)
- **AIRTABLE_WEBHOOK_VERIFICATION_TOKEN** – shared secret for webhook protection

---

### 2. Data Model Overview

#### `User`

- `airtableUserId` – Airtable user identifier (simplified placeholder)
- `name`, `email`, `avatarUrl`
- `accessToken`, `refreshToken`
- `lastLoginAt`

#### `Form`

- `owner` – Mongo `User` reference
- `airtableBaseId`, `airtableTableId`
- `name`, `description`
- `questions[]`:
  - `questionKey` – internal key used in answers
  - `airtableFieldId`
  - `label`
  - `type` – `shortText | longText | singleSelect | multiSelect | attachment`
  - `required` – boolean
  - `options` – for select questions
  - `conditionalRules` – see below

#### `Response`

- `form` – Mongo `Form` reference
- `airtableRecordId` – corresponding Airtable record
- `answers` – raw JSON of answers keyed by `questionKey`
- `status` – `active | updated | deletedInAirtable`
- `createdAt`, `updatedAt`

---

### 3. Conditional Logic

Backend utility: `src/utils/conditionalLogic.js`

```ts
type Operator = "equals" | "notEquals" | "contains";

interface Condition {
  questionKey: string;
  operator: Operator;
  value: any;
}

interface ConditionalRules {
  logic: "AND" | "OR";
  conditions: Condition[];
}
```

Pure function:

```ts
function shouldShowQuestion(
  rules: ConditionalRules | null,
  answersSoFar: Record<string, any>
): boolean;
```

Rules:

- **If `rules` is `null` or `conditions` is empty ⇒ show question (`true`)**
- Supports operators: `equals`, `notEquals`, `contains`
- `logic` combines conditions (`AND` / `OR`)
- Missing values and malformed rules are handled safely (no crash)
- Mirrored implementation in frontend: `frontend/src/utils/conditionalLogic.js`

Unit tests live in `backend/tests/conditionalLogic.test.js` and run via:

```bash
cd backend
npm test
```

---

### 4. Airtable OAuth Flow

Endpoints:

- `GET /auth/airtable/login`
  - Redirects user to Airtable OAuth authorize URL with:
    - `client_id`, `redirect_uri`, `response_type=code`
    - `scope= data.records:read data.records:write schema.bases:read`
- `GET /auth/airtable/callback`
  - Exchanges `code` for tokens via Airtable token endpoint
  - Saves/updates `User` with `accessToken` and `refreshToken`
  - Issues JWT, stores as `httpOnly` cookie `token`
  - Redirects back to `CLIENT_BASE_URL`
- `GET /auth/me`
  - Reads JWT from cookie/Authorization header, returns basic profile or `null`

Minimal profile is built from Airtable meta responses (for the purpose of this task).

---

### 5. Airtable Integration

Service: `src/services/airtableService.js`

- **Base/Table/Field metadata**
  - `listBases(accessToken)`
  - `listTables(accessToken, baseId)`
  - `listFields(accessToken, baseId, tableId)`
  - Supports only:
    - `singleLineText` → `shortText`
    - `multilineText` → `longText`
    - `singleSelect` → `singleSelect`
    - `multipleSelects` → `multiSelect`
    - `multipleAttachments` → `attachment`
  - Unsupported field types are filtered out on backend.

- **Create record**
  - `createAirtableRecord(accessToken, baseId, tableId, fields)` – used on submit.

Routes:

- `GET /api/airtable/bases`
- `GET /api/airtable/bases/:baseId/tables`
- `GET /api/airtable/bases/:baseId/tables/:tableId/fields`

All require authentication (`authRequired`).

---

### 6. Forms & Responses API

Routes in `src/routes/formRoutes.js`:

- `POST /api/forms` (auth required)
  - Creates a form:
    - `name`, `description`
    - `airtableBaseId`, `airtableTableId`
    - `questions[]` (see model)

- `GET /api/forms` (auth required)
  - Lists forms for current user (dashboard).

- `GET /api/forms/:formId/public` (no auth)
  - Fetches a form definition for public filling.

- `POST /api/forms/:formId/responses` (auth required to write to Airtable)
  - Validates:
    - required fields
    - `singleSelect` option is one of `options`
    - `multiSelect` values are subset of `options`
  - Maps answers to Airtable `fields` by `airtableFieldId`
  - Calls Airtable to **create a record**
  - Writes a `Response` document with `airtableRecordId` + `answers`

- `GET /api/forms/:formId/responses` (auth required)
  - Lists MongoDB responses only:
    - `_id`, `createdAt`, `status`, and `answers`

---

### 7. Airtable Webhook Sync

Route: `POST /webhooks/airtable`

- Expects a JSON body with `events[]` from Airtable’s webhook.
- Simple verification using header `x-airtable-signature` compared to `AIRTABLE_WEBHOOK_VERIFICATION_TOKEN`.
- For each event:
  - `action === "delete"`:
    - `Response.findOneAndUpdate({ airtableRecordId }, { status: "deletedInAirtable" })`
  - `action === "update"`:
    - `Response.findOneAndUpdate({ airtableRecordId }, { status: "updated", answers: event.fields || {} })`

You should configure the webhook in Airtable to point to:

- **Local dev:** `http://localhost:4000/webhooks/airtable`
- **Production:** `https://your-backend-host/webhooks/airtable`

---

### 8. Running the Full Stack Locally

1. **Start backend**

   ```bash
   cd backend
   cp .env.example .env
   # fill env values
   npm install
   npm run dev
   ```

2. **Start frontend**

   See `../frontend/README.md` for details; typical flow:

   ```bash
   cd ../frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

3. Navigate to `http://localhost:5173` and:
   - Log in with Airtable
   - Build a form (select base & table, choose fields, add conditional rules)
   - Fill `/form/:formId`
   - View `/forms/:formId/responses`

This backend is deployment-ready for platforms like **Render** or **Railway** (just set env vars and run `npm start`).








## Airtable-Connected Dynamic Form Builder (Frontend)

This is the **React (Vite)** frontend for the Airtable-connected dynamic form builder interview task.
It talks to the Express backend in `../backend`.

### Tech Stack

- **React 18**
- **React Router 6**
- **Vite**
- **Axios**

---

### 1. Setup & Run (Frontend)

```bash
cd frontend
cp .env.example .env   # adjust VITE_API_BASE_URL if needed
npm install
npm run dev            # runs on http://localhost:5173
```

Key env var:

- `VITE_API_BASE_URL` – URL of the backend (e.g. `http://localhost:4000` or your Render/Railway URL)

---

### 2. Application Routes

- `/` – **Dashboard**
  - Shows “Create New Form” button
  - When authenticated, lists existing forms from `GET /api/forms`:
    - Links to `/form/:formId` (fill)
    - Links to `/forms/:formId/responses` (response list)

- `/builder` – **Form Builder**
  - Requires login (triggers OAuth if not logged in)
  - Steps:
    - Enter form `name` and `description`
    - Select Airtable **Base** (`GET /api/airtable/bases`)
    - Select **Table** within base (`GET /api/airtable/bases/:baseId/tables`)
    - Fetch supported **Fields** (`GET /api/airtable/bases/:baseId/tables/:tableId/fields`)
    - For each field, configure:
      - `label` (rename)
      - `required` (checkbox)
      - `conditionalRules` (entered as raw JSON for simplicity)
    - Saves form via `POST /api/forms`.

- `/form/:formId` – **Form Viewer / Filler**
  - Loads public form definition from `GET /api/forms/:formId/public`
  - Renders fields by `type`:
    - `shortText` → `<input>`
    - `longText` → `<textarea>`
    - `singleSelect` → `<select>`
    - `multiSelect` → multiple `<select>`
    - `attachment` → `<input type="file">` (demo: only captures file names)
  - Uses shared **conditional logic** to hide/show questions in real time.
  - Performs client-side required validation before submit.
  - Submits via `POST /api/forms/:formId/responses` with `answers` JSON.

- `/forms/:formId/responses` – **Responses List**
  - Fetches from `GET /api/forms/:formId/responses`.
  - Displays:
    - Submission `_id`
    - `createdAt`
    - `status` (`active | updated | deletedInAirtable`)
    - Compact `answers` JSON preview.

---

### 3. Conditional Logic on the Frontend

File: `src/utils/conditionalLogic.js`

- Mirrors backend implementation to allow **real-time visibility** updates.
- Signature:

```ts
function shouldShowQuestion(
  rules: { logic: "AND" | "OR"; conditions: { questionKey: string; operator: "equals" | "notEquals" | "contains"; value: any; }[] } | null,
  answersSoFar: Record<string, any>
): boolean;
```

Behavior:

- Returns `true` when `rules` is `null` or empty.
- Supports operators: `equals`, `notEquals`, `contains` (for strings and arrays).
- Combines conditions with `AND` or `OR`.
- Robust against missing values or malformed conditions.

`FormViewer` uses this function when rendering each question; when the user types/selects answers, visibility is re-evaluated immediately using React state.

---

### 4. Basic UI / UX Notes

The UI is intentionally minimal (no design system) to focus on **data modeling and logic**:

- Layout is simple flex/stack with inline styles for clarity.
- Conditional rules are edited via JSON textarea in the builder to keep implementation compact and explicit during review.
- All main flows (login → build form → fill form → view responses) are reachable from the dashboard.

This frontend is ready for deployment on **Vercel** or **Netlify**. Just build with `npm run build` and deploy the generated `dist` folder, pointing `VITE_API_BASE_URL` at your hosted backend.