# 03 — Publish ke GitHub Tanpa Membocorkan Materi Internal

Artikel ini panduan mempublikasikan **harness** ke GitHub secara aman. Baca
sebelum `git push` apa pun.

---

## 1. Prinsip utama

> **Harness (generik) = publik. Pengetahuan project (privat) = tetap privat.**

Yang punya nilai jual dan layak dibagikan adalah **cara kerja**-nya (content vs
enforcement, kontrak, loop, CLI, adapter). Yang **tidak boleh** ikut adalah
pengetahuan internal: spec produk, log harian, URL internal, identitas signing,
kode produksi.

Jangan pernah `git push` repo kerja (`myapp/`) apa adanya. Publish **repo baru
terpisah** yang isinya cuma harness generik.

---

## 2. Aman vs tidak

| Aman dipublish | JANGAN dipublish |
|----------------|------------------|
| `harness/lib/` (logic murni) | `intern/superpowers/plans/**` (spec fitur produk) |
| `harness/DESIGN.md`, `PLAN.md` (setelah disanitasi) | `intern/daily/**` (log kerja, nama orang/tim) |
| `harness/smoke.ts`, tests | `rules.md` / `roles/` versi **mentah** internal |
| `.opencode/plugins/intern-harness.ts` | Root `plans/ComponentCatalog` |
| `.opencode/skills/`, `.opencode/command/` | `app//**` (kode produksi) |
| `rules.md` + `roles/` versi **template** (disanitasi) | Nama client/perusahaan, nama produk, identitas signing |
| `article/01–03` (setelah disanitasi) | File `state/` runtime, `node_modules` |
| `template/`, `CONTRACT.md` | |

> `rules.md` dan `roles/` **ikut dipublish** — tapi sebagai **template generik**,
> bukan versi internal. Isi internal (URL, signing, nama client) dibuang; sisakan
> strukturnya sebagai contoh yang bisa diisi ulang di project lain.

---

## 3. Struktur repo publik `internify`

```
internify/
├── README.md               ← overview + cara pakai
├── CONTRACT.md             ← §kontrak resmi (files/actions/gates/layout)
├── LICENSE                 ← MIT / Apache-2.0
├── .gitignore
├── package.json            ← untuk CLI (nanti)
├── core/
│   ├── lib/                ← markdown.ts, types.ts, state.ts, index-builder.ts,
│   │                          gates.ts, context.ts, io.ts, boot.ts (+ tests)
│   └── cli.ts              ← boot/index/gate/evidence/close/status
├── adapters/
│   └── opencode/
│       ├── plugins/intern-harness.ts
│       ├── skills/intern-context/SKILL.md
│       ├── command/work.md
│       └── package.json
├── article/
│   ├── 01-what-we-built.md
│   ├── 02-portability.md
│   └── 03-publishing.md
└── template/
    ├── AGENTS.md
    └── .intern/
        ├── rules.md                  ← template generik (disanitasi)
        ├── roles/                    ← template peran
        │   ├── Engineer.md
        │   └── DataEngineer.md
        ├── plans/_template/<SpecName>/{SPECmd,Plan,Task}.md
        └── daily/.keep
```

Catatan: lib cukup diganti nama `.intern` → `.internify` bila mau lebih netral,
tapi selama konsisten tidak masalah.

---

## 4. Langkah ekstraksi (dari repo kerja ke repo publik)

```bash
# 1. Repo baru
mkdir internify && cd internify && git init

# 2. Copy core logic + tests (tool-agnostic)
mkdir -p core
cp -r ../myapp/intern/superpowers/harness/lib core/lib

# 3. Copy adapter opencode
mkdir -p adapters/opencode
cp -r ../myapp/.opencode/plugins  adapters/opencode/plugins
cp -r ../myapp/.opencode/skills   adapters/opencode/skills
cp -r ../myapp/.opencode/command  adapters/opencode/command
cp    ../myapp/.opencode/package.json adapters/opencode/package.json

# 4. Copy article + docs
mkdir -p article
cp ../myapp/intern/article/*.md article/
cp ../myapp/intern/superpowers/harness/DESIGN.md .
cp ../myapp/intern/superpowers/harness/PLAN.md .
cp ../myapp/intern/superpowers/harness/smoke.ts core/

# 5. Copy rules + roles sebagai bahan template (WAJIB disanitasi)
mkdir -p template/.intern/roles
cp    ../myapp/intern/superpowers/rules.md template/.intern/rules.md
cp -r ../myapp/intern/superpowers/roles/* template/.intern/roles/

# 6. Tulis README.md + CONTRACT.md + LICENSE + .gitignore dari nol
```

Yang **tidak** dicopy: `intern/superpowers/plans`, `intern/daily`,
root `plans`, `app/`, dan `intern/state`.

---

## 5. Sanitasi setelah copy (wajib)

Periksa & bersihkan jejak internal:

1. **`rules.md` + `roles/`** → ubah jadi **template generik**: buang URL
   internal, aturan signing, nama client; ganti contoh (mis. `FeatureX`,
   `Engineer.md`/`DataEngineer.md`) yang bisa diisi ulang di project lain.
   Struktur tetap dipertahankan sebagai contoh.
2. **`DESIGN.md` / `PLAN.md`** → cari referensi nama produk/client dan ganti
   dengan contoh netral (`FeatureX`).
3. **`article/01`** → kalau artikel itu menyebut project internal, ganti nama
   jadi contoh generik sebelum publish (atau publish hanya 02 + 03).
4. **Author/credit** → cek tidak ada nama client di test/mock/header.
5. **Contoh di test** → ganti path contoh yang menyebut fitur internal dengan
   nama generik.

Cari cepat dengan ripgrep:

```bash
rg -i "acme|internal|confluence|<your-company>" .
rg -i "http[s]?://" .            # audit semua URL
```

---

## 6. LICENSE + .gitignore

`.gitignore` repo publik:

```gitignore
node_modules/
.DS_Store
*.log
state/
.opencode/node_modules/
.opencode/bun.lock
```

Pilih lisensi (MIT paling umum untuk tooling; Apache-2.0 kalau mau
patent grant). Tambahkan `LICENSE` di root dan sebutkan di `README.md`.

---

## 7. Verifikasi sebelum push

Checklist:

- [ ] Tidak ada nama client/perusahaan/produk di file mana pun
- [ ] Tidak ada URL internal / Confluence / Jira
- [ ] Tidak ada file `daily/`, `plans/` produk, atau `rules.md` mentah
- [ ] Tidak ada `node_modules/`, `state/`, atau file runtime
- [ ] Tidak ada kredensial/token/`.env`
- [ ] `bun test core/lib` hijau di repo publik
- [ ] `smoke.ts` jalan
- [ ] `README.md` + `LICENSE` ada
- [ ] `git remote` mengarah ke repo baru, **bukan** repo kerja

Cek sekali lagi isi staging sebelum commit pertama:

```bash
git add -A
git status
git diff --cached --stat
```

---

## 8. Menjaga sinkronisasi dengan repo kerja

Setelah publish, repo kerja tetap jadi tempat kerja internal. Jembatannya:

```
internify (publik)              myapp (privat)
├── core/lib  ◄── sumber utama ── (pernah dicopy)
└── adapters                     .opencode (dipakai harian)
```

- Perbaikan generik **di upstream `internify`**, lalu disalin ke project.
- Jangan sebaliknya (jangan tarik materi internal ke publik).
- Idealnya project memakai `internify` sebagai dependency/CLI, bukan salinan,
  supaya update satu arah.

---

## 9. Ringkas

1. Publish **repo terpisah** `internify` — bukan repo kerja.
2. Copy `lib`, adapter, article, `template/`, plus `rules.md` + `roles/` (jadikan template).
3. Sanitasi nama client / URL / spec / daily.
4. Tambah `LICENSE` + `.gitignore` + `README` + `CONTRACT`.
5. Verifikasi dengan checklist §7 sebelum `git push`.
