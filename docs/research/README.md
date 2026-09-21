# Research: face & tongue analysis, rPPG / rBCG

Source material for the **Face, Tongue, Pulse** dossier:
<https://claude.ai/artifact/XeHBVijXWJ65RdF6zCVwWk>

The dossier has the full argument, the competitive analysis, the three code
defects and the phased plan. This file is just the index to the PDFs.

> **Untracked on purpose.** `papers/` is ~228 MB. Add `docs/research/papers/`
> to `.gitignore` before committing anything in `docs/`.

## rPPG — methods, models, toolkits

- [`rppg-toolbox--2210.00716.pdf`](papers/rppg-toolbox--2210.00716.pdf)  
  **rPPG-Toolbox: Deep Remote PPG Toolbox** — 2022, [arXiv:2210.00716](https://arxiv.org/abs/2210.00716v3)  
  Standard benchmark harness: 7 datasets, supervised + unsupervised models. Start here.
- [`physnet--1905.02419.pdf`](papers/physnet--1905.02419.pdf)  
  **Remote Photoplethysmograph Signal Measurement from Facial Videos Using Spatio-Temporal Networks** — 2019, [arXiv:1905.02419](https://arxiv.org/abs/1905.02419v2)  
  Spatio-temporal CNN baseline.
- [`deepphys--1805.07888.pdf`](papers/deepphys--1805.07888.pdf)  
  **DeepPhys: Video-Based Physiological Measurement Using Convolutional Attention Networks** — 2018, [arXiv:1805.07888](https://arxiv.org/abs/1805.07888v2)  
  Convolutional attention baseline.
- [`mtts-can--2006.03790.pdf`](papers/mtts-can--2006.03790.pdf)  
  **Multi-Task Temporal Shift Attention Networks for On-Device Contactless Vitals Measurement** — 2020, [arXiv:2006.03790](https://arxiv.org/abs/2006.03790v2)  
  **On-device reference.** Cardiac + respiratory in one pass, 150+ fps on ARM CPU.
- [`physformer--2111.12082.pdf`](papers/physformer--2111.12082.pdf)  
  **PhysFormer: Facial Video-based Physiological Measurement with Temporal Difference Transformer** — 2021, [arXiv:2111.12082](https://arxiv.org/abs/2111.12082v2)  
  Temporal-difference transformer (CVPR 2022).
- [`efficientphys--2110.04447.pdf`](papers/efficientphys--2110.04447.pdf)  
  **EfficientPhys: Enabling Simple, Fast and Accurate Camera-Based Vitals Measurement** — 2021, [arXiv:2110.04447](https://arxiv.org/abs/2110.04447v3)  
  Raw frames in — no face detection / normalisation preprocessing.
- [`rhythmformer--2402.12788.pdf`](papers/rhythmformer--2402.12788.pdf)  
  **RhythmFormer: Extracting Patterned rPPG Signals based on Periodic Sparse Attention** — 2024, [arXiv:2402.12788](https://arxiv.org/abs/2402.12788v3)  
  Periodic sparse attention; strong cross-dataset numbers.
- [`physmamba--2408.01077.pdf`](papers/physmamba--2408.01077.pdf)  
  **PhysMamba: State Space Duality Model for Remote Physiological Measurement** — 2024, [arXiv:2408.01077](https://arxiv.org/abs/2408.01077v3)  
  State-space duality model.
- [`factorizephys--2411.01542.pdf`](papers/factorizephys--2411.01542.pdf)  
  **FactorizePhys: Matrix Factorization for Multidimensional Attention in Remote Physiological Sensing** — 2024, [arXiv:2411.01542](https://arxiv.org/abs/2411.01542v1)  
  Matrix factorization attention (NeurIPS 2024).
- [`phase-net--2509.24850.pdf`](papers/phase-net--2509.24850.pdf)  
  **PHASE-Net: Physics-Grounded Harmonic Attention System for Efficient Remote Photoplethysmography Measurement** — 2025, [arXiv:2509.24850](https://arxiv.org/abs/2509.24850v3)  
  CVPR 2026. Pulse model derived from Navier-Stokes -> gated TCN.
- [`beatformer--2507.14885.pdf`](papers/beatformer--2507.14885.pdf)  
  **BeatFormer: Efficient motion-robust remote heart rate estimation through unsupervised spectral zoomed attention filters** — 2025, [arXiv:2507.14885](https://arxiv.org/abs/2507.14885v1)  
  Motion-robust, trains with no PPG/HR labels.
- [`spiking-physformer--2402.04798.pdf`](papers/spiking-physformer--2402.04798.pdf)  
  **Spiking-PhysFormer: Camera-Based Remote Photoplethysmography with Parallel Spike-driven Transformer** — 2024, [arXiv:2402.04798](https://arxiv.org/abs/2402.04798v4)  
  Spike-driven; only if power draw becomes binding.
- [`contrast-phys--2208.04378.pdf`](papers/contrast-phys--2208.04378.pdf)  
  **Contrast-Phys: Unsupervised Video-based Remote Physiological Measurement via Spatiotemporal Contrast** — 2022, [arXiv:2208.04378](https://arxiv.org/abs/2208.04378v1)  
  **No ground-truth signals needed.** Near-supervised accuracy on 5 datasets.
- [`contrast-phys+--2309.06924.pdf`](papers/contrast-phys+--2309.06924.pdf)  
  **Contrast-Phys+: Unsupervised and Weakly-supervised Video-based Remote Physiological Measurement via Spatiotemporal Contrast** — 2023, [arXiv:2309.06924](https://arxiv.org/abs/2309.06924v3)  
  TPAMI extension, weakly-supervised.
- [`adaptive-param--2511.21903.pdf`](papers/adaptive-param--2511.21903.pdf)  
  **Adaptive Parameter Optimization for Robust Remote Photoplethysmography** — 2025, [arXiv:2511.21903](https://arxiv.org/abs/2511.21903v1)  
  **PRISM — training-free, real-time CPU, 0.66-0.77 bpm MAE.** The v1 recommendation.
- [`skinmap--2510.05296.pdf`](papers/skinmap--2510.05296.pdf)  
  **SkinMap: Weighted Full-Body Skin Segmentation for Robust Remote Photoplethysmography** — 2025, [arXiv:2510.05296](https://arxiv.org/abs/2510.05296v1)  
  Weighted skin segmentation; survives talking + head rotation.
- [`ubihr--2410.19279.pdf`](papers/ubihr--2410.19279.pdf)  
  **UbiHR: Resource-efficient Long-range Heart Rate Sensing on Ubiquitous Devices** — 2024, [arXiv:2410.19279](https://arxiv.org/abs/2410.19279v1)  
  On-device sampling/preprocessing mechanics. 80 participants, 4 devices.
- [`distanceppg--1502.08040.pdf`](papers/distanceppg--1502.08040.pdf)  
  **DistancePPG: Robust non-contact vital signs monitoring using a camera** — 2015, [arXiv:1502.08040](https://arxiv.org/abs/1502.08040v2)  
  Region-weighted signal combination reference.
- [`mcduff-survey--2111.11547.pdf`](papers/mcduff-survey--2111.11547.pdf)  
  **Camera Measurement of Physiological Vital Signs** — 2021, [arXiv:2111.11547](https://arxiv.org/abs/2111.11547v1)  
  Best single orientation to the whole field.
- [`rppg-survey-dl--2307.12644.pdf`](papers/rppg-survey-dl--2307.12644.pdf)  
  **Remote Bio-Sensing: Open Source Benchmark Framework for Fair Evaluation of rPPG** — 2023, [arXiv:2307.12644](https://arxiv.org/abs/2307.12644v2)  
  Second open benchmark framework (non-DNN + DNN).

## Datasets & blood pressure

- [`mmpd--2302.03840.pdf`](papers/mmpd--2302.03840.pdf)  
  **MMPD: Multi-Domain Mobile Video Physiology Dataset** — 2023, [arXiv:2302.03840](https://arxiv.org/abs/2302.03840v2)  
  **Phone cameras**, 11h, 33 subjects, spans skin tone / motion / lighting.
- [`scamps--2206.04197.pdf`](papers/scamps--2206.04197.pdf)  
  **SCAMPS: Synthetics for Camera Measurement of Physiological Signals** — 2022, [arXiv:2206.04197](https://arxiv.org/abs/2206.04197v1)  
  2,800 synthetic videos with perfect labels — test the plumbing before recording anything.
- [`mvpd-dataset--2508.17924.pdf`](papers/mvpd-dataset--2508.17924.pdf)  
  **Gaze into the Heart: A Multi-View Video Dataset for rPPG and Health Biomarkers Estimation** — 2025, [arXiv:2508.17924](https://arxiv.org/abs/2508.17924v1)  
  600 subjects, 3,600 recordings, ECG + BP + SpO2 + respiration. Largest public option.
- [`u-facebp--2412.10679.pdf`](papers/u-facebp--2412.10679.pdf)  
  **U-FaceBP: Uncertainty-aware Bayesian Ensemble Deep Learning for Face Video-based Blood Pressure Estimation** — 2024, [arXiv:2412.10679](https://arxiv.org/abs/2412.10679v3)  
  Uncertainty-first BP from face video. 1,197 subjects across racial groups.
- [`bp-ppg-bench--2602.04725.pdf`](papers/bp-ppg-bench--2602.04725.pdf)  
  **Benchmarking and Enhancing PPG-Based Cuffless Blood Pressure Estimation Methods** — 2026, [arXiv:2602.04725](https://arxiv.org/abs/2602.04725v1)  
  **None of the evaluated PPG BP models met AAMI/ISO 81060-2.** The reason not to ship BP.

## Tongue

- [`tcm-tongue--2507.18288.pdf`](papers/tcm-tongue--2507.18288.pdf)  
  **TCM-Tongue: A Standardized Tongue Image Dataset with Pathological Annotations for AI-Assisted TCM Diagnosis** — 2025, [arXiv:2507.18288](https://arxiv.org/abs/2507.18288v1)  
  **6,719 images, 20 practitioner-verified categories.** Unlocks greasiness/cracks/tooth-marks.
- [`tongue-seg--2508.14932.pdf`](papers/tongue-seg--2508.14932.pdf)  
  **TOM: An Open-Source Tongue Segmentation Method with Multi-Teacher Distillation and Task-Specific Data Augmentation** — 2025, [arXiv:2508.14932](https://arxiv.org/abs/2508.14932v1)  
  **TOM** — open-source segmentation, 95.22% mIoU. Replaces GrabCut.
- [`nafld-tongue--2309.02959.pdf`](papers/nafld-tongue--2309.02959.pdf)  
  **A Non-Invasive Interpretable NAFLD Diagnostic Method Combining TCM Tongue Features** — 2023, [arXiv:2309.02959](https://arxiv.org/abs/2309.02959v3)  
  Tongue features + 6 anthropometric inputs -> 77.2% accuracy, interpretable. The architecture to copy.
- [`colour-align--2112.15106.pdf`](papers/colour-align--2112.15106.pdf)  
  **Colour alignment for relative colour constancy via non-standard references** — 2021, [arXiv:2112.15106](https://arxiv.org/abs/2112.15106v2)  
  Colour constancy from references whose true values are unknown.

## Skin & fairness

- [`dermacon-in--2506.06099.pdf`](papers/dermacon-in--2506.06099.pdf)  
  **DermaCon-IN: A Multi-concept Annotated Dermatological Image Dataset of Indian Skin Disorders for Clinical AI Research** — 2025, [arXiv:2506.06099](https://arxiv.org/abs/2506.06099v2)  
  **Most relevant to our market.** 5,450 images, South Indian outpatient clinics.
- [`passion-derm--2411.04584.pdf`](papers/passion-derm--2411.04584.pdf)  
  **PASSION for Dermatology: Bridging the Diversity Gap with Pigmented Skin Images from Sub-Saharan Africa** — 2024, [arXiv:2411.04584](https://arxiv.org/abs/2411.04584v1)  
  4,145 paediatric images, pigmented skin, Sub-Saharan Africa.
- [`fitz17k-quality--2401.14497.pdf`](papers/fitz17k-quality--2401.14497.pdf)  
  **Investigating the Quality of DermaMNIST and Fitzpatrick17k Dermatological Image Datasets** — 2024, [arXiv:2401.14497](https://arxiv.org/abs/2401.14497v2)  
  Duplicates and label errors in the field's most-used dataset.
- [`skin-tone-gran--2509.11184.pdf`](papers/skin-tone-gran--2509.11184.pdf)  
  **The Impact of Skin Tone Label Granularity on the Performance and Fairness of AI Based Dermatology Image Classification Models** — 2025, [arXiv:2509.11184](https://arxiv.org/abs/2509.11184v1)  
  Fitzpatrick scale granularity harms fairness work; move off FST.

## Sources with no local PDF

Journal, regulatory and vendor sources are cited in full in the dossier —
npj Digital Medicine (CHILL reliability study; demographic bias in rPPG datasets),
AHA *Hypertension* on cuffless BP, the FDA General Wellness guidance (6 Jan 2026),
the rBCG fusion work in *Sensors* 2021 and the two US patents on pulse-from-head-motion,
plus the tongue colour-correction literature (ICC profiles, SVR flash/no-flash, TDCCN).

## Regenerating

Metadata was pulled from the arXiv API by ID, PDFs fetched with curl and each one
checked for `%PDF` header and `%%EOF` trailer (a first pass produced files silently
truncated at exact MiB boundaries).
