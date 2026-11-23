# F6-T2 implementation notes (FS, branch f6t2)

**Base:** main 650dba3.
**Plan:** `plan.md` (511ca40).

## S0: build comment strip (CTO §5), ee6e336

See plan §0 for what is stripped and how it is made safe.

**Size:**

| | before | after |
|---|---|---|
| `dist/index.html` | 605 023 B | **494 146 B** (108.3 kB of comments stripped) |
| gzip | 171.6 kB | 126.3 kB |
| headroom under C-1.3 (627 302 B, unchanged) | 22.3 kB | 133.2 kB |

The build takes 0.14 s.

**Gate on the stripped build** (quiet machine, all green):

| run | wall | three step |
|---|---|---|
| default 1 | 415.6 s | 16.1 s |
| default 2 | 417.1 s | 16.7 s |
| default 3 | 410.0 s | 16.5 s |

- **Default runs:** the median is **415.6 s**, against the limit of 420 s; no run was over 440 s.
  - On main the median was 406.5 s, with three-step times of 15.8 to 16.9 s.
  - These runs are slower in the CPU-only three step as well, so the difference reads as a slower machine. The strip only changes the page bytes.
- **QA_FULL=1 with QA_RELEASE=1:** green, 723.2 s in all, of which the release step took 260.2 s. That puts the QA_FULL part at about 463 s, against the limit of 480 s.
  - The C-4.8 solo step's best of 3 was 147 ms (203, 163, 147).
  - The loaded build was 944 ms, against the 1200 ms guard.
  - Texgen C-3.2's best of 3 was 91.9 ms.
- **Release step on its own (`--only leak-max`):** stream plus stream rows 244.7 s, release rows 240.6 s, wall time 244.7 s.
  - On main the same step took 243.5 s and 239.7 s.
  - The 260.2 s NOTE came only when the release step ran straight after a QA_FULL pool, on a warm machine.

**Readers:** the lint layer scan and QA's f1-t1-static order check use the `/* js/... */` file markers, which are kept. f1-t1-static passes 231/0, including its dist-versus-src `localStorage` count.
