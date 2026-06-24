# muscledb-web

An anatomy reference application: search muscles, browse them by anatomical
group, and look up the arteries, veins, and nerves associated with each muscle.

Node.js backend (zero required npm dependencies) over a SQLite database, serving
a static jQuery/Skeleton front-end. Runs on Ubuntu Server.

## Project layout

```
muscledb-web/
├── server.js            HTTP server: API routes + static file serving
├── queries.js           SQL + response shaping
├── db.js                SQLite access (better-sqlite3 or built-in fallback)
├── package.json
├── db/
│   └── muscles.db        SQLite database (used directly — no build step)
├── public/              web interface (HTML, JS, CSS, images)
├── test/smoke.js        endpoint smoke tests (schema-agnostic)
├── deploy/
│   ├── muscledb-web.service   systemd unit (runs as your login user)
│   ├── nginx.conf             reverse-proxy config
│   └── push.sh                one-command deploy from your Mac
└── Dockerfile
```

## Database schema

The app reads these tables directly (no views, no FTS index required):

```
muscles(id, name, lat_name, origin, insertion, function, comment, image, group_id)
groups(id, name, lat_name, parent_id, explanation)
arteries(id, name, lat_name, parent_id)
veins(id, name, lat_name, parent_id)
nerves(id, name, lat_name, parent_id)
muscle_arteries(muscle_id, artery_id)
muscle_veins(muscle_id, vein_id)
muscle_nerves(muscle_id, nerve_id)
```

The muscle-group hierarchy is computed at query time with recursive SQL, and
search uses `LIKE`. Because nothing is precomputed into the file, **updating the
data is just replacing `db/muscles.db`** — as long as the new file keeps the same
table and column names above. No views to rebuild, no search index to regenerate.

## API

All endpoints are read-only `GET`.

| Method & path                  | Description                                            |
|--------------------------------|--------------------------------------------------------|
| `GET /api/ping`                | Health/version check.                                  |
| `GET /api/muscles`             | All muscles.                                           |
| `GET /api/muscles?searchterm=` | Search across name, latin name, origin, insertion, function. |
| `GET /api/muscles/{id}`        | Muscle detail incl. arteries, veins, nerves, group chain. |
| `GET /api/musclegroups/{id}`   | A group with its nested sub-groups and muscles.        |
| `GET /api/arterymuscles/{id}`  | An artery and the muscles it supplies.                 |
| `GET /api/veinmuscles/{id}`    | A vein and the muscles it drains.                      |
| `GET /api/nervemuscles/{id}`   | A nerve and the muscles it innervates.                 |

## Running locally

```bash
node server.js          # Node 22.5+ uses the built-in SQLite module, zero install
# or, on older Node / for a small speedup:
npm install && npm start
```

Open <http://localhost:5000>. Env: `PORT` (5000), `HOST` (0.0.0.0),
`MUSCLEDB_PATH` (`db/muscles.db`). Tests: `npm test`.

## Deploying on Ubuntu Server

### One-time setup
Run these once. The key step is making your login user own the app directory, so
all later deploys need no `sudo` and no `chown`.

```bash
# install Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# place the app and hand ownership to your user (replace bp with your username)
sudo mkdir -p /opt/muscledb-web
sudo cp -r ./* /opt/muscledb-web/
sudo chown -R bp:bp /opt/muscledb-web        # <-- the only chown you ever run

# install the service (the unit is set to run as User=bp)
sudo cp /opt/muscledb-web/deploy/muscledb-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now muscledb-web
sudo systemctl status muscledb-web           # want: active (running)
```

Optionally allow restarting the service without a password by adding a sudoers
rule (`sudo visudo -f /etc/sudoers.d/muscledb`):

```
bp ALL=(root) NOPASSWD: /usr/bin/systemctl restart muscledb-web, /usr/bin/systemctl status muscledb-web
```

### Putting nginx in front
```bash
sudo apt-get install -y nginx
sudo cp /opt/muscledb-web/deploy/nginx.conf /etc/nginx/sites-available/muscledb-web
sudo ln -s /etc/nginx/sites-available/muscledb-web /etc/nginx/sites-enabled/
# edit server_name first, then:
sudo nginx -t && sudo systemctl reload nginx
# HTTPS: sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx
```

## Day-to-day deploys (no sudo, no chown)

Because `bp` owns `/opt/muscledb-web`, you can copy files straight into place:

```bash
# a single file
scp public/css/custom.css bp@fettenajs.com:/opt/muscledb-web/public/css/custom.css

# or the whole project + restart, in one command (from the project folder)
./deploy/push.sh bp@fettenajs.com
```

Static files (HTML/CSS/JS/images) take effect on reload. Changes to `server.js`,
`queries.js`, or `db.js` need a restart: `sudo systemctl restart muscledb-web`.

### Updating just the data
```bash
scp db/muscles.db bp@fettenajs.com:/opt/muscledb-web/db/muscles.db
ssh bp@fettenajs.com 'sudo systemctl restart muscledb-web'
```

### Docker alternative
```bash
docker build -t muscledb-web .
docker run -d -p 5000:5000 --name muscledb muscledb-web
```

## Notes

- Front-end caching: the stylesheet is linked as `custom.css?v=6`. If you edit the
  CSS, bump that number in `public/*.html` so browsers refetch.
- Some muscle records reference image files that aren't present on disk; those
  detail pages show a small "image not available" placeholder by design.

## License

MIT.
