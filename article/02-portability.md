# 02 — Bikin Workflow AI Ini Portabel (Project Lain, Tool Lain)

Artikel ini menjelaskan cara memakai ulang harness di project lain (misal
project ABC) dan dengan AI tool selain opencode. Ditulis supaya bisa dipublish
sebagai rujukan mandiri.

---

## 1. Masalahnya

Workflow AI yang bagus biasanya **terikat** ke satu project dan satu tool:

- Tiap project baru → setup ulang dari nol.
- Ganti AI tool (opencode → Claude Code → Codex) → semua setup hangus.

Padahal 90% nilainya bukan di tool-nya, tapi di **cara kerja** dan **struktur
pengetahuan**-nya. Yang tool-specific cuma lapisan "penegak aturan".

Jadi solusinya: **pisahkan yang portabel dari yang tidak.**

---

## 2. Dua lapis: Content vs Enforcement

| Lapis | Isi | Sifat |
|-------|-----|-------|
| **Content / Spec** | `AGENTS.md`, `rules`, `roles`, `plans/` (SPEC/Plan/Task), `daily/` | **Portabel.** Semua markdown. AI tool apa pun bisa baca |
| **Enforcement / Harness** | plugin, hook, custom tool yang memblokir aksi | **Tool-specific.** opencode API ≠ Claude ≠ Codex |

Konsekuensi:

- Content bisa dipindah antar project & tool tanpa perubahan.
- Enforcement perlu **adapter** per tool.
- Keduanya dihubungkan oleh satu **kontrak** (lihat §4).

---

## 3. Anatomi harness yang bisa dipakai ulang

```
<project>/
├── AGENTS.md                  ← entry point: instruksi boot + pointer
├── .intern/                   ← nama bebas (intern/, .ai/, harness/)
│   ├── rules.md               ← aturan global
│   ├── roles/                 ← instruksi per peran (UI, API, dst)
│   ├── plans/                 ← spec per fitur, satu folder per spec:
│   │   └── <SpecName>/        ←   SPECmd.md + Plan.md + Task.md
│   ├── daily/                 ← log harian (keputusan, progres)
│   └── state/                 ← RUNTIME: context, index, ledger, evidence
└── <adapter>/                 ← colokan ke AI tool
    ├── .opencode/             ← opencode
    ├── .claude/               ← Claude Code
    ├── .codex/                ← Codex
    └── bin/intern-harness     ← ATAU CLI universal
```

Prinsip yang membuat ini bekerja:

1. **Context di disk, bukan di memory.** State ditulis ke file, dibaca ulang
   tiap turn. Ganti session / compaction tidak kehilangan grounding.
2. **Index di-generate, bukan dikarang.** File nyata di-scan + di-hash; agent
   tidak bisa menciptakan path palsu.
3. **Gate berlapis.** Edit harus lolos: read → scope/step → evidence.

---

## 4. Kontrak (yang harus distandarkan)

Selama 4 hal ini dijaga, **ganti tool = ganti adapter saja.**

### 4.1 Skema file (runtime state)

| File | Isi |
|------|-----|
| `CONTEXT.md` | Session pack: pointer rules, daily terbaru, task aktif, daftar spec |
| `INDEX.md` | Peta source-of-truth: required reads + hash + anchor + slice |
| `LEDGER.md` | Working memory: phase, scope, steps, decisions |
| `EVIDENCE.md` | Bukti per step (append-only) |

Semua markdown + blok JSON bertanda (`<!-- intern:<tag>:begin/end -->`) supaya
human-readable **dan** machine-parseable.

### 4.2 Aksi

```
boot      → kumpulkan context sesi
index     → scan spec folder, bikin INDEX, mulai/resume task
context   → ambil slice minimal (1 section / 1 fungsi)
step      → deklarasikan step aktif + anchor
evidence  → catat bukti untuk sebuah step
close     → validasi evidence, tulis daily, selesai
status    → tampilkan phase + ledger
override  → bypass gate satu kali, tercatat (escape hatch)
```

### 4.3 Gate

| Gate | Menahan |
|------|---------|
| **Read** | Edit sebelum required reads selesai |
| **Scope/Step** | Edit di luar scope atau sebelum deklarasi step |
| **Evidence** | Menutup task tanpa bukti lulus |

### 4.4 Layout

`AGENTS.md` di root + `.intern/{rules,roles,plans,daily,state}`.

---

## 5. Tiga opsi portabilitas

| Opsi | Enforcement | Portabilitas | Kerja |
|------|-------------|--------------|-------|
| **A. Markdown-only** | Lemah (konvensi) | ★★★ | Rendah |
| **B. Adapter per tool** | Kuat | ★★ | Tinggi (banyak implementasi) |
| **C. CLI + git hooks** | Kuat | ★★★ | Sedang |

### Opsi A — Markdown-only

Tulis protokol loop di `AGENTS.md`, agent mengikuti secara konvensi.

- ✅ Jalan di tool apa pun yang membaca `AGENTS.md`.
- ❌ Tidak ada yang benar-benar memblokir kalau dilanggar.

### Opsi B — Adapter per tool

Kontrak tetap; tiap tool punya implementasi tipis.

- ✅ Enforcement kuat.
- ❌ Kerja berulang: opencode plugin, Claude Code hooks, dst.

### Opsi C — CLI + git hooks (rekomendasi)

Logic harness diangkat jadi CLI, misalnya:

```bash
intern-harness boot
intern-harness index <spec-folder>
intern-harness gate edit <file>     # exit != 0 → block
intern-harness evidence <step> --claim "..." --proof "..." --result pass
intern-harness close
```

AI tool apa pun cukup memanggil CLI lewat terminal/bash. Enforcement keras
ditambah lewat **git pre-commit hook** (mis. tolak commit kalau ada step tanpa
evidence).

- ✅ Tool-agnostic penuh (opencode, Claude Code, Codex, Gemini CLI, Cursor…).
- ✅ Satu logic, banyak tool.
- ✅ Bisa dipakai manusia juga (bukan cuma agent).

---

## 6. Arsitektur yang disarankan: core + adapters + template

Pisahkan jadi satu repo mandiri (mis. `internify`):

```
internify/
├── core/                 ← logic murni + CLI (tool-agnostic)
│   ├── lib/              ← state, index, gates, context, boot
│   └── cli.ts            ← boot/index/gate/evidence/close
├── adapters/
│   ├── opencode/         ← plugin tipis yang memanggil core
│   ├── claude/           ← hooks tipis
│   └── codex/
├── template/             ← skeleton .intern + AGENTS.md
│   └── .intern/plans/_template/<SpecName>/{SPECmd,Plan,Task}.md
└── CONTRACT.md           ← §4 di atas, versi resmi
```

Project baru cukup:

```bash
# 1. Ambil skeleton
cp -r internify/template/. <project>/

# 2. Pilih adapter (salah satu)
cp -r internify/adapters/opencode/. <project>/.opencode/
#   atau install CLI global untuk tool apa pun
npm i -g internify

# 3. Selesai. Buka tool, mulai session.
```

---

## 7. Bootstrap di project ABC (langkah nyata)

1. **Copy content layer:**
   `AGENTS.md` + `.intern/{rules.md, roles/, plans/, daily/, state/}`.

2. **Tulis `rules.md` versi ABC** — aturan global project (bahasa, arsitektur,
   larangan build/commit, dsb).

3. **Tulis `roles/`** — peran agent (mis. `BackendEngineer`, `DataEngineer`).

4. **Siapkan `plans/_template/<SpecName>/`** — satu folder per spec berisi
   `SPECmd.md` (WHAT), `Plan.md` (HOW), `Task.md` (WHO). Nama folder = nama spec.

5. **Pilih enforcement:**
   - cepat: Opsi A (protokol di `AGENTS.md`), atau
   - kuat & portabel: Opsi C (CLI) → pasang git hook.

6. **Isi `AGENTS.md`** = urutan boot + pointer:
   `rules → role → plan aktif → daily terbaru`.

---

## 8. Matriks per tool

| Tool | Mekanisme ekstensi | Cara pakai core |
|------|--------------------|-----------------|
| opencode | plugin (`tool.execute.before/after`), skill, command | Adapter plugin panggil `core` |
| Claude Code | hooks + slash commands | Hook panggil CLI |
| Codex | hooks / wrapper script | Wrapper panggil CLI |
| Gemini CLI | skill/activation | Skill panggil CLI |
| Cursor / lain | rules + terminal | Panggil CLI |

Yang sama di semua: **CLI**, **skema file**, dan **AGENTS.md**. Yang berbeda
cuma cara tool memanggil CLI-nya.

---

## 9. Dari kondisi sekarang ke portabel

Status harness saat ini: lib **sudah pure & teruji**, tapi colokannya masih
opencode.

Langkah menuju tool-agnostic:

1. **Angkat `lib/` jadi CLI.** Bungkus dengan subcommand `boot/index/gate/...`.
   Ini jarak terpendek — logic sudah tidak bergantung opencode.
2. **Pindahkan kontrak ke `CONTRACT.md`.** Supaya adapter lain punya sumber acuan.
3. **Bikin adapter kedua** (mis. Claude Code hooks) untuk membuktikan
   tool-agnostic-nya nyata, bukan klaim.
4. **Ekstrak ke repo `internify`** + `template/` supaya project baru tinggal copy.

---

## 10. Penutup

Kuncinya cuma satu: **content portabel, enforcement lewat kontrak + adapter.**

Kalau kontrak (§4) dijaga stabil, biaya ganti project atau ganti AI tool turun
drastic — yang berubah cuma beberapa puluh baris adapter, bukan seluruh workflow.
