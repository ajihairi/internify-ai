# 04 — internify: Satu Tool untuk Banyak Project

Artikel ini merumuskan **model workspace internify**: satu repo tool yang berdiri
di samping (bukan di dalam) project yang mau dikerjakan AI.

> **internify bukan hal baru.** Ia adalah **generalisasi dari harness `/work`
> yang sudah jalan sekarang** (`intern/` + `.opencode/` di repo kerja).
> Nama `internify` hanya memberi identitas pada mesin yang sudah ada, supaya bisa
> dipasang di project lain dan dipakai tool lain. Tidak ada rewrite; yang ada
> adalah *ekstraksi + penamaan*.

---

## 0. Hubungan dengan implementasi sekarang

Yang sudah dibangun di repo kerja **adalah** internify versi awal
(reference implementation). Peta dari "yang sudah ada" ke "internify":

| Sudah ada (sekarang) | Menjadi (internify) | Catatan |
|----------------------|---------------------|---------|
| `intern/superpowers/harness/lib/` | `core/lib/` | Logic murni, sudah generic |
| `.opencode/plugins/intern-harness.ts` | `adapters/opencode/plugins/` | Adapter opencode |
| `.opencode/skills/intern-context/` | `adapters/opencode/skills/` | Adapter opencode |
| `.opencode/command/work.md` | `adapters/opencode/command/` | Command `/work` |
| `intern/superpowers/rules.md` | `template/.intern/rules.md` | Disanitasi jadi template |
| `intern/superpowers/roles/` | `template/.intern/roles/` | Disanitasi jadi template |
| `intern/superpowers/plans/_template/` | `template/.intern/plans/_template/` | Template spec |
| `intern/article/` | `article/` | Sebagian disanitasi |
| `harness/DESIGN.md` + plugin | `CONTRACT.md` + `README.md` | Dirangkum |

Artinya: publish internify = **ekstrak + rename + sanitasi** dari yang sudah ada.
`/work` tetap nama command-nya di opencode; `internify` adalah nama mesin/tool-nya.

---

## 1. Visi

Kasusnya sederhana:

> Ada project A yang semula dikerjakan tanpa AI. Aku mau taruh tool `internify`
> di parent-nya. Setelah itu di parent ada 2 folder: `internify` (tool-nya) dan
> `projectA` (project-nya).

```
parent/
├── internify/     ← tool + template + adapter (repo ini)
└── projectA/      ← project yang dikerjakan (tidak berubah dulu)
```

Manfaat:

- **Satu tool, banyak project.** `internify` dibuat sekali, dipakai untuk A, B, C.
- **Project tetap bersih.** Tool tidak mencampur source code-nya ke project.
- **Update satu arah.** Perbaikan di `internify` dinikmati semua project.

Ini adalah **ekstraksi** dari setup yang sekarang menempel di dalam project
(`myapp/intern` + `myapp/.opencode`).

---

## 2. Isi repo `internify`

```
internify/
├── README.md                ← overview
├── CONTRACT.md              ← kontrak: skema file, aksi, gate, layout
├── LICENSE
├── core/                    ← tool-agnostic
│   ├── lib/                 ← markdown, types, state, index-builder,
│   │                          gates, context, io, boot (+ tests)
│   └── cli.ts               ← internify boot|index|gate|evidence|close|init
├── adapters/
│   ├── opencode/            ← plugin + skill + command
│   └── claude/              ← (nanti) hooks
├── template/                ← yang di-scaffold ke project
│   └── .intern/
│       ├── rules.md
│       ├── roles/
│       ├── plans/
│       │   └── _template/
│       │       └── <SpecName>/
│       │           ├── SPECmd.md     ← WHAT
│       │           ├── Plan.md       ← HOW
│       │           └── Task.md       ← WHO
│       └── daily/
└── article/                 ← 01–04
```

`core/` dan `template/` tidak menyentuh project. Yang menyentuh project hanya
saat `internify init` (menyalin template + adapter).

---

## 3. Struktur spec (WAJIB)

Satu fitur = satu folder spec. Di dalamnya **harus** ada tiga file:

```
.intern/plans/<SpecName>/
├── SPECmd.md     ← WHAT   : requirement, behavior, referensi existing code
├── Plan.md       ← HOW    : langkah implementasi step-by-step
└── Task.md       ← WHO    : pembagian task per role + snippet
```

Aturannya:

- Nama folder `<SpecName>` = nama spec (mis. `FeatureX`).
- Folder template: `plans/_template/<SpecName>/` sebagai contoh siap-copy.
- Harness memakai folder spec ini sebagai **unit kerja** (`/work <spec-folder>`):
  ia scan `SPECmd.md`/`Plan.md`/`Task.md`, resolve file kode yang direferensi,
  lalu membangun INDEX/LEDGER.

Hierarki spec yang lebih besar (opsional, seperti di project nyata):

```
.intern/plans/
├── _template/<SpecName>/{SPECmd,Plan,Task}.md
├── <Module>/
│   ├── brief.md
│   ├── <SpecName>/{SPECmd,Plan,Task}.md
│   └── <SpecName2>/{SPECmd,Plan,Task}.md
```

---

## 4. Di mana knowledge hidup?

Ada dua mode. Pilih sesuai kebutuhan.

### Mode A — Scaffold ke dalam project (default)

`internify init` menaruh knowledge di dalam `projectA`:

```
parent/
├── internify/
└── projectA/
    ├── src/ ...
    ├── .intern/           ← rules, roles, plans, daily, state
    └── .opencode/         ← adapter (plugin/skill/command)
```

- ✅ Semua yang dibutuhkan ada di satu tempat; project self-contained.
- ❌ Project punya file AI di dalamnya (masuk `.gitignore` kalau perlu).

### Mode B — Workspace terpisah (project tetap bersih)

Knowledge disimpan di `internify`, project tidak disentuh:

```
parent/
├── internify/
│   └── workspaces/
│       └── projectA/       ← rules, roles, plans, daily, state
└── projectA/
    └── src/ ...            ← bersih, nol file AI
```

- ✅ Project benar-benar bersih (cocok kalau tak boleh ada file AI di repo).
- ✅ Semua knowledge terpusat di `internify`, mudah di-backup.
- ❌ Harness harus diberi tahu **target root** = `../projectA`.

Config (di `internify/workspaces/projectA/internify.json`):

```json
{
  "target": "../../../projectA",
  "knowledge": ".",
  "tool": "opencode"
}
```

---

## 5. `internify init` — scaffold

```bash
# Mode A: knowledge masuk ke project
internify init ../projectA

# Mode A + pilih tool
internify init ../projectA --tool opencode
internify init ../projectA --tool claude

# Mode B: knowledge tetap di internify, project bersih
internify init ../projectA --workspace
```

Yang dilakukan `init`:

1. Buat struktur `.intern/{rules,roles,plans,daily,state}` (dari `template/`).
2. Salin adapter terpilih (mis. `.opencode/` berisi plugin + skill + command).
3. Tulis `internify.json` (target root, lokasi knowledge, tool).
4. Cetak langkah selanjutnya (restart tool, jalanin boot).

---

## 6. Bagaimana harness tahu "project A"

Harness butuh **target root** (tempat kode project) yang terpisah dari
**knowledge root** (tempat rules/specs/state). Di setup sekarang keduanya sama
(`worktree || directory`). Model internify memisahkannya:

```
config.internify.json  →  { target: "../projectA", knowledge: ".intern" }
        │
        ▼
plugin/harness
  • menulis state  → knowledge/state/
  • membaca spec   → knowledge/plans/
  • gate edit      → file di bawah target/ (projectA)
```

Konsekuensi teknis: `canEdit` memakai **target root** untuk mengecek scope,
sementara state disimpan di **knowledge root**. Ini perubahan kecil di lapisan
plugin (bukan di `core/lib` yang sudah pure).

---

## 7. Alur pakai harian

```bash
# 1. Sekali di awal
internify init ../projectA

# 2. Setiap sesi kerja
cd parent
internify boot                      # atau via skill di tool
# → menulis knowledge/state/CONTEXT.md + brief

# 3. Mulai fitur
internify index .intern/plans/FeatureX
# atau, di opencode:  /work .intern/plans/FeatureX
```

Bila pakai tool lain (Claude Code, Codex, Gemini CLI), cukup arahkan ke CLI yang
sama (`internify boot|index|gate|...`). Lihat artikel 02 §5–§8.

---

## 8. Multi-tool

| Tool | Yang dipakai dari internify |
|------|------------------------------|
| opencode | adapter `adapters/opencode/` (plugin + skill + command) |
| Claude Code | adapter `adapters/claude/` (hooks) atau panggil CLI |
| Codex / Gemini / Cursor | panggil CLI `internify ...` dari terminal |

Selama **kontrak** (artikel 02 §4) dan **lokasi config** sama, ganti tool = ganti
adapter, tanpa mengubah knowledge.

---

## 9. Migrasi dari setup sekarang (project-embedded)

Setup sekarang menempel di dalam project (`myapp/intern` + `myapp/.opencode`).
Untuk pindah ke model internify:

1. **Ekstrak** `core/lib` + adapter + `template/` ke repo `internify` (lihat
   artikel 03 §4).
2. Dari `myapp`, ambil `rules.md`/`roles/` → jadikan template generik.
3. Ganti peran `intern/` di dalam project menjadi **knowledge** yang di-scaffold,
   atau pindahkan ke `internify/workspaces/myapp/` (Mode B).
4. Tambah field `target` di config supaya harness menunjuk ke root project.

Effect: `myapp` tetap jadi project, `internify` jadi tool yang dipakai berulang.

---

## 10. Roadmap singkat

1. Ekstrak `core/lib` → tambah `cli.ts` (`boot/index/gate/evidence/close/init`).
2. Pindahkan kontrak ke `CONTRACT.md`.
3. Tulis `template/` lengkap (termasuk `plans/_template/<SpecName>/`).
4. Bikin `internify init` (Mode A dulu, lalu Mode B).
5. Tambah `target` root di plugin (pisah target vs knowledge).
6. Adapter kedua (Claude Code) untuk membuktikan tool-agnostic.

---

## 11. Ringkas

- `internify` = **tool repo**, sibling ke project. Satu untuk banyak project.
- Project tetap jadi project; tool tidak mencampur source code-nya.
- Spec **wajib** satu folder `<SpecName>/` berisi `SPECmd.md` + `Plan.md` + `Task.md`.
- Knowledge bisa di-scaffold ke project (Mode A) atau tetap di internify (Mode B).
- Yang menghubungkan: **kontrak** + **config target root**.
